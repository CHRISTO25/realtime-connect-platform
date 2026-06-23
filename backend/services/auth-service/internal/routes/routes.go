package routes

import (
	"auth-service/internal/handlers"
	"github.com/gin-gonic/gin"
	"os"
	"shared/middleware" // Imports your shared interceptor package
)

func SetupRoutes(r *gin.Engine, authHandler *handlers.AuthHandler) {
	v1 := r.Group("/api/v1/auth")

	// Public open endpoints
	v1.POST("/register", authHandler.Register)
	v1.POST("/login", authHandler.Login)

	// Protected Endpoints (Shielded by Day 6 Shared Middleware)
	protected := r.Group("/api/v1/auth")
	protected.Use(middleware.AuthMiddleware(os.Getenv("JWT_SECRET")))
	{
		protected.GET("/me", authHandler.GetMe)
	}
}
