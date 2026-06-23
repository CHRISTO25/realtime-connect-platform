package dto

// UserResponse defines the exact secure data fields sent back to the React frontend
type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}
