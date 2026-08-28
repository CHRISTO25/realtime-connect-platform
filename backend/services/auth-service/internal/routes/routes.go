package routes

import (
	"auth-service/internal/handlers"
	"auth-service/internal/middleware"
	"auth-service/internal/repositories" // 👈 Import auth service repository package
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"os"
	sharedMiddleware "shared/middleware"
)

func SetupRoutes(r *gin.Engine, authHandler *handlers.AuthHandler, db *gorm.DB) {
	jwtSecret := os.Getenv("JWT_SECRET")

	// ⚡ Initialize user repository to satisfy the new AuthMiddleware ban-check contract
	userRepo := repositories.NewUserRepository(db)

	v1 := r.Group("/api/v1/auth")
	{
		// Public open endpoints
		v1.POST("/register", authHandler.Register)
		v1.POST("/verify-email", authHandler.VerifyEmail)
		v1.POST("/login", authHandler.Login)
		v1.POST("/refresh", authHandler.Refresh)
	}

	// Protected Endpoints (Shielded by standard user JWT middleware + Live Ban Check)
	protected := r.Group("/api/v1/auth")
	protected.Use(sharedMiddleware.AuthMiddleware(jwtSecret, userRepo)) // 👈 Passed userRepo here!
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
