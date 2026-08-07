package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoomType string

const (
	RoomTypeDirect RoomType = "DIRECT"
	RoomTypeGroup  RoomType = "GROUP"
)

type Room struct {
	ID        string       `gorm:"type:uuid;primaryKey" json:"id"`
	Name      string       `gorm:"type:varchar(100)" json:"name,omitempty"`
	Type      RoomType     `gorm:"type:varchar(20);default:'DIRECT'" json:"type"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
	Members   []RoomMember `gorm:"foreignKey:RoomID;constraint:OnDelete:CASCADE" json:"members,omitempty"`
}

func (r *Room) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

// ⚡ RoomMember maps multi-user participants for group chats
type RoomMember struct {
	ID     string `gorm:"type:uuid;primaryKey" json:"id"`
	RoomID string `gorm:"type:uuid;index;not null" json:"room_id"`
	UserID string `gorm:"type:uuid;index;not null" json:"user_id"`
}

func (rm *RoomMember) BeforeCreate(tx *gorm.DB) error {
	if rm.ID == "" {
		rm.ID = uuid.New().String()
	}
	return nil
}

type Message struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	RoomID    string    `gorm:"type:uuid;index:idx_room_created,priority:1;not null" json:"room_id"`
	SenderID  string    `gorm:"type:uuid;index;not null" json:"sender_id"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time `gorm:"index:idx_room_created,priority:2;not null" json:"created_at"`
}

func (m *Message) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now()
	}
	return nil
}
