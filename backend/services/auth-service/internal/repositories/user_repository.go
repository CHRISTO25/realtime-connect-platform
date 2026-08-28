package repositories

import (
	"auth-service/internal/model"
	"context"
	"errors"
	"gorm.io/gorm"
)

type UserRepositoryImpl struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &UserRepositoryImpl{db: db}
}

func (r *UserRepositoryImpl) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Email available
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepositoryImpl) Create(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *UserRepositoryImpl) FindByID(ctx context.Context, id string) (*model.User, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update saves user state changes (such as email verification or admin ban status changes)
func (r *UserRepositoryImpl) Update(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// Delete cleans up an orphaned user record if user-service initialization fails
func (r *UserRepositoryImpl) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&model.User{}, "id = ?", id).Error
}

func (r *UserRepositoryImpl) SaveRefreshToken(ctx context.Context, token *model.RefreshToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *UserRepositoryImpl) GetRefreshToken(ctx context.Context, tokenStr string) (*model.RefreshToken, error) {
	var token model.RefreshToken
	err := r.db.WithContext(ctx).Where("token = ?", tokenStr).First(&token).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &token, nil
}

func (r *UserRepositoryImpl) RevokeUserTokens(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&model.RefreshToken{}).
		Where("user_id = ? AND is_revoked = ?", userID, false).
		Update("is_revoked", true).Error
}

func (r *UserRepositoryImpl) UpdateRefreshToken(ctx context.Context, token *model.RefreshToken) error {
	return r.db.WithContext(ctx).Save(token).Error
}

// ⚡ LIVE BAN CHECK: Queries PostgreSQL to verify if the operator node is suspended
// IsUserBanned queries the database to check if a user is currently suspended
func (r *UserRepositoryImpl) IsUserBanned(ctx context.Context, userID string) (bool, error) {
	var user model.User
	err := r.db.WithContext(ctx).Select("is_banned").Where("id = ?", userID).First(&user).Error
	if err != nil {
		return false, err
	}
	return user.IsBanned, nil
}
