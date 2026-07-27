package repository

import (
	"context"
	"errors"
	"user-service/internal/model"

	"gorm.io/gorm"
)

type BlockRepositoryImpl struct {
	db *gorm.DB
}

func NewBlockRepository(db *gorm.DB) BlockRepository {
	return &BlockRepositoryImpl{db: db}
}

func (r *BlockRepositoryImpl) BlockUserTx(ctx context.Context, blockerID, blockedID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&model.BlockedUser{}).
			Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("user is already blocked")
		}

		blockRecord := model.BlockedUser{
			BlockerID: blockerID,
			BlockedID: blockedID,
		}
		if err := tx.Create(&blockRecord).Error; err != nil {
			return err
		}

		// Cleanup existing friendships and requests
		if err := tx.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
			blockerID, blockedID, blockedID, blockerID).
			Delete(&model.Friend{}).Error; err != nil {
			return err
		}

		return tx.Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
			blockerID, blockedID, blockedID, blockerID).
			Delete(&model.FriendRequest{}).Error
	})
}

func (r *BlockRepositoryImpl) UnblockUser(ctx context.Context, blockerID, blockedID string) error {
	result := r.db.WithContext(ctx).
		Where("blocker_id = ? AND blocked_id = ?", blockerID, blockedID).
		Delete(&model.BlockedUser{})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("block record not found")
	}
	return nil
}

func (r *BlockRepositoryImpl) IsBlocked(ctx context.Context, userID1, userID2 string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.BlockedUser{}).
		Where("(blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
			userID1, userID2, userID2, userID1).
		Count(&count).Error
	return count > 0, err
}

func (r *BlockRepositoryImpl) GetBlockedUsers(ctx context.Context, blockerID string) ([]model.UserProfile, error) {
	var blocks []model.BlockedUser
	err := r.db.WithContext(ctx).
		Preload("BlockedProfile").
		Where("blocker_id = ?", blockerID).
		Find(&blocks).Error
	if err != nil {
		return nil, err
	}

	var profiles []model.UserProfile
	for _, b := range blocks {
		profiles = append(profiles, b.BlockedProfile)
	}
	return profiles, nil
}

// ⚡ GetBlockedIDs implementation (bidirectional)
func (r *BlockRepositoryImpl) GetBlockedIDs(ctx context.Context, userID string) ([]string, error) {
	var blocks []model.BlockedUser
	err := r.db.WithContext(ctx).
		Where("blocker_id = ? OR blocked_id = ?", userID, userID).
		Find(&blocks).Error
	if err != nil {
		return nil, err
	}

	idMap := make(map[string]bool)
	for _, b := range blocks {
		if b.BlockerID != userID {
			idMap[b.BlockerID] = true
		}
		if b.BlockedID != userID {
			idMap[b.BlockedID] = true
		}
	}

	var blockedIDs []string
	for id := range idMap {
		blockedIDs = append(blockedIDs, id)
	}
	return blockedIDs, nil
}
