package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"shared/jwt"
	"shared/response"
)

func AdminMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Error(c, http.StatusUnauthorized, "Missing authorization header")
			c.Abort()
			return
		}

		tokenParts := len(authHeader) > 7 && authHeader[:7] == "Bearer "
		if !tokenParts {
			response.Error(c, http.StatusUnauthorized, "Invalid authorization format")
			c.Abort()
			return
		}

		tokenStr := authHeader[7:]
		claims, err := jwt.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "Invalid or expired token")
			c.Abort()
			return
		}

		// Check if user has admin role from claims or database lookup
		// (Assuming claims contains a role field, or you verify user role here)
		if claims.Role != "admin" {
			response.Error(c, http.StatusForbidden, "Access denied: Administrator privileges required")
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Next()
	}
}
