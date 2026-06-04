package main

import (
	"auth-service/internal/routes"
	"github.com/gin-gonic/gin"
	"shared/logger"
	"shared/middleware"
)

func main() {

	router := gin.New()

	router.Use(
		logger.Logger(),
		middleware.Recovery(),
	)

	routes.SetupRoutes(router)

	router.Run(":8080")
}
