package config

import (
	"github.com/joho/godotenv"
	"log"
	"os"
)

type Config struct {
	AppName     string
	AppPort     string
	JWTSecret   string
	DatabaseURL string
}

func LoadConfig() *Config {
	// Attempt loading local .env if present
	if err := godotenv.Load(); err != nil {
		log.Println("Note: No .env file found in chat-service, reading system envs")
	}

	return &Config{
		AppName:     getEnv("APP_NAME", "CHAT-SERVICE"),
		AppPort:     getEnv("APP_PORT", "8003"),
		JWTSecret:   getEnv("JWT_SECRET", "mysecretkey"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
	}
}

func getEnv(key, fallback string) string {
	if val, exists := os.LookupEnv(key); exists {
		return val
	}
	return fallback
}
