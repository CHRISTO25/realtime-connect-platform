package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"shared/logger"
)

func ZapLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// 1. Extract or generate a unique Trace/Correlation ID
		traceID := c.GetHeader("X-Request-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}
		c.Header("X-Request-ID", traceID)
		c.Set("trace_id", traceID)

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		// 2. Log structured JSON telemetry via Zap
		logger.Log.Info("HTTP Request Processed",
			zap.String("trace_id", traceID),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("client_ip", c.ClientIP()),
		)
	}
}
