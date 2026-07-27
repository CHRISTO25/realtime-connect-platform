FROM golang:1.25-alpine AS builder

WORKDIR /app

# 1. Copy workspace configuration maps
COPY go.work go.work.sum* ./

# 2. Copy ALL modules referenced by the workspace layout
COPY shared/ ./shared/
COPY services/user-service/ ./services/user-service/
COPY services/auth-service/ ./services/auth-service/

# 3. Synchronize dependencies cleanly across the copied workspace
RUN go work sync

# 4. Navigate into user-service and build the binary
WORKDIR /app/services/user-service
RUN CGO_ENABLED=0 GOOS=linux go build -o /user-service ./cmd/main.go

# Minimal deployment runner image context
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /user-service /user-service
EXPOSE 8002
ENTRYPOINT ["/user-service"]