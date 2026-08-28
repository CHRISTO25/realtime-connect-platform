package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"shared/jwt"
	"shared/response"
)

// Optional Ban Checker Interface (Only implemented where database access exists, like auth-service)
type BanChecker interface {
	IsUserBanned(ctx context.Context, userID string) (bool, error)
}

// AuthMiddleware accepts a variable number of arguments (variadic parameter)
// so existing services calling AuthMiddleware(jwtSecret) will NEVER break!
func AuthMiddleware(jwtSecret string, checkers ...BanChecker) gin.HandlerFunc {
	var checker BanChecker
	if len(checkers) > 0 {
		checker = checkers[0]
	}

	return func(c *gin.Context) {
		// 1. Extract the Authorization Header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Authorization Header is missing")
			c.Abort()
			return
		}

		// 2. Token Validator: Enforce strict 'Bearer <token>' syntax format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			response.Error(c, http.StatusUnauthorized, "Authorization format must be 'Bearer <token>'")
			c.Abort()
			return
		}

		tokenString := parts[1]

		// 3. User Extraction: Cryptographically validate signature against system secret
		claims, err := jwt.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid or expired access token")
			c.Abort()
			return
		}

		// ⚡ 4. LIVE BAN CHECK (Optional): If a repository/checker is supplied, verify if user is banned
		if checker != nil {
			isBanned, err := checker.IsUserBanned(c.Request.Context(), claims.UserID)
			if err != nil || isBanned {
				response.Error(c, http.StatusForbidden, "Your account has been suspended by an administrator.")
				c.Abort()
				return
			}
		}

		// 5. Inject BOTH key variations to prevent string key mismatches anywhere in the pipeline
		c.Set("userID", claims.UserID)  // Matches c.Get("userID") in handlers
		c.Set("user_id", claims.UserID) // Fallback for any handlers checking "user_id"
		c.Set("user_role", claims.Role) // Injects role context

		// 6. Pass control cleanly onto the destination endpoint handler
		c.Next()
	}
}
