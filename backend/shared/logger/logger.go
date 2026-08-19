package logger

import (
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Log *zap.Logger

// InitLogger initializes a production-ready JSON structured Zap logger
func InitLogger() {
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		zap.InfoLevel,
	)

	Log = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))
}

// ZapLoggerMiddleware extracts or generates a Trace ID, logs requests in JSON format, and injects headers
func ZapLoggerMiddleware() gin.HandlerFunc {
	// Ensure global logger is initialized if not already
	if Log == nil {
		InitLogger()
	}

	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// 1. Extract Correlation / Trace ID from incoming request headers, or generate a new UUID
		traceID := c.GetHeader("X-Request-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		// 2. Attach trace ID to response headers and request context for downstream services
		c.Header("X-Request-ID", traceID)
		c.Set("trace_id", traceID)

		c.Next()

		// 3. Compute execution telemetry
		latency := time.Since(start)
		status := c.Writer.Status()

		// 4. Output structured JSON log with Zap
		Log.Info("HTTP Request Executed",
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
