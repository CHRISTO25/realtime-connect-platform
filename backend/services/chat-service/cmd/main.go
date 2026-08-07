package main

import (
	"fmt"
	"log"
	"os"

	"shared/database"

	"chat-service/internal/handler"
	"chat-service/internal/model"
	"chat-service/internal/repository"
	"chat-service/internal/routes"
	"chat-service/internal/service"
	"chat-service/websocket"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// 🟢 CORS Middleware to handle Preflight OPTIONS requests
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
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

	// ⚡ FIX: Added &model.RoomMember{} to AutoMigrate
	if err := db.AutoMigrate(&model.Room{}, &model.RoomMember{}, &model.Message{}); err != nil {
		log.Fatalf("Fatal: Database migration failed: %v", err)
	}

	chatRepo := repository.NewChatRepository(db)
	chatService := service.NewChatService(chatRepo)

	manager := websocket.NewManager()
	go manager.Run()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super_secret_jwt_key_12345"
	}

	chatHandler := handler.NewChatHandler(jwtSecret, manager, chatService)

	router := gin.Default()

	// 🟢 Attach CORS middleware to Gin
	router.Use(CORS())

	routes.SetupRoutes(router, chatHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8003"
	}

	log.Printf("🚀 [Chat Service] Realtime Engine listening on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Fatal: Chat Service server failed to start: %v", err)
	}
}
