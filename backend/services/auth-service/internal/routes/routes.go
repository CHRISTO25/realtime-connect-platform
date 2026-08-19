package routes

import (
	"auth-service/internal/handlers"
	"auth-service/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"os"
	sharedMiddleware "shared/middleware"
)

func SetupRoutes(r *gin.Engine, authHandler *handlers.AuthHandler, db *gorm.DB) {
	jwtSecret := os.Getenv("JWT_SECRET")

	v1 := r.Group("/api/v1/auth")
	{
		// Public open endpoints
		v1.POST("/register", authHandler.Register)
		v1.POST("/verify-email", authHandler.VerifyEmail) // ⚡ NEW: Email Verification Route
		v1.POST("/login", authHandler.Login)
		v1.POST("/refresh", authHandler.Refresh)
	}

	// Protected Endpoints (Shielded by standard user JWT middleware)
	protected := r.Group("/api/v1/auth")
	protected.Use(sharedMiddleware.AuthMiddleware(jwtSecret))
	{
		protected.GET("/me", authHandler.GetMe)
		protected.POST("/logout", authHandler.Logout)
	}

	// 👑 Admin Restricted Endpoints (Requires role == "admin")
	adminHandler := handlers.NewAdminHandler(db)
	adminGroup := r.Group("/api/v1/admin")
	adminGroup.Use(middleware.AdminMiddleware(jwtSecret))
	{
		adminGroup.GET("/users", adminHandler.GetUsersDirectory)
		adminGroup.PATCH("/users/:id/ban", adminHandler.SetUserBanStatus)
	}
}
