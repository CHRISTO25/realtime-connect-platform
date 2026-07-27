package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"shared/jwt"
	"strings"
	"time"

	"github.com/google/uuid" // ◄ Make sure github.com/google/uuid is imported
	"golang.org/x/crypto/bcrypt"
)

var ErrEmailAlreadyExists = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")

type AuthServiceImpl struct {
	userRepo  repositories.UserRepository
	jwtSecret string
}

func NewAuthService(repo repositories.UserRepository, jwtSecret string) AuthService {
	return &AuthServiceImpl{
		userRepo:  repo,
		jwtSecret: jwtSecret,
	}
}

func (s *AuthServiceImpl) Register(ctx context.Context, req dto.RegisterRequest) (*dto.RegisterResponse, error) {
	// Step 1: Check existing email
	existingUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("registration database scan failed: %w", err)
	}
	if existingUser != nil {
		return nil, ErrEmailAlreadyExists
	}

	// Step 2: Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("password hashing runtime failure: %w", err)
	}

	// Step 3: Explicitly generate a valid UUID before creating the model
	generatedUUID := uuid.New().String()

	newUser := &model.User{
		ID:       generatedUUID, // ◄ EXPLICITLY ASSIGN UUID HERE
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to commit user record: %w", err)
	}

	// Double-check ID is present
	if newUser.ID == "" {
		newUser.ID = generatedUUID
	}

	// Step 4: Call user-service synchronously
	userServiceBase := os.Getenv("USER_SERVICE_URL")
	if userServiceBase == "" {
		userServiceBase = "http://localhost:8002"
	}
	userServiceBase = strings.TrimSuffix(userServiceBase, "/")

	payload := map[string]string{
		"user_id":      newUser.ID,
		"display_name": newUser.Username,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		_ = s.userRepo.Delete(ctx, newUser.ID)
		return nil, fmt.Errorf("failed to encode profile payload: %w", err)
	}

	syncURL := fmt.Sprintf("%s/api/v1/users/internal/init", userServiceBase)

	// Create explicit HTTP POST Request with JSON Body and Headers
	httpReq, err := http.NewRequestWithContext(ctx, "POST", syncURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		_ = s.userRepo.Delete(ctx, newUser.ID)
		return nil, fmt.Errorf("failed to form inter-service request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(httpReq)

	// Handle network error & trigger rollback
	if err != nil {
		log.Printf("[SYNC ERROR] Unreachable user-service at %s: %v", syncURL, err)
		_ = s.userRepo.Delete(ctx, newUser.ID)
		return nil, fmt.Errorf("profile initialization failed: user-service unreachable at %s", syncURL)
	}
	defer resp.Body.Close()

	// Handle HTTP non-20x responses & trigger rollback
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(resp.Body)
		errBody := buf.String()

		log.Printf("[SYNC ERROR] user-service returned status %d. Details: %s", resp.StatusCode, errBody)
		_ = s.userRepo.Delete(ctx, newUser.ID)
		return nil, fmt.Errorf("user-service profile initialization failed (status %d): %s", resp.StatusCode, errBody)
	}

	log.Printf("[SYNC SUCCESS] Profile created in user-service for User ID %s", newUser.ID)

	return &dto.RegisterResponse{
		ID:        newUser.ID,
		Username:  newUser.Username,
		Email:     newUser.Email,
		CreatedAt: newUser.CreatedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

func (s *AuthServiceImpl) Login(ctx context.Context, req dto.LoginRequest) (*dto.TokenResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("database lookup failure: %w", err)
	}

	if user == nil {
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$fakehashplaceholderforsecurityreasons..."), []byte(req.Password))
		return nil, ErrInvalidCredentials
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	accessToken, err := jwt.GenerateToken(user.ID, s.jwtSecret, time.Minute*15)
	if err != nil {
		return nil, fmt.Errorf("access token generation failed: %w", err)
	}

	refreshToken, err := jwt.GenerateToken(user.ID, s.jwtSecret, time.Hour*24*7)
	if err != nil {
		return nil, fmt.Errorf("refresh token generation failed: %w", err)
	}

	err = s.userRepo.SaveRefreshToken(ctx, &model.RefreshToken{
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: time.Now().Add(time.Hour * 24 * 7),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to persist user refresh session: %w", err)
	}

	return &dto.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthServiceImpl) GetProfile(ctx context.Context, userID string) (*dto.UserResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user profile data not found")
	}

	return &dto.UserResponse{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
	}, nil
}

func (s *AuthServiceImpl) RefreshSession(ctx context.Context, req dto.RefreshRequest) (*dto.TokenResponse, error) {
	claims, err := jwt.ValidateToken(req.RefreshToken, s.jwtSecret)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	storedToken, err := s.userRepo.GetRefreshToken(ctx, req.RefreshToken)
	if err != nil || storedToken == nil {
		return nil, errors.New("refresh token not recognized")
	}

	if storedToken.IsRevoked {
		_ = s.userRepo.RevokeUserTokens(ctx, storedToken.UserID)
		return nil, errors.New("security breach: token reuse detected! all active sessions revoked")
	}

	if time.Now().After(storedToken.ExpiresAt) {
		return nil, errors.New("refresh token has expired")
	}

	storedToken.IsRevoked = true
	if err := s.userRepo.UpdateRefreshToken(ctx, storedToken); err != nil {
		return nil, err
	}

	newAccess, err := jwt.GenerateToken(claims.UserID, s.jwtSecret, 15*time.Minute)
	if err != nil {
		return nil, err
	}
	newRefresh, err := jwt.GenerateToken(claims.UserID, s.jwtSecret, 7*24*time.Hour)
	if err != nil {
		return nil, err
	}

	err = s.userRepo.SaveRefreshToken(ctx, &model.RefreshToken{
		UserID:    claims.UserID,
		Token:     newRefresh,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	})
	if err != nil {
		return nil, err
	}

	return &dto.TokenResponse{
		AccessToken:  newAccess,
		RefreshToken: newRefresh,
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthServiceImpl) Logout(ctx context.Context, userID string) error {
	return s.userRepo.RevokeUserTokens(ctx, userID)
}
