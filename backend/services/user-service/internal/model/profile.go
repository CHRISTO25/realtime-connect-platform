package model

import "time"

type UserProfile struct {
	ID          string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      string    `gorm:"type:uuid;uniqueIndex:idx_user_id;not null" json:"user_id"`    // Unique Index for fast lookup
	DisplayName string    `gorm:"type:varchar(100);index:idx_display_name" json:"display_name"` // B-Tree Index for search
	Bio         string    `gorm:"type:text" json:"bio"`
	Location    string    `gorm:"type:varchar(100);index:idx_location" json:"location"` // Index for geo search
	AvatarURL   string    `gorm:"type:text" json:"avatar_url"`
	CoverURL    string    `gorm:"type:text" json:"cover_url"`
	IsOnline    bool      `gorm:"default:false;index:idx_online_status" json:"is_online"`
	LastSeen    time.Time `json:"last_seen"`
	CreatedAt   time.Time `gorm:"index:idx_created_at" json:"created_at"` // Fast sorting for pagination
	UpdatedAt   time.Time `json:"updated_at"`
}
