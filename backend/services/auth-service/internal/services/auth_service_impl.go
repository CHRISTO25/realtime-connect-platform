package services

import (
	"auth-service/internal/dto"
	"auth-service/internal/model"
	"auth-service/internal/repositories"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"shared/jwt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
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

// Helper: Send OTP via Gmail SMTP with direct TLS fallback and explicit error logging
// Helper: Send OTP via Gmail SMTP with explicit STARTTLS on port 587
func (s *AuthServiceImpl) sendOTPEmail(toEmail string, otp string) {
	smtpHost := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	smtpPort := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	smtpUser := strings.TrimSpace(os.Getenv("SMTP_USER"))
	smtpPass := strings.TrimSpace(os.Getenv("SMTP_PASS"))
	smtpFrom := strings.TrimSpace(os.Getenv("SMTP_FROM"))

	// Strip whitespace and quotes from environment variables
	smtpPass = strings.ReplaceAll(smtpPass, " ", "")
	smtpPass = strings.Trim(smtpPass, `"'`)

	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
	}
	if smtpPort == "" {
		smtpPort = "587"
	}
	if smtpFrom == "" {
		smtpFrom = smtpUser
	}

	if smtpUser == "" || smtpPass == "" {
		log.Printf("🔴 [SMTP ERROR] Missing credentials: SMTP_USER='%s', is SMTP_PASS set? %v", smtpUser, smtpPass != "")
		return
	}

	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)
	log.Printf("⚡ [SMTP INFO] Connecting to %s via STARTTLS to send OTP to %s...", addr, toEmail)

	// RFC-compliant mail payload
	subject := "Subject: Chatting App Verification Code\r\n"
	fromHeader := fmt.Sprintf("From: %s\r\n", smtpFrom)
	toHeader := fmt.Sprintf("To: %s\r\n", toEmail)
	mime := "MIME-version: 1.0;\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n"
	body := fmt.Sprintf("Hello,\r\n\r\nYour account activation code is: %s\r\nThis code will expire in 10 minutes.\r\n\r\nRegards,\r\nChatting App Support", otp)

	msg := []byte(fromHeader + toHeader + subject + mime + body)
	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)

	// 1. Establish plain TCP connection first (Port 587)
	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		log.Printf("🔴 [SMTP ERROR] TCP Dial to %s failed: %v", addr, err)
		return
	}
	defer conn.Close()

	// 2. Initialize SMTP Client
	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		log.Printf("🔴 [SMTP ERROR] SMTP client creation failed: %v", err)
		return
	}
	defer client.Quit()

	// 3. Upgrade to TLS via STARTTLS
	tlsConfig := &tls.Config{
		ServerName: smtpHost,
	}
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err = client.StartTLS(tlsConfig); err != nil {
			log.Printf("🔴 [SMTP ERROR] STARTTLS upgrade failed: %v", err)
			return
		}
	}

	// 4. Authenticate
	if err = client.Auth(auth); err != nil {
		log.Printf("🔴 [SMTP ERROR] Auth failed: %v (Check Google App Password)", err)
		return
	}

	// 5. Set sender and recipient
	if err = client.Mail(smtpFrom); err != nil {
		log.Printf("🔴 [SMTP ERROR] Mail sender set failed: %v", err)
		return
	}
	if err = client.Rcpt(toEmail); err != nil {
		log.Printf("🔴 [SMTP ERROR] Recipient set failed: %v", err)
		return
	}

	// 6. Write message body
	w, err := client.Data()
	if err != nil {
		log.Printf("🔴 [SMTP ERROR] Data stream open failed: %v", err)
		return
	}

	if _, err = w.Write(msg); err != nil {
		log.Printf("🔴 [SMTP ERROR] Data write failed: %v", err)
		return
	}

	if err = w.Close(); err != nil {
		log.Printf("🔴 [SMTP ERROR] Data close failed: %v", err)
		return
	}

	log.Printf("🟢 [SMTP SUCCESS] Verification OTP sent successfully to %s", toEmail)
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
