package websocket

import (
	"chat-service/internal/config"
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"
)

type Manager struct {
	Clients      map[*Client]bool
	UserRegistry map[string]map[*Client]bool
	Broadcast    chan []byte
	Register     chan *Client
	Unregister   chan *Client
	mu           sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		Clients:      make(map[*Client]bool),
		UserRegistry: make(map[string]map[*Client]bool),
		Broadcast:    make(chan []byte, 256),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
	}
}

// 🟢 GetOnlineUsers returns a slice of active connected user IDs
func (m *Manager) GetOnlineUsers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	users := make([]string, 0, len(m.UserRegistry))
	for userID := range m.UserRegistry {
		users = append(users, userID)
	}
	return users
}

func (m *Manager) Run() {
	log.Println("🟢 [Connection Manager] Socket Registry & Redis Presence Engine Online")
	ctx := context.Background()

	for {
		select {
		case client := <-m.Register:
			m.mu.Lock()
			m.Clients[client] = true
			if _, exists := m.UserRegistry[client.UserID]; !exists {
				m.UserRegistry[client.UserID] = make(map[*Client]bool)
			}
			m.UserRegistry[client.UserID][client] = true
			m.mu.Unlock()

			// ⚡ Set User Online in Redis with 30s TTL
			if config.RedisClient != nil {
				_ = config.RedisClient.Set(ctx, "user:online:"+client.UserID, "true", 30*time.Second).Err()
			}

			ackMsg, _ := json.Marshal(WSOutgoingFrame{
				Type:      "CONNECTION_ESTABLISHED",
				Content:   "Successfully connected to Redis Presence Hub",
				Timestamp: time.Now(),
			})
			client.Send <- ackMsg

		case client := <-m.Unregister:
			m.mu.Lock()
			if _, ok := m.Clients[client]; ok {
				delete(m.Clients, client)
				close(client.Send)
				if userSockets, exists := m.UserRegistry[client.UserID]; exists {
					delete(userSockets, client)
					if len(userSockets) == 0 {
						delete(m.UserRegistry, client.UserID)
						// ⚡ Remove or let Redis key expire
						if config.RedisClient != nil {
							_ = config.RedisClient.Del(ctx, "user:online:"+client.UserID).Err()
						}
					}
				}
			}
			m.mu.Unlock()

		case data := <-m.Broadcast:
			m.mu.RLock()
			for client := range m.Clients {
				select {
				case client.Send <- data:
				default:
					close(client.Send)
					delete(m.Clients, client)
				}
			}
			m.mu.RUnlock()
		}
	}
}
