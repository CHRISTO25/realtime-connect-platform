package main

import (
	"auth-service/internal/config"
	authdb "auth-service/internal/database"
	"auth-service/internal/handlers"
	"auth-service/internal/repositories"
	"auth-service/internal/routes"
	"auth-service/internal/services"
	"context"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	shareddb "shared/database"
	"shared/logger"
	"shared/middleware"
)

func main() {
	// ⚡ 1. Initialize Zap Structured JSON Logger
	logger.InitLogger()
	defer logger.Log.Sync()

	// 2. Load system environment variables
	cfg := config.LoadConfig()

	// 3. Connect to Neon PostgreSQL
	db, err := shareddb.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Initialization sequence aborted due to database connection loss: %v", err)
	}

	// 4. Run GORM schema migrations
	err = authdb.RunMigrations(db)
	if err != nil {
		log.Fatalf("Database schema migration sequence crashed: %v", err)
	}
	log.Println("Database table migrations verified and completed successfully")

	// ⚡ 5. Initialize Redis Client (Supports Upstash URI or Host:Port)
	var redisClient *redis.Client
	redisTarget := cfg.RedisAddr
	if redisTarget == "" {
		redisTarget = os.Getenv("REDIS_URL")
	}

	if strings.HasPrefix(redisTarget, "redis://") || strings.HasPrefix(redisTarget, "rediss://") {
		opt, err := redis.ParseURL(redisTarget)
		if err != nil {
			log.Printf("⚠️ Failed to parse Redis connection URI: %v", err)
			redisClient = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
		} else {
			redisClient = redis.NewClient(opt)
		}
	} else if redisTarget != "" {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     redisTarget,
			Password: "",
			DB:       0,
		})
	} else {
		redisClient = redis.NewClient(&redis.Options{
			Addr: "localhost:6379",
		})
	}

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Printf("⚠️ Warning: Redis session cache connection failed: %v. Continuing without cache fallback.", err)
	} else {
		log.Println("✅ Redis session cache connected successfully for OTP staging")
	}

	// 6. Initialize Data Architecture Layers
	userRepo := repositories.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, redisClient, cfg.JWTSecret)
	authHandler := handlers.NewAuthHandler(authService)

	// 7. Initialize Gin Web Framework Engine
	router := gin.New()

	// ⚡ 8. Register Middlewares
	router.Use(gin.Recovery())
	router.Use(logger.ZapLoggerMiddleware())
	router.Use(middleware.PrometheusMiddleware("auth-service"))

	// CORS Configuration
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// ⚡ 9. Expose Standard Prometheus Metrics Scraper Endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// 10. Bind routes
	routes.SetupRoutes(router, authHandler, db)

	// 11. Determine Port (Render injects PORT)
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.AppPort
	}
	if port == "" {
		port = "8001"
	}

	log.Printf("🚀 %s initialized successfully with Zap & Prometheus, listening on port :%s", cfg.AppName, port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to spin up the web routing cluster service listener: %v", err)
	}
}
