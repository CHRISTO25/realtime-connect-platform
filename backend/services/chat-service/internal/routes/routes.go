package routes

import (
	"chat-service/internal/handler"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, chatHandler *handler.ChatHandler) {
	// ⚡ Top-level Health Check for Gateway Load Balancer Probes
	router.GET("/health", chatHandler.HealthCheck)

	// REST API endpoints for monitoring, history, inter-service sync, room management, and cloud uploads
	api := router.Group("/api/v1/chat")
	{
		api.GET("/health", chatHandler.HealthCheck)
		api.GET("/history/:room_id", chatHandler.GetRoomHistory)

		// ⚡ DAY 35 Addition: Inter-Service Profile Lookup & Room Details
		api.GET("/room/:userId", chatHandler.GetRoomDetails)

		// Group Room Creation & User Room Fetching
		api.POST("/rooms", chatHandler.CreateGroupRoom)
		api.GET("/rooms/:user_id", chatHandler.GetUserRooms)

		// ⚡ Cloudinary Multipart File Upload Endpoint
		api.POST("/upload", chatHandler.UploadFile)
	}

	// ⚡ Persistent WebSocket Protocol Handshake Endpoint
	router.GET("/ws", chatHandler.ServeWS)
}
