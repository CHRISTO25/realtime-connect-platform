package utils

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type UserProfileFallback struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	IsDegraded  bool   `json:"is_degraded"`
}

type UserServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewUserServiceClient(baseURL string) *UserServiceClient {
	return &UserServiceClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 2 * time.Second, // 2s timeout prevents cascading chat latency
		},
	}
}

func (c *UserServiceClient) GetUserProfile(ctx context.Context, userID string) (*UserProfileFallback, error) {
	reqURL := fmt.Sprintf("%s/api/v1/users/profile/%s", c.baseURL, userID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return c.fallback(userID), err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		// user-service unreachable, timed out, or returning 5xx -> Fallback
		return c.fallback(userID), nil
	}
	defer resp.Body.Close()

	var apiResp struct {
		Success bool `json:"success"`
		Data    struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil || !apiResp.Success {
		return c.fallback(userID), nil
	}

	return &UserProfileFallback{
		ID:          apiResp.Data.ID,
		DisplayName: apiResp.Data.DisplayName,
		AvatarURL:   apiResp.Data.AvatarURL,
		IsDegraded:  false,
	}, nil
}

func (c *UserServiceClient) fallback(userID string) *UserProfileFallback {
	return &UserProfileFallback{
		ID:          userID,
		DisplayName: "User (" + userID[:min(len(userID), 6)] + ")",
		AvatarURL:   "",
		IsDegraded:  true,
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
