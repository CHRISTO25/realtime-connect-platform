package repository

import "chat-service/internal/model"

type ChatRepository interface {
	CreateRoom(room *model.Room) error
	GetOrCreateDefaultRoom(roomID string) (*model.Room, error)
	SaveMessage(msg *model.Message) error
	GetRoomMessages(roomID string, limit int) ([]model.Message, error)

	// ⚡ Day 22 Additions for Room Management
	CreateGroupRoom(room *model.Room, memberIDs []string) error
	GetUserRooms(userID string) ([]model.Room, error)
}
