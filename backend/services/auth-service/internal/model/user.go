package model

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type User struct {
	ID        string `gorm:"primaryKey;type:uuid"`
	Username  string `gorm:"type:varchar(32);not null"`
	Email     string `gorm:"type:varchar(100);uniqueIndex;not null"`
	Password  string `gorm:"type:varchar(255);not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// BeforeCreate hook to automatically generate UUIDs before inserting
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	u.ID = uuid.New().String()
	return
}
