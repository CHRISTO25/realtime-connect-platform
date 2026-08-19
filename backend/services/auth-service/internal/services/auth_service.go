package services

import (
	"auth-service/internal/dto"
	"context"
)

type AuthService interface {
	// Step 1: Stages registration data in Redis and sends the OTP email via SMTP.
	// Does NOT touch the database yet.
	Register(ctx context.Context, req dto.RegisterRequest) error

	// Step 2: Validates the OTP code against Redis. If valid, commits the user
	// to PostgreSQL and initializes their profile in the user-service.
	VerifyEmailAndCommit(ctx context.Context, email string, code string) (*dto.RegisterResponse, error)

	Login(ctx context.Context, req dto.LoginRequest) (*dto.TokenResponse, error)

	GetProfile(ctx context.Context, userID string) (*dto.UserResponse, error)

	RefreshSession(ctx context.Context, req dto.RefreshRequest) (*dto.TokenResponse, error)
	Logout(ctx context.Context, userID string) error
}
