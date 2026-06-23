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

// Login handles POST /api/v1/auth/login
// Senior Refactor: Standardized to use your shared response engine cleanly
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest

	// 1. Bind and validate the JSON body format structurally
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(
			c,
			http.StatusBadRequest,
			"Invalid request payload format",
		)
		return
	}

	// 2. Execute cloud database verification through the service layer
	res, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		// Handle specific credentials mismatch using standard 401 Unauthorized status
		if errors.Is(err, services.ErrInvalidCredentials) {
			response.Error(
				c,
				http.StatusUnauthorized,
				err.Error(),
			)
			return
		}

		// Handle fallback DB errors cleanly without leaking critical context logs
		response.Error(
			c,
			http.StatusInternalServerError,
			"An unexpected database error occurred",
		)
		return
	}

	// 3. Output the successfully minted string-UUID token payload
	response.Success(
		c,
		"Login successful",
		res,
	)
}

// GetMe handles GET /api/v1/auth/me
func (h *AuthHandler) GetMe(c *gin.Context) {
	// Grab the string-UUID user_id that was safely extracted by your shared middleware
	userID, exists := c.Get("user_id")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "Context user unauthorized")
		return
	}

	// Dispatch request context down through to your business logic layer
	res, err := h.authService.GetProfile(c.Request.Context(), userID.(string))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "User profile retrieved successfully", res)
}
