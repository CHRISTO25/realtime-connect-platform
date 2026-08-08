package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"chat-service/internal/config"
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
		Broadcast:    make(chan []byte, 512), // Buffered high-throughput channel
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
	}
}

func (m *Manager) Run() {
	log.Println("🟢 [Concurrency Engine] High-Throughput Manager Loop Active")
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

			if config.RedisClient != nil {
				_ = config.RedisClient.Set(ctx, "user:online:"+client.UserID, "true", 30*time.Second).Err()
			}

			ackMsg, _ := json.Marshal(WSOutgoingFrame{
				Type:      "CONNECTION_ESTABLISHED",
				Content:   "Successfully connected to Concurrency Hub",
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
						if config.RedisClient != nil {
							_ = config.RedisClient.Del(ctx, "user:online:"+client.UserID).Err()
						}
					}
				}
			}
			m.mu.Unlock()

		case data := <-m.Broadcast:
			// Concurrent RLock allows parallel reads across thousands of connected client sockets
			m.mu.RLock()
			for client := range m.Clients {
				select {
				case client.Send <- data:
				default:
					// Non-blocking write fallback if a client buffer fills up
					go func(cl *Client) {
						m.Unregister <- cl
					}(client)
				}
			}
			m.mu.RUnlock()
		}
	}
}

func (m *Manager) GetOnlineUsers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	users := make([]string, 0, len(m.UserRegistry))
	for userID := range m.UserRegistry {
		users = append(users, userID)
	}
	return users
}
