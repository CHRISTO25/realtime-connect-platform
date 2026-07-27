package dto

type SendFriendRequest struct {
	ReceiverID string `json:"receiver_id" binding:"required"`
}

type RespondFriendRequest struct {
	RequestID string `json:"request_id" binding:"required"`
}

type PendingRequestResponse struct {
	ID          string `json:"request_id"`
	SenderID    string `json:"sender_id"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	CreatedAt   string `json:"created_at"`
}
