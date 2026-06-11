package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(databaseURL string) *gorm.DB {

	db, err := gorm.Open(
		postgres.Open(databaseURL),
		&gorm.Config{},
	)

	if err != nil {
		log.Fatal("Database connection failed", err)
	}

	log.Println("Database connected successfully")

	return db
}
