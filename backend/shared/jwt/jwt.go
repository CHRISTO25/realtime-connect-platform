package jwt

import (
	"errors"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"time"
)

// CustomClaims now includes UserID and Role for role-based authorization middleware
type CustomClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"` // 👈 ADDED: Supports admin and user privilege levels
	jwt.RegisteredClaims
}

// GenerateToken now accepts userID and role to bake permissions into the signed payload
func GenerateToken(userID string, role string, secretKey string, duration time.Duration) (string, error) {
	claims := CustomClaims{
		UserID: userID,
		Role:   role, // 👈 EMBED ROLE INTO JWT CLAIMS
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(secretKey))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return signedToken, nil
}

// ValidateToken parses, validates signature, and extracts claims from an incoming token string
func ValidateToken(tokenString string, secretKey string) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secretKey), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token or expired claims layout")
	}

	return claims, nil
}
