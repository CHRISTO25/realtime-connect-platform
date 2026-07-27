package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"shared/database"
	"user-service/internal/handler"
	"user-service/internal/media"
	"user-service/internal/model"
	"user-service/internal/repository"
	"user-service/internal/routes"
	"user-service/internal/service"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
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

	log.Println("Starting User Service ignition pipeline...")

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

	// Auto-migrate Day 11 BlockedUser model
	log.Println("Running GORM schema migrations...")
	err = db.AutoMigrate(
		&model.UserProfile{},
		&model.FriendRequest{},
		&model.Friend{},
		&model.BlockedUser{}, // ◄ DAY 11 Table
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

	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	router.Use(CORSMiddleware())
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "UP",
			"timestamp": time.Now().Format(time.RFC3339),
			"service":   "user-service",
		})
	})

	routes.SetupRoutes(router, userHandler, friendHandler, blockHandler, jwtSecret)

	serverAddr := fmt.Sprintf(":%s", port)
	log.Printf("User Service online and listening on port %s 🚀", port)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Fatal: Server initialization crashed on %s: %v", serverAddr, err)
	}
}
