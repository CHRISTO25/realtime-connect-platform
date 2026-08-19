package websocket

import (
	"encoding/json"
	"log"
	"time"

	"chat-service/internal/service"

	gorillaWS "github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // ⚡ 512 KB to support large media payload previews & SDP candidates
)

type Client struct {
	Manager     *Manager
	Conn        *gorillaWS.Conn
	UserID      string
	Send        chan []byte
	ChatService service.ChatService
}

type WSIncomingFrame struct {
	Type     string `json:"type"`
	RoomID   string `json:"room_id"`
	TargetID string `json:"target_id,omitempty"` // Specific receiver for WebRTC P2P
	Content  string `json:"content"`
}

type WSOutgoingFrame struct {
	Type      string    `json:"type"`
	ID        string    `json:"id,omitempty"`
	RoomID    string    `json:"room_id,omitempty"`
	SenderID  string    `json:"sender_id,omitempty"`
	TargetID  string    `json:"target_id,omitempty"` // ⚡ Day 36: Propagate TargetID over Redis mesh
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

func (c *Client) ReadPump() {
	defer func() {
		c.Manager.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMessage, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var frame WSIncomingFrame
		if err := json.Unmarshal(rawMessage, &frame); err != nil {
			continue
		}

		// ⚡ Handle Ephemeral Typing Indicators
		if frame.Type == "TYPING_START" || frame.Type == "TYPING_STOP" {
			roomID := frame.RoomID
			if roomID == "" {
				roomID = "00000000-0000-0000-0000-000000000001"
			}

			typingOutbound := WSOutgoingFrame{
				Type:      frame.Type,
				RoomID:    roomID,
				SenderID:  c.UserID,
				Content:   frame.Content,
				Timestamp: time.Now(),
			}

			outBytes, _ := json.Marshal(typingOutbound)
			c.Manager.Broadcast <- outBytes
			continue
		}

		// ⚡ Handle Delivery & Read Receipt Acknowledgments
		if frame.Type == "DELIVERED_ACK" || frame.Type == "READ_ACK" {
			roomID := frame.RoomID
			if roomID == "" {
				roomID = "00000000-0000-0000-0000-000000000001"
			}

			receiptOutbound := WSOutgoingFrame{
				Type:      frame.Type,
				ID:        frame.Content,
				RoomID:    roomID,
				SenderID:  c.UserID,
				Timestamp: time.Now(),
			}

			outBytes, _ := json.Marshal(receiptOutbound)
			c.Manager.Broadcast <- outBytes
			continue
		}

		// ⚡ Handle WebRTC Signaling, Ringing, and Rejection via Redis mesh
		if frame.Type == "CALL_OFFER" || frame.Type == "CALL_ANSWER" || frame.Type == "ICE_CANDIDATE" || frame.Type == "CALL_END" || frame.Type == "CALL_DECLINED" {
			roomID := frame.RoomID
			if roomID == "" {
				roomID = "00000000-0000-0000-0000-000000000001"
			}

			signalingOutbound := WSOutgoingFrame{
				Type:      frame.Type,
				RoomID:    roomID,
				SenderID:  c.UserID,
				TargetID:  frame.TargetID,
				Content:   frame.Content,
				Timestamp: time.Now(),
			}

			outBytes, _ := json.Marshal(signalingOutbound)
			c.Manager.Broadcast <- outBytes
			continue
		}

		// ⚡ Handle SEND_MESSAGE: Persist to DB, then publish to Redis Pub/Sub
		if frame.Type == "SEND_MESSAGE" && frame.Content != "" {
			roomID := frame.RoomID
			if roomID == "" {
				roomID = "00000000-0000-0000-0000-000000000001"
			}

			savedDTO, err := c.ChatService.SaveMessage(c.UserID, roomID, frame.Content)
			if err != nil {
				log.Printf("❌ [WS Save Error]: %v", err)
				continue
			}

			outbound := WSOutgoingFrame{
				Type:      "NEW_MESSAGE",
				ID:        savedDTO.ID,
				RoomID:    savedDTO.RoomID,
				SenderID:  savedDTO.SenderID,
				Content:   savedDTO.Content,
				Timestamp: savedDTO.CreatedAt,
			}

			outBytes, _ := json.Marshal(outbound)
			c.Manager.Broadcast <- outBytes
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(gorillaWS.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(gorillaWS.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte{'\n'})
				_, _ = w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(gorillaWS.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
