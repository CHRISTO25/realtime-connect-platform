package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName     string
	AppPort     string
	DatabaseURL string
	JWTSecret   string
	RedisAddr   string
}

func LoadConfig() *Config {
	err := godotenv.Load()

	if err != nil {
		log.Println("No .env file found, loading from system environment variables")
	}

	// ⚡ Smart default: If running locally without Docker, fallback to localhost
	defaultRedis := "redis:6379"
	if os.Getenv("DOCKER_CONTAINER") != "true" && os.Getenv("REDIS_ADDR") == "" {
		defaultRedis = "localhost:6379"
	}

	return &Config{
		AppName:     getEnv("APP_NAME", "AUTH-SERVICE"),
		AppPort:     getEnv("APP_PORT", "8001"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		JWTSecret:   getEnv("JWT_SECRET", "super_secret_jwt_key_12345"),
		RedisAddr:   getEnv("REDIS_ADDR", defaultRedis),
	}
}

func getEnv(key, fallback string) string {
	if val, exists := os.LookupEnv(key); exists {
		return val
	}
	return fallback
}
