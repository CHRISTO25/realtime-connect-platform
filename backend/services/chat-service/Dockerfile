FROM golang:1.25-alpine AS builder

WORKDIR /app

# 1. Copy workspace tracker files
COPY go.work go.work.sum* ./

# 2. Copy ALL workspace modules (needed so 'go work sync' finds all registered modules)
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/
COPY services/user-service/ ./services/user-service/
COPY services/chat-service/ ./services/chat-service/

# 3. Sync dependencies across the workspace
RUN go work sync

# 4. Navigate into chat-service and compile binary
WORKDIR /app/services/chat-service
RUN CGO_ENABLED=0 GOOS=linux go build -o /chat-service ./cmd/main.go

# Minimal runner container setup
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /chat-service /chat-service

EXPOSE 8003
ENTRYPOINT ["/chat-service"]