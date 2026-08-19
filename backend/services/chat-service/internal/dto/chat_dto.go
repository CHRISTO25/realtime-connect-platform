package dto

import (
	"chat-service/internal/utils"
	"time"
)

type MessageResponse struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	SenderID  string    `json:"sender_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type SendMessageRequest struct {
	RoomID  string `json:"room_id" binding:"required"`
	Content string `json:"content" binding:"required,min=1"`
}

type CreateGroupRequest struct {
	Name      string   `json:"name" binding:"required,min=2"`
	MemberIDs []string `json:"member_ids" binding:"required"`
}

type RoomDetailsResponse struct {
	RoomID      string                     `json:"room_id"`
	Participant *utils.UserProfileFallback `json:"participant"`
	Degraded    bool                       `json:"degraded"`
}
