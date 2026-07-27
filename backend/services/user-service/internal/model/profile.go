package model

import "time"

type UserProfile struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      string    `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	DisplayName string    `gorm:"type:varchar(100);not null" json:"display_name"`
	Bio         string    `gorm:"type:text" json:"bio"`
	AvatarURL   string    `gorm:"type:text" json:"avatar_url"`
	CoverURL    string    `gorm:"type:text" json:"cover_url"` // ◄ COVER PHOTO
	Location    string    `gorm:"type:varchar(100)" json:"location"`
	IsOnline    bool      `gorm:"default:false" json:"is_online"`
	LastSeen    time.Time `json:"last_seen"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
