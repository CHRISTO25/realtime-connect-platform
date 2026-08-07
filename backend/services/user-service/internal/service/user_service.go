package service

import (
	"context"
	"mime/multipart"
	"user-service/internal/dto"
)

type UserService interface {
	InitProfile(ctx context.Context, userID string, displayName string) error
	GetProfile(ctx context.Context, userID string) (*dto.UserProfileResponse, error)
	UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*dto.UserProfileResponse, error)
	UploadAvatar(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error)
	UploadCover(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error)
	GetAllProfiles(ctx context.Context, currentUserID string, page, perPage int) (*dto.GetAllUserResponse, error)
	// ⚡ DAY 12: Search Interface
	UpdateStatus(ctx context.Context, userID string, isOnline bool) error
	SearchUsers(ctx context.Context, currentUserID string, req *dto.SearchUsersRequest) (*dto.PaginatedUsersResponse, error)
}
