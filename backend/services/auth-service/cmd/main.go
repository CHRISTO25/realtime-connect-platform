package main

import (
	"log"

	"auth-service/internal/config"
	authdb "auth-service/internal/database"
	"auth-service/internal/repositories"
	"auth-service/internal/routes"
	"auth-service/internal/services"

	shareddb "shared/database"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load system environment variables (.env)
	cfg := config.LoadConfig()

	// 2. Establish connection to your Neon PostgreSQL cluster
	// Senior Fix: Safely capture the returned error to prevent application panic loops
	db, err := shareddb.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Initialization sequence aborted: %v", err)
	}

	// 3. Run GORM schema migrations for User and RefreshToken models
	err = authdb.RunMigrations(db)
	if err != nil {
		log.Fatalf("Database migration failed: %v", err)
	}
	log.Println("Migrations completed successfully")

	// 4. Initialize Data Architecture Layers (Dependency Injection)
	userRepo := repositories.NewUserRepository(db)
	authService := services.NewAuthService(userRepo)

	// 5. Initialize the Gin Web Framework Engine
	router := gin.Default()

	// CORS Middleware handles React frontend pre-flight OPTIONS requests cleanly
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

	// 6. Bind business handlers and register application routes
	// Note: Double check if your internal routes file uses SetupRoutes or SetupAuthRoutes
	routes.SetupRoutes(router, authService)

	// 7. Start the active, blocking network server engine
	log.Printf("%s started and listening on port :%s", cfg.AppName, cfg.AppPort)
	if err := router.Run(":" + cfg.AppPort); err != nil {
		log.Fatalf("Failed to spin up the auth service server: %v", err)
	}
}
