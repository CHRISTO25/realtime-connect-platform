package service

import (
	"context"
	"errors"
	"time"
	"user-service/internal/dto"
	"user-service/internal/model"
	"user-service/internal/repository"
)

type FriendServiceImpl struct {
	repo repository.FriendRepository
}

func NewFriendService(repo repository.FriendRepository) FriendService {
	return &FriendServiceImpl{repo: repo}
}

func (s *FriendServiceImpl) SendRequest(ctx context.Context, senderID, receiverID string) error {
	if senderID == receiverID {
		return errors.New("cannot send friend request to yourself")
	}

	alreadyFriends, err := s.repo.IsFriend(ctx, senderID, receiverID)
	if err != nil {
		return err
	}
	if alreadyFriends {
		return errors.New("you are already friends with this user")
	}

	existing, err := s.repo.FindExistingRequest(ctx, senderID, receiverID)
	if err != nil {
		return err
	}
	if existing != nil {
		return errors.New("a pending friend request already exists between you two")
	}

	req := &model.FriendRequest{
		SenderID:   senderID,
		ReceiverID: receiverID,
		Status:     model.RequestStatusPending,
	}
	return s.repo.SendRequest(ctx, req)
}

func (s *FriendServiceImpl) AcceptRequest(ctx context.Context, receiverID, requestID string) error {
	req, err := s.repo.FindRequestByID(ctx, requestID)
	if err != nil {
		return errors.New("friend request not found")
	}

	if req.ReceiverID != receiverID {
		return errors.New("unauthorized to accept this request")
	}

	if req.Status != model.RequestStatusPending {
		return errors.New("request is no longer pending")
	}

	return s.repo.AcceptRequestTx(ctx, req)
}

func (s *FriendServiceImpl) RejectRequest(ctx context.Context, receiverID, requestID string) error {
	req, err := s.repo.FindRequestByID(ctx, requestID)
	if err != nil {
		return errors.New("friend request not found")
	}

	if req.ReceiverID != receiverID {
		return errors.New("unauthorized to reject this request")
	}

	return s.repo.RejectRequest(ctx, req)
}

func (s *FriendServiceImpl) GetPendingRequests(ctx context.Context, userID string) ([]dto.PendingRequestResponse, error) {
	requests, err := s.repo.GetPendingRequests(ctx, userID)
	if err != nil {
		return nil, err
	}

	var res []dto.PendingRequestResponse
	for _, r := range requests {
		res = append(res, dto.PendingRequestResponse{
			ID:          r.ID,
			SenderID:    r.SenderID,
			DisplayName: r.Sender.DisplayName,
			AvatarURL:   r.Sender.AvatarURL,
			CreatedAt:   r.CreatedAt.Format(time.RFC3339),
		})
	}
	return res, nil
}

func (s *FriendServiceImpl) GetFriendsList(ctx context.Context, userID string) ([]model.UserProfile, error) {
	return s.repo.GetFriends(ctx, userID)
}

func (s *FriendServiceImpl) Unfriend(ctx context.Context, userID, friendID string) error {
	return s.repo.RemoveFriend(ctx, userID, friendID)
}
