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
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"log"
	"math/big"
	"net/http"
	"net/smtp"
	"os"
	"shared/jwt"
	"strings"
	"time"
)

var ErrEmailAlreadyExists = errors.New("email already registered")
var ErrInvalidCredentials = errors.New("invalid email or password")
var ErrUserBanned = errors.New("access denied: your account has been suspended by an administrator")
var ErrInvalidOTP = errors.New("invalid or expired verification code")

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

// 1️⃣ Step 1: Register stages user data in Redis and triggers Gmail SMTP OTP (No Database Write Yet)
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

	// Dispatch SMTP email in background routine
	go s.sendOTPEmail(req.Email, otpCode)

	return nil
}

// Helper: Send OTP via Gmail SMTP
func (s *AuthServiceImpl) sendOTPEmail(toEmail string, otp string) {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpFrom := os.Getenv("SMTP_FROM")

	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
	}
	if smtpPort == "" {
		smtpPort = "587"
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	msg := []byte(fmt.Sprintf("To: %s\r\n"+
		"Subject: Chatting App Account Verification Code\r\n"+
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n"+
		"Hello,\n\nYour account activation code is: %s\nThis code will expire in 10 minutes.\n\nRegards,\nChatting App Support", toEmail, otp))

	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
	err := smtp.SendMail(addr, auth, smtpFrom, []string{toEmail}, msg)
	if err != nil {
		log.Printf("[SMTP ERROR] Failed to send OTP to %s: %v", toEmail, err)
	} else {
		log.Printf("[SMTP SUCCESS] Verification OTP sent successfully to %s", toEmail)
	}
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

	// Commit user to PostgreSQL Database now
	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, fmt.Errorf("failed to commit user record: %w", err)
	}

	// Clean up Redis temporary keys
	_, _ = s.redisClient.Del(ctx, "otp:"+email, "staged:"+email).Result()

	// ⚡ 3️⃣ AUTO-CREATE PROFILE IN USER-SERVICE CONTAINER VIA INTERNAL BRIDGE
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

// ⚠️ Legacy placeholder for interface compatibility if called elsewhere
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

	// ⚡ BLOCK LOGIN IF USER IS BANNED
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
