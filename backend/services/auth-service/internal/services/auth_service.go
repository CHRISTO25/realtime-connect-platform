package services

import (
	"auth-service/internal/dto"
	"context"
)

type AuthService interface {
	Register(ctx context.Context, req dto.RegisterRequest) (*dto.RegisterResponse, error)

	// FIX: Changed from *dto.LoginResponse to *dto.TokenResponse to match your implementation!
	Login(ctx context.Context, req dto.LoginRequest) (*dto.TokenResponse, error)

	GetProfile(ctx context.Context, userID string) (*dto.UserResponse, error)

	RefreshSession(ctx context.Context, req dto.RefreshRequest) (*dto.TokenResponse, error)
	Logout(ctx context.Context, userID string) error
}
