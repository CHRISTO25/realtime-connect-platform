// package model

// import "time"

// const (
// 	RequestStatusPending  = "pending"
// 	RequestStatusAccepted = "accepted"
// 	RequestStatusRejected = "rejected"
// )

// type FriendRequest struct {
// 	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	// Composite Index: Accelerates receiver_id + status queries (GetPendingRequests)
// 	SenderID   string    `gorm:"type:uuid;index:idx_sender_receiver;index:idx_sender_status,priority:1;not null" json:"sender_id"`
// 	ReceiverID string    `gorm:"type:uuid;index:idx_sender_receiver;index:idx_receiver_status,priority:1;not null" json:"receiver_id"`
// 	Status     string    `gorm:"type:varchar(20);default:'pending';index:idx_receiver_status,priority:2;index:idx_sender_status,priority:2" json:"status"`
// 	CreatedAt  time.Time `gorm:"index:idx_req_created" json:"created_at"`
// 	UpdatedAt  time.Time `json:"updated_at"`

// 	Sender   UserProfile `gorm:"foreignKey:SenderID;references:UserID" json:"sender,omitempty"`
// 	Receiver UserProfile `gorm:"foreignKey:ReceiverID;references:UserID" json:"receiver,omitempty"`
// }

// type Friend struct {
// 	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	// Unique Composite Index prevents duplicate friendships at DB layer
// 	UserID    string    `gorm:"type:uuid;uniqueIndex:idx_user_friend,priority:1;not null" json:"user_id"`
// 	FriendID  string    `gorm:"type:uuid;uniqueIndex:idx_user_friend,priority:2;not null" json:"friend_id"`
// 	CreatedAt time.Time `json:"created_at"`

// 	FriendProfile UserProfile `gorm:"foreignKey:FriendID;references:UserID" json:"friend_profile,omitempty"`
// }

// type BlockedUser struct {
// 	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
// 	// Composite Indexes for bidirectional block checks
// 	BlockerID string    `gorm:"type:uuid;uniqueIndex:idx_blocker_blocked,priority:1;index:idx_blocker;not null" json:"blocker_id"`
// 	BlockedID string    `gorm:"type:uuid;uniqueIndex:idx_blocker_blocked,priority:2;index:idx_blocked;not null" json:"blocked_id"`
// 	CreatedAt time.Time `json:"created_at"`

// 	BlockedProfile UserProfile `gorm:"foreignKey:BlockedID;references:UserID" json:"blocked_profile,omitempty"`
// }

package model

import "time"

const (
	RequestStatusPending  = "pending"
	RequestStatusAccepted = "accepted"
	RequestStatusRejected = "rejected"
)

type FriendRequest struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid();<-:create" json:"id"`

	// Composite Unique Index prevents duplicate pending requests between the same users
	SenderID   string    `gorm:"type:uuid;uniqueIndex:idx_sender_receiver_req,priority:1;index:idx_sender_status,priority:1;not null" json:"sender_id"`
	ReceiverID string    `gorm:"type:uuid;uniqueIndex:idx_sender_receiver_req,priority:2;index:idx_receiver_status,priority:1;not null" json:"receiver_id"`
	Status     string    `gorm:"type:varchar(20);default:'pending';index:idx_receiver_status,priority:2;index:idx_sender_status,priority:2" json:"status"`
	CreatedAt  time.Time `gorm:"index:idx_req_created" json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	Sender   UserProfile `gorm:"foreignKey:SenderID;references:UserID" json:"sender,omitempty"`
	Receiver UserProfile `gorm:"foreignKey:ReceiverID;references:UserID" json:"receiver,omitempty"`
}

func (FriendRequest) TableName() string {
	return "friend_requests"
}

type Friend struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid();<-:create" json:"id"`

	// Unique Composite Index prevents duplicate friendships at the DB layer
	UserID    string    `gorm:"type:uuid;uniqueIndex:idx_user_friend,priority:1;not null" json:"user_id"`
	FriendID  string    `gorm:"type:uuid;uniqueIndex:idx_user_friend,priority:2;not null" json:"friend_id"`
	CreatedAt time.Time `json:"created_at"`

	FriendProfile UserProfile `gorm:"foreignKey:FriendID;references:UserID" json:"friend_profile,omitempty"`
}

func (Friend) TableName() string {
	return "friends"
}

type BlockedUser struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid();<-:create" json:"id"`

	// Composite Indexes for bidirectional block lookups
	BlockerID string    `gorm:"type:uuid;uniqueIndex:idx_blocker_blocked,priority:1;index:idx_blocker;not null" json:"blocker_id"`
	BlockedID string    `gorm:"type:uuid;uniqueIndex:idx_blocker_blocked,priority:2;index:idx_blocked;not null" json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`

	BlockedProfile UserProfile `gorm:"foreignKey:BlockedID;references:UserID" json:"blocked_profile,omitempty"`
}

func (BlockedUser) TableName() string {
	return "blocked_users"
}
