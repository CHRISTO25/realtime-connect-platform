package routes

import (
	"auth-service/internal/handlers"
	"auth-service/internal/services"

	"github.com/gin-gonic/gin"
)

// SetupRoutes now accepts the AuthService dependency to pass down to the handler layer
func SetupRoutes(router *gin.Engine, authService services.AuthService) {

	// Initialize the handler struct with its required service dependency
	authHandler := handlers.NewAuthHandler(authService)

	// Update to use the method instance instead of package-level functions
	router.GET("/health", authHandler.HealthCheck)

	v1 := router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}
	}
}
