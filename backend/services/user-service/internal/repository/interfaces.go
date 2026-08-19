package repository

import (
	"context"

	"user-service/internal/model"
)

type ProfileRepository interface {
	CreateProfile(ctx context.Context, profile *model.UserProfile) error
	GetProfileByID(ctx context.Context, id string) (*model.UserProfile, error)
	UpdateProfile(ctx context.Context, profile *model.UserProfile) error
	UpdateStatus(ctx context.Context, id string, isOnline bool) error
	GetAllProfilesPaginated(ctx context.Context, excludeUserID string, offset, limit int) ([]model.UserProfile, int64, error)
	SearchProfiles(ctx context.Context, currentUserID string, searchQuery, locationQuery string, offset, limit int) ([]model.UserProfile, int64, error)

	// ⚡ ADDED: Admin Interface Contracts
	AdminGetAllUsers(ctx context.Context, query string) ([]model.UserProfile, error)
	AdminSetUserBanStatus(ctx context.Context, userID string, isBanned bool) error
}

type FriendRepository interface {
	SendRequest(ctx context.Context, request *model.FriendRequest) error
	FindRequestByID(ctx context.Context, id string) (*model.FriendRequest, error)
	FindExistingRequest(ctx context.Context, senderID, receiverID string) (*model.FriendRequest, error)
	GetPendingRequests(ctx context.Context, userID string) ([]model.FriendRequest, error)
	AcceptRequestTx(ctx context.Context, request *model.FriendRequest) error
	RejectRequest(ctx context.Context, request *model.FriendRequest) error
	IsFriend(ctx context.Context, userID, friendID string) (bool, error)
	GetFriends(ctx context.Context, userID string) ([]model.UserProfile, error)
	RemoveFriend(ctx context.Context, userID, friendID string) error
}

type BlockRepository interface {
	BlockUserTx(ctx context.Context, blockerID, blockedID string) error
	UnblockUser(ctx context.Context, blockerID, blockedID string) error
	IsBlocked(ctx context.Context, userID1, userID2 string) (bool, error)
	GetBlockedUsers(ctx context.Context, blockerID string) ([]model.UserProfile, error)
	GetBlockedIDs(ctx context.Context, userID string) ([]string, error)
}
