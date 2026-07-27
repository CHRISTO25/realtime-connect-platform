package service

import (
	"context"
	"errors"
	"user-service/internal/model"
	"user-service/internal/repository"
)

type BlockServiceImpl struct {
	repo repository.BlockRepository
}

func NewBlockService(repo repository.BlockRepository) BlockService {
	return &BlockServiceImpl{repo: repo}
}

func (s *BlockServiceImpl) BlockUser(ctx context.Context, blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("you cannot block yourself")
	}
	return s.repo.BlockUserTx(ctx, blockerID, blockedID)
}

func (s *BlockServiceImpl) UnblockUser(ctx context.Context, blockerID, blockedID string) error {
	if blockerID == blockedID {
		return errors.New("invalid operation")
	}
	return s.repo.UnblockUser(ctx, blockerID, blockedID)
}

func (s *BlockServiceImpl) GetBlockedList(ctx context.Context, blockerID string) ([]model.UserProfile, error) {
	return s.repo.GetBlockedUsers(ctx, blockerID)
}

func (s *BlockServiceImpl) GetBlockedIDs(ctx context.Context, userID string) ([]string, error) {
	return s.repo.GetBlockedIDs(ctx, userID)
}
