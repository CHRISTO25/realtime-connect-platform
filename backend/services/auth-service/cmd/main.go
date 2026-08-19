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

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9" // ⚡ Standard Redis package import
	shareddb "shared/database"
	"shared/logger"     // 👈 Shared Zap structured logger package
	"shared/middleware" // 👈 Shared Prometheus and logging middleware
)

func main() {
	// ⚡ 1. Initialize Zap Structured JSON Logger at the absolute beginning
	logger.InitLogger()
	defer logger.Log.Sync() // Flushes buffer logs before application shutdown

	// 2. Load system environment variables (.env) into memory structures
	cfg := config.LoadConfig()

	// 3. Establish connection to your serverless Neon PostgreSQL cloud cluster
	db, err := shareddb.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Initialization sequence aborted due to database connection loss: %v", err)
	}

	// 4. Run GORM schema migrations for User and domain data blueprints
	err = authdb.RunMigrations(db)
	if err != nil {
		log.Fatalf("Database schema migration sequence crashed: %v", err)
	}
	log.Println("Database table migrations verified and completed successfully")

	// ⚡ 5. Initialize Redis Client natively for Temporary OTP Staging
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: "", // No password by default in local Docker Redis
		DB:       0,  // Default DB
	})

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Redis session cache connection failed: %v", err)
	}
	log.Println("Redis session cache connected successfully for OTP staging")

	// 6. Initialize Data Architecture Layers (Clean Architecture Dependency Injection with Redis)
	userRepo := repositories.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, redisClient, cfg.JWTSecret)
	authHandler := handlers.NewAuthHandler(authService)

	// 7. Initialize the Gin Web Framework Engine (using gin.New() for complete middleware control)
	router := gin.New()

	// ⚡ 8. Register Global Standard & Production Middlewares
	router.Use(gin.Recovery())
	router.Use(logger.ZapLoggerMiddleware())                    // ⚡ DAY 43: Logs structured JSON + propagates X-Request-ID trace IDs
	router.Use(middleware.PrometheusMiddleware("auth-service")) // ⚡ DAY 42: Scrapes HTTP performance metrics

	// High-Performance CORS Interceptor manages React frontend pre-flight OPTIONS handshakes cleanly
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
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

	// 10. Bind delivery handlers, admin controllers, and map route configurations
	routes.SetupRoutes(router, authHandler, db)

	// 11. Start the active, blocking network server listener engine
	port := cfg.AppPort
	if port == "" {
		port = "8001"
	}

	log.Printf("🚀 %s initialized successfully with Zap & Prometheus, listening on port :%s", cfg.AppName, port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to spin up the web routing cluster service listener: %v", err)
	}
}
