package handlers

import (
	"auth-service/internal/dto"
	"auth-service/internal/services"
	"errors"
	"log"
	"net/http"
	"shared/response"

	"github.com/gin-gonic/gin"
)

// AuthHandler serves as the HTTP entry point (Controller) for authentication endpoints.
// Its sole job is to translate incoming HTTP requests into service calls and map outputs to JSON.
type AuthHandler struct {
	authService services.AuthService
}

// NewAuthHandler injects the business logic dependency (AuthService) into the handler layer.
func NewAuthHandler(service services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: service,
	}
}

// HealthCheck handles GET /health - Used by load balancers and orchestrators to check service availability.
func (h *AuthHandler) HealthCheck(c *gin.Context) {
	response.Success(
		c,
		"Service healthy",
		gin.H{
			"service": "auth-service",
		},
	)
}

// Register handles POST /api/v1/auth/register
// Story: Validates payload -> calls service layer to create user and trigger profile sync -> responds with outcome.
func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest

	// Step 1: Parse and validate JSON request body
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(
			c,
			http.StatusBadRequest,
			err.Error(),
		)
		return
	}

	// Step 2: Delegate user registration and profile sync execution to the service layer.
	res, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		// Handle business domain errors specifically.
		if errors.Is(err, services.ErrEmailAlreadyExists) {
			response.Error(
				c,
				http.StatusConflict,
				err.Error(),
			)
			return
		}

		// Catch unhandled internal failures and log them
		log.Printf("[Register Error]: %v", err)

		// 🔑 PASS ACTUAL ERROR TO CLIENT SO WE CAN DIAGNOSE IT IMMEDIATELY
		response.Error(
			c,
			http.StatusInternalServerError,
			err.Error(),
		)
		return
	}

	// Step 3: Respond with 200/201 OK and formatted user data.
	response.Success(
		c,
		"User registered successfully",
		res,
	)
}

// Login handles POST /api/v1/auth/login
// Story: Validates credentials -> generates access/refresh JWT tokens -> saves refresh session -> returns tokens.
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest

	// Step 1: Validate payload format.
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(
			c,
			http.StatusBadRequest,
			"Invalid request payload format",
		)
		return
	}

	// Step 2: Authenticate user credentials and mint JWT session pair.
	res, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			response.Error(
				c,
				http.StatusUnauthorized,
				err.Error(),
			)
			return
		}

		log.Printf("[Login Error]: %v", err)
		response.Error(
			c,
			http.StatusInternalServerError,
			"An unexpected database error occurred",
		)
		return
	}

	// Step 3: Return access and refresh tokens.
	response.Success(
		c,
		"Login successful",
		res,
	)
}

// GetMe handles GET /api/v1/auth/me
// Story: Fetches the authenticated user's credentials using the user_id injected by AuthMiddleware.
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "Context user unauthorized")
		return
	}

	res, err := h.authService.GetProfile(c.Request.Context(), userID.(string))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "User profile retrieved successfully", res)
}

// Refresh handles POST /api/v1/auth/refresh
// Story: Rotates expired access tokens using a valid refresh token (Token Reuse Protection enabled).
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request body parameters")
		return
	}

	res, err := h.authService.RefreshSession(c.Request.Context(), req)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, err.Error())
		return
	}

	response.Success(c, "Tokens rotated successfully", res)
}

// Logout handles POST /api/v1/auth/logout
// Story: Revokes all stored refresh tokens for the active user session.
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Error(c, http.StatusUnauthorized, "User session state missing")
		return
	}

	err := h.authService.Logout(c.Request.Context(), userID.(string))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to terminate user session")
		return
	}

	response.Success(c, "Logged out successfully from all devices", nil)
}
