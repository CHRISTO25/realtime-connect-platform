package handler

import (
	"log"
	"net/http"
	"strconv"
	"user-service/internal/dto"
	"user-service/internal/service"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService service.UserService
}

func NewUserHandler(userService service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

type InitProfileRequest struct {
	UserID      string `json:"user_id" binding:"required"`
	DisplayName string `json:"display_name" binding:"required"`
}

// 1. Internal Profile Initialization Bridge
func (h *UserHandler) InitProfile(c *gin.Context) {
	var req InitProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[InitProfile BAD REQUEST]: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid JSON payload: " + err.Error(),
		})
		return
	}

	if err := h.userService.InitProfile(c.Request.Context(), req.UserID, req.DisplayName); err != nil {
		log.Printf("[InitProfile DB ERROR]: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create profile: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Profile initialized successfully",
	})
}

// 2. GET /api/v1/users/profile/:id
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "User ID parameter is required",
		})
		return
	}

	res, err := h.userService.GetProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Profile not found: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// 3. PUT /api/v1/users/profile
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	// Extract current user ID set by AuthMiddleware
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized request: missing user claims",
		})
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid payload: " + err.Error(),
		})
		return
	}

	res, err := h.userService.UpdateProfile(c.Request.Context(), userID.(string), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update profile: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

// 4. GET /api/v1/users/allProfile
func (h *UserHandler) GetallUsers(c *gin.Context) {
	userID, _ := c.Get("userID")
	currentUserID, _ := userID.(string)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "10"))

	res, err := h.userService.GetAllProfiles(c.Request.Context(), currentUserID, page, perPage)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve profiles: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}

func (h *UserHandler) UploadAvatar(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Missing 'avatar' image file"})
		return
	}

	res, err := h.userService.UploadAvatar(c.Request.Context(), userID.(string), file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to upload avatar: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Avatar uploaded successfully", "data": res})
}

func (h *UserHandler) UploadCover(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	file, err := c.FormFile("cover")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Missing 'cover' image file"})
		return
	}

	res, err := h.userService.UploadCover(c.Request.Context(), userID.(string), file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to upload cover: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Cover photo uploaded successfully", "data": res})
}

// GET /api/v1/users/search
func (h *UserHandler) SearchUsers(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}

	var req dto.SearchUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid query parameters"})
		return
	}

	res, err := h.userService.SearchUsers(c.Request.Context(), userID.(string), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": res})
}

// POST /api/v1/users/logout
func (h *UserHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	// ⚡ Mark user as offline in database upon sign-out
	if err := h.userService.UpdateStatus(c.Request.Context(), userID.(string), false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Logged out successfully"})
}

// POST /api/v1/users/heartbeat
func (h *UserHandler) Heartbeat(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	// Sets is_online = true and updates last_seen = NOW()
	if err := h.userService.UpdateStatus(c.Request.Context(), userID.(string), true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// POST /api/v1/users/presence/offline (Called by navigator.sendBeacon when closing tab)
func (h *UserHandler) MarkOffline(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		// If sent via Beacon token parameter or query fallback
		userID = c.Query("user_id")
	}

	if userID != "" {
		_ = h.userService.UpdateStatus(c.Request.Context(), userID.(string), false)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
