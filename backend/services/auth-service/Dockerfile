# --- Stage 1: Build Environment ---
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy the core workspace configurations and shared dependencies
COPY go.work go.work.sum ./
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/

# Navigate to the service root and compile a highly optimized static binary
WORKDIR /app/services/auth-service
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o auth-service ./cmd/main.go

# --- Stage 2: Minimalist Production Image ---
FROM alpine:3.19

WORKDIR /app

# Copy exclusively the binary and local environment parameters from builder
COPY --from=builder /app/services/auth-service/auth-service .
COPY --from=builder /app/services/auth-service/.env .

EXPOSE 8001

CMD ["./auth-service"]