package database

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Connect initializes GORM using a unified cloud database URI connection string.
// Senior Tip: Return the error back up to main.go instead of crashing the process here.
func Connect(databaseURL string) (*gorm.DB, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("database connection string URL is empty")
	}

	db, err := gorm.Open(
		postgres.Open(databaseURL),
		&gorm.Config{},
	)
	if err != nil {
		// Proper error wrapping gives you exact debugging trace context up the stack
		return nil, fmt.Errorf("failed to open cloud database connection: %w", err)
	}

	log.Println("Successfully connected to Neon DB cloud instance")
	return db, nil
}
