package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"context"
	"errors"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"shared/jwt"
	"time"
)

var ErrEmailAlreadyExists = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")

type AuthServiceImpl struct {
	userRepo repositories.UserRepository
}

func NewAuthService(repo repositories.UserRepository) AuthService {
	return &AuthServiceImpl{userRepo: repo}
}

func (s *AuthServiceImpl) Register(ctx context.Context, req dto.RegisterRequest) (*dto.RegisterResponse, error) {
	// 1. Check for duplicate email
	existingUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrEmailAlreadyExists
	}

	// 2. Hash password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 3. Construct and map model
	newUser := &model.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, err
	}

	return &dto.RegisterResponse{
		ID:        newUser.ID,
		Username:  newUser.Username,
		Email:     newUser.Email,
		CreatedAt: newUser.CreatedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

// Login compiles cleanly now that jwt and fmt are fully resolved
func (s *AuthServiceImpl) Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("database lookup failure: %w", err)
	}

	// Defensive check against timing attacks
	if user == nil {
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$fakehashplaceholder..."), []byte(req.Password))
		return nil, ErrInvalidCredentials
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// This now compiles flawlessly since GenerateToken takes user.ID as a string string!
	token, err := jwt.GenerateToken(user.ID, "SUPER_SECRET_SIGNING_KEY", time.Hour*1)
	if err != nil {
		return nil, fmt.Errorf("token generation failed: %w", err)
	}

	return &dto.LoginResponse{
		AccessToken: token,
		TokenType:   "Bearer",
	}, nil
}
