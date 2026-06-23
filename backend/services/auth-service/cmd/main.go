package main

import (
	"log"

	"auth-service/internal/config"
	authdb "auth-service/internal/database"
	"auth-service/internal/handlers"
	"auth-service/internal/repositories"
	"auth-service/internal/routes"
	"auth-service/internal/services"

	shareddb "shared/database"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load system environment variables (.env) into memory structures
	cfg := config.LoadConfig()

	// 2. Establish connection to your serverless Neon PostgreSQL cloud cluster
	// Safely capture the returned database pointer and error matrix to prevent silent failures
	db, err := shareddb.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Initialization sequence aborted due to database connection loss: %v", err)
	}

	// 3. Run GORM schema migrations for User and domain data blueprints
	err = authdb.RunMigrations(db)
	if err != nil {
		log.Fatalf("Database schema migration sequence crashed: %v", err)
	}
	log.Println("Database table migrations verified and completed successfully")

	// 4. Initialize Data Architecture Layers (Clean Architecture Dependency Injection)
	userRepo := repositories.NewUserRepository(db)

	// FIXED: Safely inject cfg.JWTSecret directly into the business service layer
	// This locks your login token issuance securely to your routing middleware parameters
	authService := services.NewAuthService(userRepo, cfg.JWTSecret)

	// Instantiates the delivery handler controller with its underlying business dependency
	authHandler := handlers.NewAuthHandler(authService)

	// 5. Initialize the Gin Web Framework Engine
	router := gin.Default()

	// High-Performance CORS Interceptor manages React frontend pre-flight OPTIONS handshakes cleanly
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 6. Bind delivery handlers and map your protected route configurations
	routes.SetupRoutes(router, authHandler)

	// 7. Start the active, blocking network server listener engine
	log.Printf("%s initialized successfully and listening on active port :%s", cfg.AppName, cfg.AppPort)
	if err := router.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("Failed to spin up the web routing cluster service listener: %v", err)
	}
}
