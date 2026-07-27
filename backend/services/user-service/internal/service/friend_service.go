package service

import (
	"context"
	"user-service/internal/dto"
	"user-service/internal/model"
)

type FriendService interface {
	SendRequest(ctx context.Context, senderID, receiverID string) error
	AcceptRequest(ctx context.Context, receiverID, requestID string) error
	RejectRequest(ctx context.Context, receiverID, requestID string) error
	GetPendingRequests(ctx context.Context, userID string) ([]dto.PendingRequestResponse, error)
	GetFriendsList(ctx context.Context, userID string) ([]model.UserProfile, error) // 👈 Declared
	Unfriend(ctx context.Context, userID, friendID string) error                    // 👈 Declared
}
