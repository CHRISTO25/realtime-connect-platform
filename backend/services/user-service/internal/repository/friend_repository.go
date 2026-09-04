package repository

import (
	"context"
	"errors"
	"user-service/internal/model"

	"gorm.io/gorm"
)

type FriendRepositoryImpl struct {
	db *gorm.DB
}

func NewFriendRepository(db *gorm.DB) FriendRepository {
	return &FriendRepositoryImpl{db: db}
}

func (r *FriendRepositoryImpl) SendRequest(ctx context.Context, request *model.FriendRequest) error {
	return r.db.WithContext(ctx).Create(request).Error
}

func (r *FriendRepositoryImpl) FindRequestByID(ctx context.Context, id string) (*model.FriendRequest, error) {
	var req model.FriendRequest
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&req).Error
	return &req, err
}

func (r *FriendRepositoryImpl) FindExistingRequest(ctx context.Context, senderID, receiverID string) (*model.FriendRequest, error) {
	var req model.FriendRequest
	err := r.db.WithContext(ctx).
		Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", senderID, receiverID, receiverID, senderID).
		Where("status = ?", model.RequestStatusPending).
		First(&req).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &req, err
}

func (r *FriendRepositoryImpl) GetPendingRequests(ctx context.Context, userID string) ([]model.FriendRequest, error) {
	var requests []model.FriendRequest
	err := r.db.WithContext(ctx).
		Preload("Sender").
		Where("receiver_id = ? AND status = ?", userID, model.RequestStatusPending).
		Order("created_at desc").
		Find(&requests).Error
	return requests, err
}

func (r *FriendRepositoryImpl) AcceptRequestTx(ctx context.Context, req *model.FriendRequest) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Update Request Status
		if err := tx.Model(&model.FriendRequest{}).Where("id = ?", req.ID).Update("status", model.RequestStatusAccepted).Error; err != nil {
			return err
		}

		// 2. Create Bi-directional Friend Entries
		f1 := model.Friend{UserID: req.SenderID, FriendID: req.ReceiverID}
		f2 := model.Friend{UserID: req.ReceiverID, FriendID: req.SenderID}

		if err := tx.Create(&f1).Error; err != nil {
			return err
		}
		return tx.Create(&f2).Error
	})
}

func (r *FriendRepositoryImpl) RejectRequest(ctx context.Context, req *model.FriendRequest) error {
	return r.db.WithContext(ctx).
		Model(&model.FriendRequest{}).
		Where("id = ?", req.ID).
		Update("status", model.RequestStatusRejected).Error
}

func (r *FriendRepositoryImpl) IsFriend(ctx context.Context, userID, friendID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Friend{}).
		Where("user_id = ? AND friend_id = ?", userID, friendID).
		Count(&count).Error
	return count > 0, err
}

func (r *FriendRepositoryImpl) GetFriends(ctx context.Context, userID string) ([]model.UserProfile, error) {
	var profiles []model.UserProfile

	// Join user_profiles and exclude banned profiles
	err := r.db.WithContext(ctx).
		Model(&model.UserProfile{}).
		Joins("JOIN friends ON friends.friend_id = user_profiles.user_id").
		Where("friends.user_id = ? AND COALESCE(user_profiles.is_banned, false) = ?", userID, false).
		Find(&profiles).Error

	if err != nil {
		return nil, err
	}

	return profiles, nil
}

func (r *FriendRepositoryImpl) RemoveFriend(ctx context.Context, userID, friendID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete bidirectional entries
		if err := tx.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", userID, friendID, friendID, userID).Delete(&model.Friend{}).Error; err != nil {
			return err
		}
		// Reset request status
		return tx.Where("(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", userID, friendID, friendID, userID).Delete(&model.FriendRequest{}).Error
	})
}
