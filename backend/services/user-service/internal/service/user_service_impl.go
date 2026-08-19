package service

import (
	"context"
	"fmt"
	"mime/multipart"
	"time"
	"user-service/internal/dto"
	"user-service/internal/media"
	"user-service/internal/model"
	"user-service/internal/repository"
)

type UserServiceImpl struct {
	repo     repository.ProfileRepository
	uploader *media.MediaUploader
}

func NewUserService(repo repository.ProfileRepository, uploader *media.MediaUploader) UserService {
	return &UserServiceImpl{
		repo:     repo,
		uploader: uploader,
	}
}

// ⚡ Helper: User is only online if is_online == true AND last_seen was within 20 seconds
func isUserActive(isOnline bool, lastSeen time.Time) bool {
	if !isOnline {
		return false
	}
	return time.Since(lastSeen) <= 20*time.Second
}

func (s *UserServiceImpl) InitProfile(ctx context.Context, userID string, displayName string, email string) error {
	profile := &model.UserProfile{
		ID:          userID,
		UserID:      userID,
		DisplayName: displayName,
		Email:       email,
		IsOnline:    false,
		LastSeen:    time.Now(),
	}
	return s.repo.CreateProfile(ctx, profile)
}

func (s *UserServiceImpl) GetProfile(ctx context.Context, userID string) (*dto.UserProfileResponse, error) {
	profile, err := s.repo.GetProfileByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &dto.UserProfileResponse{
		ID:          profile.UserID,
		DisplayName: profile.DisplayName,
		Bio:         profile.Bio,
		Location:    profile.Location,
		AvatarURL:   profile.AvatarURL,
		CoverURL:    profile.CoverURL,
		IsOnline:    isUserActive(profile.IsOnline, profile.LastSeen),
		LastSeen:    profile.LastSeen.Format(time.RFC3339),
	}, nil
}

func (s *UserServiceImpl) UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*dto.UserProfileResponse, error) {
	profile, err := s.repo.GetProfileByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if req.DisplayName != "" {
		profile.DisplayName = req.DisplayName
	}
	if req.Bio != "" {
		profile.Bio = req.Bio
	}
	if req.Location != "" {
		profile.Location = req.Location
	}
	if req.AvatarURL != "" {
		profile.AvatarURL = req.AvatarURL
	}
	if req.CoverURL != "" {
		profile.CoverURL = req.CoverURL
	}

	if err := s.repo.UpdateProfile(ctx, profile); err != nil {
		return nil, err
	}

	return &dto.UserProfileResponse{
		ID:          profile.UserID,
		DisplayName: profile.DisplayName,
		Bio:         profile.Bio,
		Location:    profile.Location,
		AvatarURL:   profile.AvatarURL,
		CoverURL:    profile.CoverURL,
		IsOnline:    isUserActive(profile.IsOnline, profile.LastSeen),
		LastSeen:    profile.LastSeen.Format(time.RFC3339),
	}, nil
}

func (s *UserServiceImpl) UploadAvatar(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error) {
	folder := fmt.Sprintf("users/%s/avatars", userID)
	avatarURL, err := s.uploader.UploadImage(ctx, fileHeader, folder)
	if err != nil {
		return nil, err
	}

	return s.UpdateProfile(ctx, userID, dto.UpdateProfileRequest{
		AvatarURL: avatarURL,
	})
}

func (s *UserServiceImpl) UploadCover(ctx context.Context, userID string, fileHeader *multipart.FileHeader) (*dto.UserProfileResponse, error) {
	folder := fmt.Sprintf("users/%s/covers", userID)
	coverURL, err := s.uploader.UploadImage(ctx, fileHeader, folder)
	if err != nil {
		return nil, err
	}

	return s.UpdateProfile(ctx, userID, dto.UpdateProfileRequest{
		CoverURL: coverURL,
	})
}

func (s *UserServiceImpl) GetAllProfiles(ctx context.Context, currentUserId string, page, perPage int) (*dto.GetAllUserResponse, error) {
	offset := (page - 1) * perPage
	profiles, totalCount, err := s.repo.GetAllProfilesPaginated(ctx, currentUserId, offset, perPage)
	if err != nil {
		return nil, err
	}

	var listItems []dto.UserListItemResponse
	for _, p := range profiles {
		listItems = append(listItems, dto.UserListItemResponse{
			UserID:      p.UserID,
			DisplayName: p.DisplayName,
			Bio:         p.Bio,
			Location:    p.Location,
			AvatarURL:   p.AvatarURL,
			CoverURL:    p.CoverURL,
			IsOnline:    isUserActive(p.IsOnline, p.LastSeen),
			IsFollowing: false,
		})
	}

	return &dto.GetAllUserResponse{
		Data:       listItems,
		TotalCount: int(totalCount),
		Page:       page,
		PerPage:    perPage,
	}, nil
}

func (s *UserServiceImpl) SearchUsers(ctx context.Context, currentUserID string, req *dto.SearchUsersRequest) (*dto.PaginatedUsersResponse, error) {
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 || req.Limit > 50 {
		req.Limit = 10
	}

	offset := (req.Page - 1) * req.Limit

	profiles, totalCount, err := s.repo.SearchProfiles(ctx, currentUserID, req.Query, req.Location, offset, req.Limit)
	if err != nil {
		return nil, err
	}

	for i := range profiles {
		profiles[i].IsOnline = isUserActive(profiles[i].IsOnline, profiles[i].LastSeen)
	}

	totalPages := 0
	if req.Limit > 0 {
		totalPages = int((totalCount + int64(req.Limit) - 1) / int64(req.Limit))
	}
	hasNext := req.Page < totalPages

	return &dto.PaginatedUsersResponse{
		Users:      profiles,
		TotalCount: totalCount,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
		HasNext:    hasNext,
	}, nil
}

func (s *UserServiceImpl) UpdateStatus(ctx context.Context, userID string, isOnline bool) error {
	return s.repo.UpdateStatus(ctx, userID, isOnline)
}

func (s *UserServiceImpl) AdminGetAllUsers(ctx context.Context, query string) ([]model.UserProfile, error) {
	return s.repo.AdminGetAllUsers(ctx, query)
}

func (s *UserServiceImpl) AdminSetUserBanStatus(ctx context.Context, userID string, isBanned bool) error {
	return s.repo.AdminSetUserBanStatus(ctx, userID, isBanned)
}
