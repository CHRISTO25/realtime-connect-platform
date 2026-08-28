package repositories

import (
	"auth-service/internal/model"
	"context"
)

type UserRepository interface {
	Create(ctx context.Context, user *model.User) error
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	FindByID(ctx context.Context, id string) (*model.User, error)
	Update(ctx context.Context, user *model.User) error
	Delete(ctx context.Context, id string) error

	// Refresh Tokens
	SaveRefreshToken(ctx context.Context, token *model.RefreshToken) error
	GetRefreshToken(ctx context.Context, token string) (*model.RefreshToken, error)
	UpdateRefreshToken(ctx context.Context, token *model.RefreshToken) error
	RevokeUserTokens(ctx context.Context, userID string) error

	// ⚡ LIVE BAN CHECK: Required by shared/middleware/auth.go
	IsUserBanned(ctx context.Context, userID string) (bool, error)
}
