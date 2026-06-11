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
}
