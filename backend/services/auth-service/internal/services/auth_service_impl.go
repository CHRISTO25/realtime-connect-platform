package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"context"
	"errors"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"shared/jwt" // Resolves cleanly via your root go.work setup
	"time"
)

// Package-level errors maintain uniform API failures across domain contexts
var ErrEmailAlreadyExists = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")

type AuthServiceImpl struct {
	userRepo  repositories.UserRepository
	jwtSecret string // ◄=== Safely holds the verified signing key configuration in memory
}

// NewAuthService safely accepts your configuration secret via dependency injection
func NewAuthService(repo repositories.UserRepository, jwtSecret string) AuthService {
	return &AuthServiceImpl{
		userRepo:  repo,
		jwtSecret: jwtSecret,
	}
}

// Register processes client payloads to securely allocate user accounts on Neon DB
func (s *AuthServiceImpl) Register(ctx context.Context, req dto.RegisterRequest) (*dto.RegisterResponse, error) {
	// 1. Check for duplicate email using your unified repository pattern
	existingUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("registration database scan failed: %w", err)
	}
	if existingUser != nil {
		return nil, ErrEmailAlreadyExists
	}

	// 2. Hash password using standard production-grade Bcrypt hashing rules
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("password hashing runtime failure: %w", err)
	}

	// 3. Construct the model map (u.ID string-UUID will be set automatically by GORM hook)
	newUser := &model.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to commit user record: %w", err)
	}

	return &dto.RegisterResponse{
		ID:        newUser.ID,
		Username:  newUser.Username,
		Email:     newUser.Email,
		CreatedAt: newUser.CreatedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

// Login validates user records and returns cryptographically aligned JWT strings
func (s *AuthServiceImpl) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("database lookup failure: %w", err)
	}

	// Timing Attack Mitigation: If email is missing, execute a fake hash check anyway
	if user == nil {
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$fakehashplaceholderforsecurityreasons..."), []byte(req.Password))
		return nil, ErrInvalidCredentials
	}

	// Verify the true password against your database hash record securely
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// FIX: Generates tokens using the struct secret key guaranteed to match your router middleware
	token, err := jwt.GenerateToken(user.ID, s.jwtSecret, time.Hour*1)
	if err != nil {
		return nil, fmt.Errorf("token generation failed: %w", err)
	}

	return &dto.LoginResponse{
		AccessToken: token,
		TokenType:   "Bearer",
	}, nil
}

// === DAY 6 — PROTECTED PROFILE PROFILE LOOKUP ===

// GetProfile resolves context user identities strictly via decoupling interface methods
func (s *AuthServiceImpl) GetProfile(ctx context.Context, userID string) (*dto.UserResponse, error) {
	// Query Neon DB cleanly by leveraging your custom repository method
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user profile data not found")
	}

	// Safely filter database parameters out of your client response struct mapping
	return &dto.UserResponse{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
	}, nil
}
