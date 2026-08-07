package service

import (
	"chat-service/internal/dto"
	"chat-service/internal/model"
)

type ChatService interface {
	GetRoomHistory(roomID string, limit int) ([]dto.MessageResponse, error)
	SaveMessage(senderID, roomID, content string) (*dto.MessageResponse, error)

	// ⚡ Day 22 Additions for Room Management
	CreateGroupRoom(room *model.Room, memberIDs []string) error
	GetUserRooms(userID string) ([]model.Room, error)
}
