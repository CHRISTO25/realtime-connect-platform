package handler

import (
	"net/http"
	"user-service/internal/service"

	"github.com/gin-gonic/gin"
)

type BlockHandler struct {
	blockService service.BlockService
}

func NewBlockHandler(blockService service.BlockService) *BlockHandler {
	return &BlockHandler{blockService: blockService}
}

// POST /api/v1/users/block/:id
func (h *BlockHandler) BlockUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}

	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Target user ID parameter is required"})
		return
	}

	if err := h.blockService.BlockUser(c.Request.Context(), userID.(string), targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "User blocked successfully"})
}

// DELETE /api/v1/users/block/:id
func (h *BlockHandler) UnblockUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}

	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Target user ID parameter is required"})
		return
	}

	if err := h.blockService.UnblockUser(c.Request.Context(), userID.(string), targetID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "User unblocked successfully"})
}

// GET /api/v1/users/block/list
func (h *BlockHandler) GetBlockedList(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}

	list, err := h.blockService.GetBlockedList(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

// GET /api/v1/users/block/ids
func (h *BlockHandler) GetBlockedIDs(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized request"})
		return
	}

	ids, err := h.blockService.GetBlockedIDs(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ids})
}
