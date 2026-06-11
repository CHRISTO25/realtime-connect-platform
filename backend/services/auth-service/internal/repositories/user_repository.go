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
