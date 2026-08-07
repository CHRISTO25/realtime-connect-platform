package routes

import (
	"github.com/gin-gonic/gin"
	"shared/middleware"
	"user-service/internal/handler"
)

func SetupRoutes(router *gin.Engine, h *handler.UserHandler, friendH *handler.FriendHandler, blockH *handler.BlockHandler, jwtSecret string) {
	v1 := router.Group("/api/v1/users")
	{
		v1.POST("/internal/init", h.InitProfile)
		v1.GET("/profile/:id", h.GetProfile)
		v1.POST("/presence/offline/beacon", h.MarkOffline) // Public endpoint for Beacon API on tab exit

		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(jwtSecret))
		{
			protected.PUT("/profile", h.UpdateProfile)
			protected.POST("/profile/avatar", h.UploadAvatar) // ◄ AVATAR UPLOAD ROUTE
			protected.POST("/profile/cover", h.UploadCover)   // ◄ COVER UPLOAD ROUTE
			protected.GET("/allProfile", h.GetallUsers)
			protected.GET("/search", h.SearchUsers)
			protected.POST("/logout", h.Logout)
			protected.POST("/heartbeat", h.Heartbeat)
			protected.POST("/presence/offline", h.MarkOffline)

			protected.POST("/friends/request", friendH.SendRequest)
			protected.POST("/friends/accept", friendH.AcceptRequest)
			protected.POST("/friends/reject", friendH.RejectRequest)
			protected.GET("/friends/pending", friendH.GetPendingRequests)
			protected.GET("/friends/list", friendH.GetFriendsList)
			protected.POST("/friends/unfriend", friendH.Unfriend)

			protected.POST("/block/:id", blockH.BlockUser)
			protected.DELETE("/block/:id", blockH.UnblockUser)
			protected.GET("/block/list", blockH.GetBlockedList)
			protected.GET("/block/ids", blockH.GetBlockedIDs)

		}
	}
}
