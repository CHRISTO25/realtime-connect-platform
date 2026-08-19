# Stage 1: Build binary
FROM golang:1.25-alpine AS builder

WORKDIR /app

# 1. Copy workspace tracker files
COPY go.work go.work.sum* ./

# 2. Copy workspace modules
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/
COPY services/user-service/ ./services/user-service/
COPY services/chat-service/ ./services/chat-service/
COPY services/gateway-service/ ./services/gateway-service/

# 3. Sync dependencies
RUN go work sync

# 4. Compile binary with stripped symbols for memory optimization
WORKDIR /app/services/auth-service
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /auth-service ./cmd/main.go

# Stage 2: Minimal runner container setup
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /
COPY --from=builder /auth-service /auth-service
EXPOSE 8001
ENTRYPOINT ["/auth-service"]