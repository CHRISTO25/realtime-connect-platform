package model

import (
	"time"
)

type RefreshToken struct {
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	Token     string    `gorm:"type:varchar(512);uniqueIndex;not null"` // Bumped to 512 for longer JWT strings
	UserID    string    `gorm:"type:uuid;not null"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	ExpiresAt time.Time `gorm:"not null"`
	IsRevoked bool      `gorm:"default:false;not null"` // Added for secure reuse tracking
	CreatedAt time.Time
}
