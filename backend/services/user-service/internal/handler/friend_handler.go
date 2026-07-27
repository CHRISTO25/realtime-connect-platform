package handler

import (
	"net/http"
	"user-service/internal/dto"
	"user-service/internal/service"

	"github.com/gin-gonic/gin"
)

type FriendHandler struct {
	friendService service.FriendService
}

func NewFriendHandler(friendService service.FriendService) *FriendHandler {
	return &FriendHandler{friendService: friendService}
}

// POST /api/v1/users/friends/request
func (h *FriendHandler) SendRequest(c *gin.Context) {
	userID, _ := c.Get("userID")
	var req dto.SendFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	if err := h.friendService.SendRequest(c.Request.Context(), userID.(string), req.ReceiverID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Friend request sent successfully"})
}

// POST /api/v1/users/friends/accept
func (h *FriendHandler) AcceptRequest(c *gin.Context) {
	userID, _ := c.Get("userID")
	var req dto.RespondFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid payload"})
		return
	}

	if err := h.friendService.AcceptRequest(c.Request.Context(), userID.(string), req.RequestID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Friend request accepted"})
}

// POST /api/v1/users/friends/reject
func (h *FriendHandler) RejectRequest(c *gin.Context) {
	userID, _ := c.Get("userID")
	var req dto.RespondFriendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid payload"})
		return
	}

	if err := h.friendService.RejectRequest(c.Request.Context(), userID.(string), req.RequestID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Friend request rejected"})
}

// GET /api/v1/users/friends/pending
func (h *FriendHandler) GetPendingRequests(c *gin.Context) {
	userID, _ := c.Get("userID")
	res, err := h.friendService.GetPendingRequests(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": res})
}

// GET /api/v1/users/friends/list
func (h *FriendHandler) GetFriendsList(c *gin.Context) {
	userID, _ := c.Get("userID")
	friends, err := h.friendService.GetFriendsList(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": friends})
}

// POST /api/v1/users/friends/unfriend
func (h *FriendHandler) Unfriend(c *gin.Context) {
	userID, _ := c.Get("userID")
	var req struct {
		FriendID string `json:"friend_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Missing friend_id"})
		return
	}

	if err := h.friendService.Unfriend(c.Request.Context(), userID.(string), req.FriendID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Unfriended successfully"})
}
