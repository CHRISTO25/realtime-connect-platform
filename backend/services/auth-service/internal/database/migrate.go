package database

import (
	"auth-service/internal/model"

	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {

	return db.AutoMigrate(
		&model.User{},
		&model.RefreshToken{},
	)
}
