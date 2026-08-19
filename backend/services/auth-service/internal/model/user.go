package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                    string         `gorm:\"primaryKey;type:varchar(36)\" json:\"id\"`
	Username              string         `gorm:\"uniqueIndex;not null\" json:\"username\"`
	Email                 string         `gorm:\"uniqueIndex;not null\" json:\"email\"`
	Password              string         `gorm:\"not null\" json:\"-\"`
	Role                  string         `gorm:\"default:'user'\" json:\"role\"`
	IsVerified            bool           `gorm:\"default:false\" json:\"is_verified\"`
	VerificationCode      string         `json:\"-\"`
	VerificationExpiresAt *time.Time     `json:\"-\"` // 👈 Expiry tracker
	IsBanned              bool           `gorm:\"default:false\" json:\"is_banned\"`
	BanExpiresAt          *time.Time     `json:\"ban_expires_at\"`
	CreatedAt             time.Time      `json:\"created_at\"`
	UpdatedAt             time.Time      `json:\"updated_at\"`
	DeletedAt             gorm.DeletedAt `gorm:\"index\" json:\"-\"`
}

// 🔑 CRITICAL: Assigns UUID before saving so newUser.ID is populated for user-service!
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
