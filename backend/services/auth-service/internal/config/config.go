package config

import (
	"github.com/joho/godotenv"
	"log"
	"os"
)

type Config struct {
	AppName     string
	AppPort     string
	DatabaseURL string
	JWTSecret   string
}

func LoadConfig() *Config {
	err := godotenv.Load()

	if err != nil {
		log.Println("No .env file found")
	}

	return &Config{
		AppName:     os.Getenv("APP_NAME"),
		AppPort:     os.Getenv("APP_PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
	}
}
