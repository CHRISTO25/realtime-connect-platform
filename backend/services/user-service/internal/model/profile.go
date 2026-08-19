package model

import "time"

type UserProfile struct {
	ID          string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID      string    `gorm:"type:uuid;uniqueIndex:idx_user_id;not null" json:"user_id"`
	Username    string    `gorm:"type:varchar(100);index:idx_username" json:"username"`   // ◄ Added for display
	Email       string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`    // ◄ Added for admin directory view
	Role        string    `gorm:"type:varchar(50);default:'user'" json:"role"`            // ◄ Added ('admin' or 'user')
	IsVerified  bool      `gorm:"default:false" json:"is_verified"`                       // ◄ Added verification state
	IsBanned    bool      `gorm:"default:false;index:idx_banned_status" json:"is_banned"` // ◄ Added suspension state
	DisplayName string    `gorm:"type:varchar(100);index:idx_display_name" json:"display_name"`
	Bio         string    `gorm:"type:text" json:"bio"`
	Location    string    `gorm:"type:varchar(100);index:idx_location" json:"location"`
	AvatarURL   string    `gorm:"type:text" json:"avatar_url"`
	CoverURL    string    `gorm:"type:text" json:"cover_url"`
	IsOnline    bool      `gorm:"default:false;index:idx_online_status" json:"is_online"`
	LastSeen    time.Time `json:"last_seen"`
	CreatedAt   time.Time `gorm:"index:idx_created_at" json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
