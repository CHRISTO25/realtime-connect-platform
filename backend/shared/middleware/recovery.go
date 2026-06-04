package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Recovery() gin.HandlerFunc {

	return func(c *gin.Context) {

		defer func() {

			if err := recover(); err != nil {

				c.JSON(http.StatusInternalServerError,
					gin.H{
						"success": false,
						"message": "Internal Server Error",
					},
				)

				c.Abort()
			}
		}()

		c.Next()
	}
}
