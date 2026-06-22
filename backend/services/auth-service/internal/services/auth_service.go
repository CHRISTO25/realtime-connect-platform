// package services

// import "auth-service/internal/dto"

// type AuthService interface {
// 	Register(req dto.RegisterRequest) (*dto.RegisterResponse, error)
// }

package services

import (
	"auth-service/internal/dto"
	"context"
)

type AuthService interface {
	Register(ctx context.Context, req dto.RegisterRequest) (*dto.RegisterResponse, error)

	// CRITICAL CONTRACT: If this line is missing, your handler will say "Login is undefined"
	Login(ctx context.Context, req dto.LoginRequest) (*dto.LoginResponse, error)
}
