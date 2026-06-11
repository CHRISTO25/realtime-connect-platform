package handlers

import (
	"auth-service/internal/dto"
	"auth-service/internal/services" // Make sure this path matches your service layer
	"errors"
	"net/http"
	"shared/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService services.AuthService
}

// NewAuthHandler initializes the handler with its required dependencies
func NewAuthHandler(service services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: service,
	}
}

func (h *AuthHandler) HealthCheck(c *gin.Context) {
	response.Success(
		c,
		"Service healthy",
		gin.H{
			"service": "auth-service",
		},
	)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest

	// 1. Validate incoming JSON against your DTO binding tags
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(
			c,
			http.StatusBadRequest,
			err.Error(),
		)
		return
	}

	// 2. Call the service layer to handle business logic (GORM, Bcrypt, Duplicate checks)
	res, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		// Catch duplicate email conflict
		if errors.Is(err, services.ErrEmailAlreadyExists) {
			response.Error(
				c,
				http.StatusConflict,
				err.Error(),
			)
			return
		}

		// Catch any other unexpected internal errors (DB down, hashing failure, etc.)
		response.Error(
			c,
			http.StatusInternalServerError,
			"Internal server error occurred",
		)
		return
	}

	// 3. Return the registered user response via your shared response utility
	response.Success(
		c,
		"User registered successfully",
		res,
	)
}

func (h *AuthHandler) Login(c *gin.Context) {
	response.Success(
		c,
		"Login endpoint working",
		nil,
	)
}
