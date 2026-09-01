package main

import (
	"auth-service/internal/config"
	authdb "auth-service/internal/database"
	"auth-service/internal/handlers"
	"auth-service/internal/repositories"
	"auth-service/internal/routes"
	"auth-service/internal/services"
	"context"
	"crypto/tls"
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	shareddb "shared/database"
	"shared/logger"
	"shared/middleware"
)

func main() {
	// ⚡ 0. Load .env file if present
	_ = godotenv.Load()

	// 1. Initialize Zap Structured JSON Logger
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

	// ⚡ 5. Initialize Redis Client with explicit TLS for Upstash
	redisTarget := os.Getenv("REDIS_URL")
	if redisTarget == "" {
		redisTarget = cfg.RedisAddr
	}

	var redisClient *redis.Client
	if strings.HasPrefix(redisTarget, "redis://") || strings.HasPrefix(redisTarget, "rediss://") {
		opt, err := redis.ParseURL(redisTarget)
		if err != nil {
			log.Printf("⚠️ Failed to parse Redis URI: %v", err)
		} else {
			if strings.HasPrefix(redisTarget, "rediss://") {
				opt.TLSConfig = &tls.Config{
					MinVersion: tls.VersionTLS12,
				}
			}
			redisClient = redis.NewClient(opt)
		}
	}

	if redisClient == nil {
		redisClient = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	}

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Printf("🔴 [Redis Error] Session cache ping failed: %v", err)
	} else {
		log.Println("🟢 [Redis Success] Upstash cache connected and verified")
	}

	// 6. Initialize Data Architecture Layers
	userRepo := repositories.NewUserRepository(db)
	authService := services.NewAuthService(userRepo, redisClient, cfg.JWTSecret)
	authHandler := handlers.NewAuthHandler(authService)

	// 7. Initialize Gin Web Framework Engine
	router := gin.New()

	// 8. Register Middlewares
	router.Use(gin.Recovery())
	router.Use(logger.ZapLoggerMiddleware())
	router.Use(middleware.PrometheusMiddleware("auth-service"))

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

	// 9. Metrics Endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// 10. Bind routes
	routes.SetupRoutes(router, authHandler, db)

	// 11. Determine Port
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.AppPort
	}
	if port == "" {
		port = "8001"
	}

	log.Printf("🚀 %s listening on port :%s", cfg.AppName, port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Server crash: %v", err)
	}
}
