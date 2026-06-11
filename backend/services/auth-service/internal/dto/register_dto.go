package dto

type RegisterRequest struct {
	// min=3 restricts short names, max=32 aligns with database constraints
	Username string `json:"username" binding:"required,min=3,max=32"`
	// email tag forces standard alphanumeric structure containing an '@' and domain
	Email string `json:"email" binding:"required,email"`
	// min=6 forces strong passwords, max=72 matches the upper limit restriction of bcrypt
	Password string `json:"password" binding:"required,min=6,max=72"`
}

type RegisterResponse struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}
