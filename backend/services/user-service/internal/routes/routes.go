package routes

import (
	"shared/middleware"
	"user-service/internal/handler"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, h *handler.UserHandler, friendH *handler.FriendHandler, blockH *handler.BlockHandler, jwtSecret string) {
	// 1. Base User Service Group (/api/v1/users)
	v1 := router.Group("/api/v1/users")
	{
		v1.POST("/internal/init", h.InitProfile)
		v1.GET("/internal/status", h.GetInternalUserStatus)
		v1.PATCH("/internal/admin/ban/:id", h.AdminInternalToggleBan) // ◄ CRITICAL FIX: Added internal sync route for bans from auth-service
		v1.GET("/profile/:id", h.GetProfile)
		v1.POST("/presence/offline/beacon", h.MarkOffline)

		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware(jwtSecret))
		{
			protected.PUT("/profile", h.UpdateProfile)
			protected.POST("/profile/avatar", h.UploadAvatar)
			protected.POST("/profile/cover", h.UploadCover)
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

	// 2. Direct Fallback Shorthands
	directProtected := router.Group("")
	directProtected.Use(middleware.AuthMiddleware(jwtSecret))
	{
		directProtected.POST("/heartbeat", h.Heartbeat)
		directProtected.POST("/logout", h.Logout) // ◄ Added shorthand fallback for logout
		directProtected.GET("/search", h.SearchUsers)
		directProtected.GET("/allProfile", h.GetallUsers)
		directProtected.GET("/friends/list", friendH.GetFriendsList)
		directProtected.GET("/friends/pending", friendH.GetPendingRequests)
		directProtected.GET("/profile", h.GetProfile)
		directProtected.PUT("/profile", h.UpdateProfile)
	}

	// 3. Admin Control Group matching exactly what the gateway proxies: /api/v1/admin
	adminGroup := router.Group("/api/v1/admin")
	adminGroup.Use(middleware.AuthMiddleware(jwtSecret))
	{
		adminGroup.GET("/users", h.AdminGetUsers)
		adminGroup.PATCH("/users/:id/ban", h.AdminToggleBan)
	}
}
