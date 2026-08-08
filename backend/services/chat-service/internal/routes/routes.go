package routes

import (
	"chat-service/internal/handler"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, chatHandler *handler.ChatHandler) {
	// REST API endpoints for monitoring, historical data retrieval, room management, and cloud uploads
	api := router.Group("/api/v1/chat")
	{
		api.GET("/health", chatHandler.HealthCheck)
		api.GET("/history/:room_id", chatHandler.GetRoomHistory)

		// Group Room Creation & User Room Fetching
		api.POST("/rooms", chatHandler.CreateGroupRoom)
		api.GET("/rooms/:user_id", chatHandler.GetUserRooms)

		// ⚡ DAY 27/28 Addition: Cloudinary Multipart File Upload Endpoint
		api.POST("/upload", chatHandler.UploadFile)
	}

	// ⚡ Persistent WebSocket Protocol Handshake Endpoint
	router.GET("/ws", chatHandler.ServeWS)
}
