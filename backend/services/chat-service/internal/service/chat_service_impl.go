package service

import (
	"chat-service/internal/dto"
	"chat-service/internal/model"
	"chat-service/internal/repository"
)

type chatServiceImpl struct {
	repo repository.ChatRepository
}

func NewChatService(repo repository.ChatRepository) ChatService {
	return &chatServiceImpl{repo: repo}
}

func (s *chatServiceImpl) GetRoomHistory(roomID string, limit int) ([]dto.MessageResponse, error) {
	_, err := s.repo.GetOrCreateDefaultRoom(roomID)
	if err != nil {
		return nil, err
	}

	messages, err := s.repo.GetRoomMessages(roomID, limit)
	if err != nil {
		return nil, err
	}

	res := make([]dto.MessageResponse, len(messages))
	for i, msg := range messages {
		res[i] = dto.MessageResponse{
			ID:        msg.ID,
			RoomID:    msg.RoomID,
			SenderID:  msg.SenderID,
			Content:   msg.Content,
			CreatedAt: msg.CreatedAt,
		}
	}

	return res, nil
}

func (s *chatServiceImpl) SaveMessage(senderID, roomID, content string) (*dto.MessageResponse, error) {
	_, err := s.repo.GetOrCreateDefaultRoom(roomID)
	if err != nil {
		return nil, err
	}

	msg := &model.Message{
		RoomID:   roomID,
		SenderID: senderID,
		Content:  content,
	}

	if err := s.repo.SaveMessage(msg); err != nil {
		return nil, err
	}

	return &dto.MessageResponse{
		ID:        msg.ID,
		RoomID:    msg.RoomID,
		SenderID:  msg.SenderID,
		Content:   msg.Content,
		CreatedAt: msg.CreatedAt,
	}, nil
}

// ⚡ Day 22 Additions for Room Management

func (s *chatServiceImpl) CreateGroupRoom(room *model.Room, memberIDs []string) error {
	// Delegate creation and member linking down to the repository transactional layer
	return s.repo.CreateGroupRoom(room, memberIDs)
}

func (s *chatServiceImpl) GetUserRooms(userID string) ([]model.Room, error) {
	// Fetch all custom group rooms and public channels mapped to this user
	return s.repo.GetUserRooms(userID)
}
