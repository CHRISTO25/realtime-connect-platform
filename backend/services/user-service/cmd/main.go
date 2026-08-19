package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"shared/database"
	"shared/logger"     // 👈 1. Shared Zap structured logger package
	"shared/middleware" // 👈 2. Shared Prometheus & Trace ID middleware

	"user-service/internal/handler"
	"user-service/internal/media"
	"user-service/internal/model"
	"user-service/internal/repository"
	"user-service/internal/routes"
	"user-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp" // 👈 3. Prometheus scraper handler
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("WARNING: .env file not found, falling back to system environment variables")
	}

	// ⚡ 4. Initialize Zap Structured JSON Logger at absolute startup
	logger.InitLogger()
	defer logger.Log.Sync()

	log.Println("Starting User Service ignition pipeline with Zap & Prometheus...")

	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "8002"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-fallback-super-secret-key-change-in-prod"
		log.Println("WARNING: JWT_SECRET not found in env, using local fallback")
	}

	dbURI := os.Getenv("DATABASE_URL")
	if dbURI == "" {
		dbURI = os.Getenv("DB_URI")
	}

	db, err := database.Connect(dbURI)
	if err != nil {
		log.Fatalf("Critical Failure: Could not link up with Database pool: %v", err)
	}

	// Auto-migrate models
	log.Println("Running GORM schema migrations...")
	err = db.AutoMigrate(
		&model.UserProfile{},
		&model.FriendRequest{},
		&model.Friend{},
		&model.BlockedUser{},
	)
	if err != nil {
		log.Fatalf("Migration Failure: Could not map models: %v", err)
	}

	mediaUploader, err := media.NewMediaUploader()
	if err != nil {
		log.Fatalf("Critical Failure: Cloudinary setup failed: %v", err)
	}

	// Dependency Injection Matrix
	profileRepo := repository.NewProfileRepository(db)
	userService := service.NewUserService(profileRepo, mediaUploader)
	userHandler := handler.NewUserHandler(userService)

	friendRepo := repository.NewFriendRepository(db)
	friendService := service.NewFriendService(friendRepo)
	friendHandler := handler.NewFriendHandler(friendService)

	blockRepo := repository.NewBlockRepository(db)
	blockService := service.NewBlockService(blockRepo)
	blockHandler := handler.NewBlockHandler(blockService)

	// Using gin.New() for complete control over execution and telemetry middleware stack
	router := gin.New()

	router.Use(CORSMiddleware())
	router.Use(gin.Recovery())

	// ⚡ 5. DAY 43: Attach Zap Structured Logger & Correlation Trace ID Propagation Middleware
	router.Use(logger.ZapLoggerMiddleware())

	// ⚡ 6. DAY 42: Attach Prometheus Metrics Collection Middleware
	router.Use(middleware.PrometheusMiddleware("user-service"))

	// ⚡ 7. DAY 42: Expose standard Prometheus metrics scraper endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	router.GET("/health", func(c *gin.Context) {
		traceID, _ := c.Get("trace_id")
		c.JSON(http.StatusOK, gin.H{
			"status":    "UP",
			"timestamp": time.Now().Format(time.RFC3339),
			"service":   "user-service",
			"trace_id":  traceID,
		})
	})

	routes.SetupRoutes(router, userHandler, friendHandler, blockHandler, jwtSecret)

	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 User Service online and listening on port %s (Observability Enabled)", port)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Fatal: Server initialization crashed on %s: %v", serverAddr, err)
	}
}
