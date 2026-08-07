package routes

import (
	"chat-service/internal/handler"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, chatHandler *handler.ChatHandler) {
	// REST API endpoints for monitoring, historical data retrieval, and room management
	api := router.Group("/api/v1/chat")
	{
		api.GET("/health", chatHandler.HealthCheck)
		api.GET("/history/:room_id", chatHandler.GetRoomHistory)

		// ⚡ Day 22 Additions: Group Room Creation & User Room Fetching
		api.POST("/rooms", chatHandler.CreateGroupRoom)
		api.GET("/rooms/:user_id", chatHandler.GetUserRooms)
	}

	// ⚡ Persistent WebSocket Protocol Handshake Endpoint
	router.GET("/ws", chatHandler.ServeWS)
}
