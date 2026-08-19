package handler

import (
	"net/http"
	"os"

	"shared.local/jwt"
	"shared.local/response"

	"chat-service/internal/dto"
	"chat-service/internal/model"
	"chat-service/internal/service"
	"chat-service/internal/utils"
	"chat-service/websocket"

	"github.com/gin-gonic/gin"
	gorillaWS "github.com/gorilla/websocket"
)

type ChatHandler struct {
	jwtSecret   string
	manager     *websocket.Manager
	chatService service.ChatService
	userClient  *utils.UserServiceClient // ⚡ Day 35: Inter-service REST client
	nodeID      string
}

func NewChatHandler(
	jwtSecret string,
	manager *websocket.Manager,
	chatService service.ChatService,
	userClient *utils.UserServiceClient,
) *ChatHandler {
	nodeID := os.Getenv("NODE_ID")
	if nodeID == "" {
		nodeID = "chat-node-primary"
	}

	return &ChatHandler{
		jwtSecret:   jwtSecret,
		manager:     manager,
		chatService: chatService,
		userClient:  userClient,
		nodeID:      nodeID,
	}
}

var upgrader = gorillaWS.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (h *ChatHandler) ServeWS(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		response.Error(c, http.StatusUnauthorized, "Missing authentication token")
		return
	}

	claims, err := jwt.ValidateToken(token, h.jwtSecret)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "Invalid token claims")
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &websocket.Client{
		Manager:     h.manager,
		Conn:        conn,
		UserID:      claims.UserID,
		Send:        make(chan []byte, 256),
		ChatService: h.chatService,
	}

	h.manager.Register <- client

	go client.WritePump()
	go client.ReadPump()
}

// ⚡ Day 38 / Gateway Health Check Endpoint
func (h *ChatHandler) HealthCheck(c *gin.Context) {
	onlineCount := 0
	var onlineUsers []string

	if h.manager != nil {
		onlineCount = len(h.manager.Clients)
		onlineUsers = h.manager.GetOnlineUsers()
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "UP",
		"service":      "chat-service",
		"node_id":      h.nodeID,
		"online_count": onlineCount,
		"online_users": onlineUsers,
	})
}

// ⚡ Day 35: Inter-Service Room Details with Graceful Degradation
// GET /api/v1/chat/room/:userId
func (h *ChatHandler) GetRoomDetails(c *gin.Context) {
	targetUserID := c.Param("userId")
	if targetUserID == "" {
		response.Error(c, http.StatusBadRequest, "User ID parameter is mandatory")
		return
	}

	// Make internal synchronous call to user-service with 2s circuit timeout
	profile, _ := h.userClient.GetUserProfile(c.Request.Context(), targetUserID)

	resp := dto.RoomDetailsResponse{
		RoomID:      "room_" + targetUserID,
		Participant: profile,
		Degraded:    profile.IsDegraded,
	}

	response.Success(c, "Room details loaded", resp)
}

func (h *ChatHandler) GetRoomHistory(c *gin.Context) {
	roomID := c.Param("room_id")
	if roomID == "" {
		roomID = "00000000-0000-0000-0000-000000000001"
	}

	res, err := h.chatService.GetRoomHistory(roomID, 50)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to load room message history")
		return
	}

	response.Success(c, "Room history retrieved", res)
}

// CreateGroupRoom handles POST /api/v1/chat/rooms
func (h *ChatHandler) CreateGroupRoom(c *gin.Context) {
	var req dto.CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	room := &model.Room{
		Name: req.Name,
		Type: model.RoomTypeGroup,
	}

	err := h.chatService.CreateGroupRoom(room, req.MemberIDs)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to create group room")
		return
	}

	response.Success(c, "Group room created successfully", room)
}

// GetUserRooms handles GET /api/v1/chat/rooms/:user_id
func (h *ChatHandler) GetUserRooms(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		response.Error(c, http.StatusBadRequest, "Missing user ID parameter")
		return
	}

	rooms, err := h.chatService.GetUserRooms(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to fetch user rooms")
		return
	}

	response.Success(c, "User rooms fetched", rooms)
}
