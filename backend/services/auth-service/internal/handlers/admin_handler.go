package handlers

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
	"shared/response"
	"time"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// GET /api/v1/admin/users?query=developer101
func (h *AdminHandler) GetUsersDirectory(c *gin.Context) {
	searchQuery := c.Query("query") // Can be ID, username, or email
	var users []map[string]interface{}

	query := h.db.Table("users").Select("id, username, email, role, is_verified, is_banned, ban_expires_at, created_at")

	if searchQuery != "" {
		likePattern := "%" + searchQuery + "%"
		query = query.Where("id = ? OR username ILIKE ? OR email ILIKE ?", searchQuery, likePattern, likePattern)
	}

	if err := query.Find(&users).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to fetch user directory")
		return
	}

	response.Success(c, "Users fetched successfully", users)
}

// PATCH /api/v1/admin/users/:id/ban
type BanRequest struct {
	IsBanned     bool       `json:"is_banned"`
	BanExpiresAt *time.Time `json:"ban_expires_at"` // Pass null for permanent, or a future timestamp for temporary
}

func (h *AdminHandler) SetUserBanStatus(c *gin.Context) {
	userId := c.Param("id")
	var req BanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	updates := map[string]interface{}{
		"is_banned":      req.IsBanned,
		"ban_expires_at": req.BanExpiresAt,
	}

	if err := h.db.Table("users").Where("id = ?", userId).Updates(updates).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to update ban configuration")
		return
	}

	// Instantly invalidate active refresh tokens if banned
	if req.IsBanned {
		h.db.Table("refresh_tokens").Where("user_id = ?", userId).Update("is_revoked", true)
	}

	response.Success(c, "User status updated successfully", gin.H{"user_id": userId, "is_banned": req.IsBanned})
}
