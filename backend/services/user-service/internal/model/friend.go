package model

import "time"

const (
	RequestStatusPending  = "pending"
	RequestStatusAccepted = "accepted"
	RequestStatusRejected = "rejected"
)

type FriendRequest struct {
	ID         string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SenderID   string    `gorm:"type:uuid;index;not null" json:"sender_id"`
	ReceiverID string    `gorm:"type:uuid;index;not null" json:"receiver_id"`
	Status     string    `gorm:"type:varchar(20);default:'pending'" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	// Relations
	Sender   UserProfile `gorm:"foreignKey:SenderID;references:UserID" json:"sender,omitempty"`
	Receiver UserProfile `gorm:"foreignKey:ReceiverID;references:UserID" json:"receiver,omitempty"`
}

type Friend struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"type:uuid;index;not null" json:"user_id"`
	FriendID  string    `gorm:"type:uuid;index;not null" json:"friend_id"`
	CreatedAt time.Time `json:"created_at"`

	// Relations
	FriendProfile UserProfile `gorm:"foreignKey:FriendID;references:UserID" json:"friend_profile,omitempty"`
}

type BlockedUser struct {
	ID        string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BlockerID string    `gorm:"type:uuid;index;not null" json:"blocker_id"`
	BlockedID string    `gorm:"type:uuid;index;not null" json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`

	// Foreign key relations for JSON preloading
	BlockedProfile UserProfile `gorm:"foreignKey:BlockedID;references:UserID" json:"blocked_profile,omitempty"`
}
