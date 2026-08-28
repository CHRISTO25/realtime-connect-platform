package handlers

import (
	"auth-service/internal/model"
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"log"
	"net/http"
	"os"
	"shared/response"
	"strings"
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
	searchQuery := c.Query("query")
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

type BanRequest struct {
	IsBanned     bool       `json:"is_banned"`
	BanExpiresAt *time.Time `json:"ban_expires_at"`
}

func (h *AdminHandler) SetUserBanStatus(c *gin.Context) {
	userId := c.Param("id")
	var req BanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// 1. Explicitly fetch the target user model to guarantee a primary key match
	var targetUser model.User
	if err := h.db.Where("id = ? OR email = ?", userId, userId).First(&targetUser).Error; err != nil {
		log.Printf("[Admin Ban Error] User not found in auth 'users' table for identifier: %s", userId)
		response.Error(c, http.StatusNotFound, "Target user record not found in auth database")
		return
	}

	// 2. Use Model(&targetUser) to force GORM to update boolean and timestamp fields correctly
	result := h.db.Model(&targetUser).Updates(map[string]interface{}{
		"is_banned":      req.IsBanned,
		"ban_expires_at": req.BanExpiresAt,
		"updated_at":     time.Now(),
	})

	if result.Error != nil {
		log.Printf("[Admin Ban Error] Failed to update auth 'users' table for user ID %s: %v", targetUser.ID, result.Error)
		response.Error(c, http.StatusInternalServerError, "Failed to update auth users table ban configuration")
		return
	}

	log.Printf("[Admin Ban Success] Successfully updated %d row(s) in auth 'users' table for user ID: %s to IsBanned=%v",
		result.RowsAffected, targetUser.ID, req.IsBanned)

	// 3. Revoke active refresh tokens immediately to drop sessions
	if req.IsBanned {
		_ = h.db.Table("refresh_tokens").Where("user_id = ?", targetUser.ID).Updates(map[string]interface{}{"is_revoked": true}).Error
	}

	// 4. CROSS-SERVICE SYNC: Notify user-service to update 'user_profiles' table using targetUser.ID
	userServiceBase := os.Getenv("USER_SERVICE_URL")
	if userServiceBase == "" {
		userServiceBase = "http://user-service:8002"
	}
	userServiceBase = strings.TrimSuffix(userServiceBase, "/")

	syncURL := fmt.Sprintf("%s/api/v1/users/internal/admin/ban/%s", userServiceBase, targetUser.ID)
	payloadBytes, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(c.Request.Context(), "PATCH", syncURL, bytes.NewBuffer(payloadBytes))
	if err == nil {
		httpReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil {
			defer resp.Body.Close()
		}
	}

	response.Success(c, "User ban status updated across auth and profile records successfully", gin.H{
		"user_id":   targetUser.ID,
		"is_banned": req.IsBanned,
	})
}
