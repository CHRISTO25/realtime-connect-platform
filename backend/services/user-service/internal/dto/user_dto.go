package dto

import "time"

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Bio         string `json:"bio"`
	Location    string `json:"location"`
	AvatarURL   string `json:"avatar_url"`
	CoverURL    string `json:"cover_url"`
}

type UserProfileResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`      // ◄ Ensure this exists
	IsBanned    bool      `json:"is_banned"` // ◄ Ensure this exists
	IsVerified  bool      `json:"is_verified"`
	DisplayName string    `json:"display_name"`
	Bio         string    `json:"bio"`
	Location    string    `json:"location"`
	AvatarURL   string    `json:"avatar_url"`
	CoverURL    string    `json:"cover_url"`
	IsOnline    bool      `json:"is_online"`
	LastSeen    time.Time `json:"last_seen"`
}

type UserListItemResponse struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	Bio         string `json:"bio"`
	Location    string `json:"location"`
	AvatarURL   string `json:"avatar_url"`
	CoverURL    string `json:"cover_url"`
	IsOnline    bool   `json:"is_online"` // 👈 ADD THIS FIELD!
	IsFollowing bool   `json:"is_following"`
	IsBanned    bool   `json:"is_banned"`
}

type GetAllUserResponse struct {
	Data       []UserListItemResponse `json:"data"`
	TotalCount int                    `json:"total_count"`
	Page       int                    `json:"page"`
	PerPage    int                    `json:"per_page"`
}

type SearchUsersRequest struct {
	Query    string `form:"query"`
	Location string `form:"location"`
	Page     int    `form:"page,default=1"`
	Limit    int    `form:"limit,default=10"`
}

type PaginatedUsersResponse struct {
	Users      interface{} `json:"users"`
	TotalCount int64       `json:"total_count"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
	HasNext    bool        `json:"has_next"`
}
