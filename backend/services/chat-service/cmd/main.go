package main

import (
	"fmt"
	"log"
	"os"

	"shared/database"
	"shared/logger"     // 👈 1. Shared Zap logger package
	"shared/middleware" // 👈 2. Shared Prometheus & Zap trace middleware

	"chat-service/internal/config"
	"chat-service/internal/handler"
	"chat-service/internal/model"
	"chat-service/internal/repository"
	"chat-service/internal/routes"
	"chat-service/internal/service"
	"chat-service/internal/utils"
	"chat-service/websocket"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// 🟢 CORS Middleware to handle Preflight OPTIONS requests and Trace Headers
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func main() {
	// ⚡ 3. Initialize Zap Structured JSON Logger at absolute startup
	logger.InitLogger()
	defer logger.Log.Sync()

	cfg := config.LoadConfig()

	// 1. PostgreSQL Connection
	dbURL := cfg.DatabaseURL
	if dbURL == "" {
		dbHost := os.Getenv("DB_HOST")
		dbPort := os.Getenv("DB_PORT")
		dbUser := os.Getenv("DB_USER")
		dbPass := os.Getenv("DB_PASSWORD")
		dbName := os.Getenv("DB_NAME")

		if dbHost == "" {
			dbHost = "localhost"
		}
		if dbPort == "" {
			dbPort = "5432"
		}
		if dbUser == "" {
			dbUser = "postgres"
		}
		if dbPass == "" {
			dbPass = "postgres"
		}
		if dbName == "" {
			dbName = "chat_db"
		}

		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", dbUser, dbPass, dbHost, dbPort, dbName)
	}

	db, err := database.Connect(dbURL)
	if err != nil {
		log.Fatalf("Fatal: Database connection failed for Chat Service: %v", err)
	}

	// ⚡ AutoMigrate models
	if err := db.AutoMigrate(&model.Room{}, &model.RoomMember{}, &model.Message{}); err != nil {
		log.Fatalf("Fatal: Database migration failed: %v", err)
	}

	chatRepo := repository.NewChatRepository(db)
	chatService := service.NewChatService(chatRepo)

	// ⚡ Connect and initialize Redis Pub/Sub client before starting manager
	_ = config.InitRedis()

	// ⚡ WebSocket Manager with Redis Pub/Sub listener
	manager := websocket.NewManager()
	go manager.Run()

	// ⚡ Inter-Service REST Client
	userClient := utils.NewUserServiceClient(cfg.UserServiceURL)

	// ⚡ Chat Handler
	chatHandler := handler.NewChatHandler(cfg.JWTSecret, manager, chatService, userClient)

	router := gin.New()

	// 🟢 Attach Middlewares in Production Order
	router.Use(CORS())
	router.Use(gin.Recovery())

	// ⚡ DAY 43: Attach Zap Structured Logger & Correlation Trace ID Middleware
	router.Use(logger.ZapLoggerMiddleware())

	// ⚡ DAY 42: Attach Prometheus Metrics Collection Middleware
	router.Use(middleware.PrometheusMiddleware("chat-service"))

	// ⚡ DAY 42: Expose standard Prometheus metrics scraper endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	routes.SetupRoutes(router, chatHandler)

	port := cfg.AppPort
	if port == "" {
		port = "8003"
	}

	log.Printf("🚀 [Chat Service] Distributed Engine operational with Zap & Prometheus on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Fatal: Chat Service server failed to start: %v", err)
	}
}
