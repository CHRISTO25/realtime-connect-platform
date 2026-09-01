package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"shared/jwt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailAlreadyExists = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserBanned         = errors.New("access denied: your account has been suspended by an administrator")
	ErrInvalidOTP         = errors.New("invalid or expired verification code")
)

type AuthServiceImpl struct {
	userRepo    repositories.UserRepository
	redisClient *redis.Client
	jwtSecret   string
}

func NewAuthService(repo repositories.UserRepository, redisClient *redis.Client, jwtSecret string) AuthService {
	return &AuthServiceImpl{
		userRepo:    repo,
		redisClient: redisClient,
		jwtSecret:   jwtSecret,
	}
}

// Temporary data layout for pre-verification staging in Redis
type StagedUser struct {
	Username       string `json:"username"`
	Email          string `json:"email"`
	HashedPassword string `json:"hashed_password"`
}

// 1️⃣ Step 1: Register stages user data in Redis and triggers Google Apps Script HTTPS Relay OTP
func (s *AuthServiceImpl) Register(ctx context.Context, req dto.RegisterRequest) error {
	existingUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return fmt.Errorf("registration database scan failed: %w", err)
	}
	if existingUser != nil {
		return ErrEmailAlreadyExists
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("password hashing failure: %w", err)
	}

	// Generate secure cryptographic 6-digit OTP
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return fmt.Errorf("otp generation failed: %w", err)
	}
	otpCode := fmt.Sprintf("%06d", n.Int64()+100000)

	staged := StagedUser{
		Username:       req.Username,
		Email:          req.Email,
		HashedPassword: string(hashedPassword),
	}

	stagedJSON, err := json.Marshal(staged)
	if err != nil {
		return fmt.Errorf("failed to marshal staged user: %w", err)
	}

	if s.redisClient != nil {
		pipe := s.redisClient.Pipeline()
		pipe.Set(ctx, "otp:"+req.Email, otpCode, 10*time.Minute)
		pipe.Set(ctx, "staged:"+req.Email, stagedJSON, 10*time.Minute)
		_, err = pipe.Exec(ctx)
		if err != nil {
			return fmt.Errorf("failed to cache otp/staged data in redis: %w", err)
		}
	}

	// Dispatch email in background routine via Google Apps Script HTTPS Relay
	go s.sendOTPEmail(req.Email, otpCode)

	return nil
}

