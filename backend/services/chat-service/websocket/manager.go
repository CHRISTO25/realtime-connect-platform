package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"chat-service/internal/config"
)

const RedisChatChannel = "chat_broadcast_channel"

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
	log.Println("🟢 [Concurrency Engine] High-Throughput Manager Loop Active with Redis Pub/Sub")
	ctx := context.Background()

	// ⚡ DAY 36: Start distributed Redis Pub/Sub subscriber goroutine
	if config.RedisClient != nil {
		go m.listenRedisPubSub()
	}

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
			// ⚡ DAY 36: Publish local outbound events to Redis so ALL instances/nodes receive it
			if config.RedisClient != nil {
				err := config.RedisClient.Publish(ctx, RedisChatChannel, data).Err()
				if err != nil {
					log.Printf("⚠️ [Redis PubSub Error] Failed to publish event: %v. Broadcasting locally.", err)
					m.broadcastLocally(data)
				}
			} else {
				m.broadcastLocally(data)
			}
		}
	}
}

// ⚡ DAY 36: Listens to the Redis distributed channel and fans out frames to local WebSocket connections
func (m *Manager) listenRedisPubSub() {
	ctx := context.Background()
	pubsub := config.RedisClient.Subscribe(ctx, RedisChatChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	log.Printf("⚡ [Redis PubSub] Subscribed to distributed channel: %s", RedisChatChannel)

	for msg := range ch {
		m.broadcastLocally([]byte(msg.Payload))
	}
}

// broadcastLocally routes payloads to target user or all connected local sockets
func (m *Manager) broadcastLocally(data []byte) {
	var frame WSOutgoingFrame
	// If the frame has a specific TargetID (e.g., P2P WebRTC calls), route directly to target user sockets
	if err := json.Unmarshal(data, &frame); err == nil && frame.TargetID != "" {
		m.mu.RLock()
		targetClients, exists := m.UserRegistry[frame.TargetID]
		if exists && len(targetClients) > 0 {
			for client := range targetClients {
				select {
				case client.Send <- data:
				default:
					go func(cl *Client) { m.Unregister <- cl }(client)
				}
			}
			m.mu.RUnlock()
			return
		}
		m.mu.RUnlock()
	}

	// General room or broadcast delivery
	m.mu.RLock()
	defer m.mu.RUnlock()

	for client := range m.Clients {
		select {
		case client.Send <- data:
		default:
			// Non-blocking write fallback if a client buffer is exhausted
			go func(cl *Client) {
				m.Unregister <- cl
			}(client)
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
