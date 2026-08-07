package repository

import (
	"chat-service/internal/model"
	"log"

	"gorm.io/gorm"
)

type chatRepository struct {
	db *gorm.DB
}

func NewChatRepository(db *gorm.DB) ChatRepository {
	return &chatRepository{db: db}
}

func (r *chatRepository) CreateRoom(room *model.Room) error {
	return r.db.Create(room).Error
}

func (r *chatRepository) GetOrCreateDefaultRoom(roomID string) (*model.Room, error) {
	var room model.Room
	err := r.db.Where("id = ?", roomID).First(&room).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			room = model.Room{
				ID:   roomID,
				Name: "Global Lounge",
				Type: model.RoomTypeGroup,
			}
			if createErr := r.db.Create(&room).Error; createErr != nil {
				log.Printf("❌ [DB Error - Create Default Room]: %v", createErr)
				return nil, createErr
			}
			return &room, nil
		}
		log.Printf("❌ [DB Error - Get Default Room]: %v", err)
		return nil, err
	}
	return &room, nil
}

func (r *chatRepository) SaveMessage(msg *model.Message) error {
	err := r.db.Create(msg).Error
	if err != nil {
		log.Printf("❌ [DB Error - Save Message]: %v", err)
	}
	return err
}

func (r *chatRepository) GetRoomMessages(roomID string, limit int) ([]model.Message, error) {
	var messages []model.Message
	if limit <= 0 {
		limit = 50
	}
	err := r.db.Where("room_id = ?", roomID).
		Order("created_at ASC").
		Limit(limit).
		Find(&messages).Error

	if err != nil {
		log.Printf("❌ [DB Error - Get Room Messages]: %v", err)
	}
	return messages, err
}

func (r *chatRepository) CreateGroupRoom(room *model.Room, memberIDs []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(room).Error; err != nil {
			log.Printf("❌ [DB Transaction Error - Create Room]: %v", err)
			return err
		}
		for _, uid := range memberIDs {
			member := model.RoomMember{
				RoomID: room.ID,
				UserID: uid,
			}
			if err := tx.Create(&member).Error; err != nil {
				log.Printf("❌ [DB Transaction Error - Add Member %s]: %v", uid, err)
				return err
			}
		}
		return nil
	})
}

func (r *chatRepository) GetUserRooms(userID string) ([]model.Room, error) {
	var rooms []model.Room
	err := r.db.Joins("JOIN room_members ON room_members.room_id = rooms.id").
		Where("room_members.user_id = ? OR rooms.type = 'GLOBAL'", userID).
		Distinct().
		Find(&rooms).Error

	if err != nil {
		log.Printf("❌ [DB Error - GetUserRooms for %s]: %v", userID, err)
	}
	return rooms, err
}
