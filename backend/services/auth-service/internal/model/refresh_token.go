package model

import (
	"time"
)

type RefreshToken struct {
	ID    uint   `gorm:"primaryKey;autoIncrement"`
	Token string `gorm:"type:varchar(255);uniqueIndex;not null"`

	// Changed from uint to string to match User.ID (UUID)
	UserID string `gorm:"type:uuid;not null"`
	User   User   `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	ExpiresAt time.Time `gorm:"not null"`
	CreatedAt time.Time
}
