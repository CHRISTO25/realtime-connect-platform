package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"shared/jwt"      // Resolves natively via your root go.work setup
	"shared/response" // Reuses your standardized response layout
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
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

		// 4. Inject BOTH key variations to prevent string key mismatches anywhere in the pipeline
		c.Set("userID", claims.UserID)  // 👈 CRITICAL FIX: Matches c.Get("userID") in UserHandler!
		c.Set("user_id", claims.UserID) // 👈 Fallback for any handlers checking "user_id"

		// 5. Pass control cleanly onto the destination endpoint handler
		c.Next() // 👈 CRITICAL FIX: Continues handler execution chain!
	}
}
