package handlers

import (
	"github.com/gin-gonic/gin"
	"shared/response"
)

func HealthCheck(c *gin.Context) {

	response.Success(
		c,
		"Service healthy",
		gin.H{
			"service": "auth-service",
		},
	)
}

func Register(c *gin.Context) {

	response.Success(
		c,
		"Register endpoint working",
		nil,
	)
}

func Login(c *gin.Context) {

	response.Success(
		c,
		"Login endpoint working",
		nil,
	)
}
