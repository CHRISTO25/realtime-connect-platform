package service

import (
	"context"
	"mime/multipart"
	"user-service/internal/dto"
	"user-service/internal/model"
)

type UserService interface {
	// ⚡ Updated to match 3-parameter signature
	InitProfile(ctx context.Context, userID string, displayName string, email string) error
	GetProfile(ctx context.Context, userID string) (*dto.UserProfileResponse, error)
	UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*dto.UserProfileResponse, error)
	UploadAvatar(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error)
	UploadCover(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error)
	GetAllProfiles(ctx context.Context, currentUserID string, page, perPage int) (*dto.GetAllUserResponse, error)
	UpdateStatus(ctx context.Context, userID string, isOnline bool) error
	SearchUsers(ctx context.Context, currentUserID string, req *dto.SearchUsersRequest) (*dto.PaginatedUsersResponse, error)
	AdminGetAllUsers(ctx context.Context, query string) ([]model.UserProfile, error)
	AdminSetUserBanStatus(ctx context.Context, userID string, isBanned bool) error
}
