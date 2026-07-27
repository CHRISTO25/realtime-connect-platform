package service

import (
	"context"
	"user-service/internal/model"
)

type BlockService interface {
	BlockUser(ctx context.Context, blockerID, blockedID string) error
	UnblockUser(ctx context.Context, blockerID, blockedID string) error
	GetBlockedList(ctx context.Context, blockerID string) ([]model.UserProfile, error)
	GetBlockedIDs(ctx context.Context, userID string) ([]string, error) // 👈 ADDED HERE
}
