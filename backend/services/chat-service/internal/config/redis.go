package config

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

func InitRedis() *redis.Client {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = os.Getenv("REDIS_URL")
	}
	if redisAddr == "" {
		redisAddr = "localhost:6379" // inside docker compose: redis:6379
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	var options *redis.Options

	// Handle both full connection URLs (redis://user:pass@host:port) and host:port strings
	if strings.HasPrefix(redisAddr, "redis://") || strings.HasPrefix(redisAddr, "rediss://") {
		opt, err := redis.ParseURL(redisAddr)
		if err != nil {
			log.Printf("⚠️ [Redis Config] Failed to parse connection URL (%s): %v. Using fallback.", redisAddr, err)
			options = &redis.Options{
				Addr:     "localhost:6379",
				Password: redisPassword,
				DB:       0,
			}
		} else {
			options = opt
		}
	} else {
		options = &redis.Options{
			Addr:     redisAddr,
			Password: redisPassword,
			DB:       0,
		}
	}

	RedisClient = redis.NewClient(options)

	// Quick connection health ping with 3s timeout
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		log.Printf("⚠️ Warning: Failed to connect to Redis at %s: %v. Running in local memory fallback mode.", options.Addr, err)
	} else {
		log.Printf("🟢 [Redis PubSub] Connected successfully to distributed event mesh at %s", options.Addr)
	}

	return RedisClient
}
