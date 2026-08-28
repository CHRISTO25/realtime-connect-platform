package handler

import (
	"log"
	"net/http"
	"strconv"
	"time"
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
	Email       string `json:"email"`
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

	if err := h.userService.InitProfile(c.Request.Context(), req.UserID, req.DisplayName, req.Email); err != nil {
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

// 1.5. Internal User Status Bridge for API Gateway Live Ban Checks
func (h *UserHandler) GetInternalUserStatus(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Missing user_id query parameter",
		})
		return
	}

	profile, err := h.userService.GetProfile(c.Request.Context(), userID)
	if err != nil || profile == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Operator record not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"is_banned": profile.IsBanned,
			"role":      profile.Role,
		},
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
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized request: missing user claims",
		})
		return
	}
	userID, ok := val.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Invalid user context type"})
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

	res, err := h.userService.UpdateProfile(c.Request.Context(), userID, req)
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
	var currentUserID string
	if val, exists := c.Get("userID"); exists {
		if idStr, ok := val.(string); ok {
			currentUserID = idStr
		}
	}

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
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	userID := val.(string)

	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Missing 'avatar' image file"})
		return
	}

	res, err := h.userService.UploadAvatar(c.Request.Context(), userID, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to upload avatar: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Avatar uploaded successfully", "data": res})
}

func (h *UserHandler) UploadCover(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	userID := val.(string)

	file, err := c.FormFile("cover")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Missing 'cover' image file"})
		return
	}

	res, err := h.userService.UploadCover(c.Request.Context(), userID, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to upload cover: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Cover photo uploaded successfully", "data": res})
}

// GET /api/v1/users/search
func (h *UserHandler) SearchUsers(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}
	userID := val.(string)

	var req dto.SearchUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid query parameters"})
		return
	}

	res, err := h.userService.SearchUsers(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": res})
}

// POST /api/v1/users/logout
func (h *UserHandler) Logout(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	userID := val.(string)

	if err := h.userService.UpdateStatus(c.Request.Context(), userID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Logged out successfully"})
}

// POST /api/v1/users/heartbeat
func (h *UserHandler) Heartbeat(c *gin.Context) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}
	userID := val.(string)

	if err := h.userService.UpdateStatus(c.Request.Context(), userID, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// POST /api/v1/users/presence/offline
func (h *UserHandler) MarkOffline(c *gin.Context) {
	var targetUserID string
	if val, exists := c.Get("userID"); exists {
		if idStr, ok := val.(string); ok {
			targetUserID = idStr
		}
	}
	if targetUserID == "" {
		targetUserID = c.Query("user_id")
	}

	if targetUserID != "" {
		_ = h.userService.UpdateStatus(c.Request.Context(), targetUserID, false)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GET /api/v1/admin/users
func (h *UserHandler) AdminGetUsers(c *gin.Context) {
	query := c.DefaultQuery("query", "")

	profiles, err := h.userService.AdminGetAllUsers(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch user directory: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    profiles,
	})
}

type BanRequest struct {
	IsBanned     bool       `json:"is_banned"`
	BanExpiresAt *time.Time `json:"ban_expires_at"` // Matched with auth-service structure
}

// PATCH /api/v1/admin/users/:id/ban
func (h *UserHandler) AdminToggleBan(c *gin.Context) {
	targetID := c.Param("id")
	var req BanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid payload format"})
		return
	}

	err := h.userService.AdminSetUserBanStatus(c.Request.Context(), targetID, req.IsBanned)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update ban status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User status modified successfully",
	})
}

// INTERNAL BRIDGE: Syncs ban status changes from auth-service directly into user-service profile table
func (h *UserHandler) AdminInternalToggleBan(c *gin.Context) {
	targetID := c.Param("id")
	var req struct {
		IsBanned bool `json:"is_banned"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid payload format"})
		return
	}

	err := h.userService.AdminSetUserBanStatus(c.Request.Context(), targetID, req.IsBanned)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to sync profile ban status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Internal profile ban status synchronized successfully",
	})
}
