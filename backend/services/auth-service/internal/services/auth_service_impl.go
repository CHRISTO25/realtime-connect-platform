package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"context"
	"errors"
	"golang.org/x/crypto/bcrypt"
)

var ErrEmailAlreadyExists = errors.New("email already registered")

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