// Helper: Send OTP via Google Apps Script HTTPS Relay (Sends to any recipient without domain restriction)
// Helper: Send OTP via Google Apps Script HTTPS Relay
func (s *AuthServiceImpl) sendOTPEmail(toEmail string, otp string) {
	scriptURL := strings.TrimSpace(os.Getenv("GMAIL_RELAY_URL"))
	relayKey := strings.TrimSpace(os.Getenv("GMAIL_RELAY_KEY"))

	// Strip accidental markdown link artifacts or quotes if pasted with [url](url)
	if strings.Contains(scriptURL, "](") {
		parts := strings.Split(scriptURL, "](")
		if len(parts) > 1 {
			scriptURL = strings.TrimRight(parts[1], ")")
		}
	}
	scriptURL = strings.Trim(scriptURL, "[]()\"' ")

	if relayKey == "" {
		relayKey = "my_secure_email_secret_12345"
	}

	if scriptURL == "" {
		log.Printf("🔴 [EMAIL ERROR] Missing GMAIL_RELAY_URL in environment variables")
		return
	}

	endpoint := fmt.Sprintf("%s?to=%s&otp=%s&key=%s",
		scriptURL,
		url.QueryEscape(toEmail),
		url.QueryEscape(otp),
		url.QueryEscape(relayKey),
	)

	log.Printf("⚡ [EMAIL INFO] Dispatching OTP to %s via Google Script Relay...", toEmail)

	client := &http.Client{
		Timeout: 20 * time.Second,
	}

	resp, err := client.Get(endpoint)
	if err != nil {
		log.Printf("🔴 [EMAIL ERROR] Google Script relay request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("🔴 [EMAIL ERROR] Google Script relay returned HTTP status %d", resp.StatusCode)
		return
	}

	log.Printf("🟢 [EMAIL SUCCESS] Verification OTP successfully sent to %s", toEmail)
}

// 2️⃣ Step 2: Verify OTP, commit user to Postgres, and initialize user-service profile
func (s *AuthServiceImpl) VerifyEmailAndCommit(ctx context.Context, email string, code string) (*dto.RegisterResponse, error) {
	if s.redisClient == nil {
		return nil, errors.New("redis cache client uninitialized")
	}

	storedOTP, err := s.redisClient.Get(ctx, "otp:"+email).Result()
	if err != nil || storedOTP != code {
		return nil, ErrInvalidOTP
	}

	stagedJSON, err := s.redisClient.Get(ctx, "staged:"+email).Result()
	if err != nil {
		return nil, errors.New("registration session expired or not found. Please restart registration")
	}

	var staged StagedUser
	if err := json.Unmarshal([]byte(stagedJSON), &staged); err != nil {
		return nil, errors.New("failed to parse staged registration profile")
	}

	generatedUUID := uuid.New().String()
	newUser := &model.User{
		ID:       generatedUUID,
		Username: staged.Username,
		Email:    staged.Email,
		Password: staged.HashedPassword,
		Role:     "user",
		IsBanned: false,
	}

	// Commit user to PostgreSQL Database
	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to commit user record: %w", err)
	}

	// Clean up temporary keys in Redis
	_, _ = s.redisClient.Del(ctx, "otp:"+email, "staged:"+email).Result()

	// ⚡ 3️⃣ Initialize Profile in user-service
	userServiceBase := os.Getenv("USER_SERVICE_URL")
	if userServiceBase == "" {
		userServiceBase = "http://user-service:8002"
	}
	userServiceBase = strings.TrimSuffix(userServiceBase, "/")

	payload := map[string]string{
		"user_id":      newUser.ID,
		"display_name": newUser.Username,
		"email":        newUser.Email,
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[SYNC WARNING] Failed to encode profile payload: %v", err)
		return &dto.RegisterResponse{
			ID:        newUser.ID,
			Username:  newUser.Username,
			Email:     newUser.Email,
			CreatedAt: newUser.CreatedAt.Format("2006-01-02 15:04:05"),
		}, nil
	}

	syncURL := fmt.Sprintf("%s/api/v1/users/internal/init", userServiceBase)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", syncURL, bytes.NewBuffer(jsonBytes))
	if err == nil {
		httpReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(httpReq)
		if err == nil {
			defer resp.Body.Close()
			log.Printf("[SYNC SUCCESS] Profile created in user-service for User ID %s", newUser.ID)
		} else {
			log.Printf("[SYNC ERROR] user-service unreachable: %v", err)
		}
	}

	return &dto.RegisterResponse{
		ID:        newUser.ID,
		Username:  newUser.Username,
		Email:     newUser.Email,
		CreatedAt: newUser.CreatedAt.Format("2006-01-02 15:04:05"),
	}, nil
}

func (s *AuthServiceImpl) VerifyEmail(ctx context.Context, email string, code string) error {
	_, err := s.VerifyEmailAndCommit(ctx, email, code)
	return err
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

	if user.IsBanned {
		return nil, ErrUserBanned
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	accessToken, err := jwt.GenerateToken(user.ID, user.Role, s.jwtSecret, time.Minute*15)
	if err != nil {
		return nil, fmt.Errorf("access token generation failed: %w", err)
	}

	refreshToken, err := jwt.GenerateToken(user.ID, user.Role, s.jwtSecret, time.Hour*24*7)
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
		Role:     user.Role,
		IsBanned: user.IsBanned,
	}, nil
}

func (s *AuthServiceImpl) RefreshSession(ctx context.Context, req dto.RefreshRequest) (*dto.TokenResponse, error) {
	claims, err := jwt.ValidateToken(req.RefreshToken, s.jwtSecret)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	user, err := s.userRepo.FindByID(ctx, claims.UserID)
	if err != nil || user == nil || user.IsBanned {
		_ = s.userRepo.RevokeUserTokens(ctx, claims.UserID)
		return nil, ErrUserBanned
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

	newAccess, err := jwt.GenerateToken(claims.UserID, claims.Role, s.jwtSecret, 15*time.Minute)
	if err != nil {
		return nil, err
	}
	newRefresh, err := jwt.GenerateToken(claims.UserID, claims.Role, s.jwtSecret, 7*24*time.Hour)
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
