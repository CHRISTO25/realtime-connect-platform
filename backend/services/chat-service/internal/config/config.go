package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName        string
	AppPort        string
	JWTSecret      string
	DatabaseURL    string
	UserServiceURL string // ⚡ Day 35: Inter-service communication endpoint
}

func LoadConfig() *Config {
	// Attempt loading local .env if present
	if err := godotenv.Load(); err != nil {
		log.Println("Note: No .env file found in chat-service, reading system envs")
	}

	return &Config{
		AppName:        getEnv("APP_NAME", "CHAT-SERVICE"),
		AppPort:        getEnv("APP_PORT", "8003"),
		JWTSecret:      getEnv("JWT_SECRET", "super_secret_jwt_key_12345"),
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		UserServiceURL: getEnv("USER_SERVICE_URL", "http://user-service:8002"),
	}
}

func getEnv(key, fallback string) string {
	if val, exists := os.LookupEnv(key); exists && val != "" {
		return val
	}
	return fallback
}
