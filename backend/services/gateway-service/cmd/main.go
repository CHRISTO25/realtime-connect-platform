package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"shared.local/jwt"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// Shared HTTP Transport configured for Render HTTPS routing and connection pooling
var defaultTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	DialContext: (&net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext,
	TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
	TLSHandshakeTimeout:   10 * time.Second,
	ResponseHeaderTimeout: 15 * time.Second,
	ExpectContinueTimeout: 1 * time.Second,
	MaxIdleConns:          100,
	IdleConnTimeout:       90 * time.Second,
}

var internalHTTPClient = &http.Client{
	Timeout:   2 * time.Second,
	Transport: defaultTransport,
}

// BackendNode represents a single upstream microservice instance in the pool
type BackendNode struct {
	URL   *url.URL
	Proxy *httputil.ReverseProxy
	Alive bool
	mux   sync.RWMutex
}

func (node *BackendNode) SetAlive(alive bool) {
	node.mux.Lock()
	defer node.mux.Unlock()
	node.Alive = alive
}

func (node *BackendNode) IsAlive() bool {
	node.mux.RLock()
	defer node.mux.RUnlock()
	return node.Alive
}

// LoadBalancer manages dynamic health checks and round-robin failover routing
type LoadBalancer struct {
	nodes   []*BackendNode
	current uint64
}

func NewLoadBalancer(targets []string) *LoadBalancer {
	var nodes []*BackendNode

	for _, target := range targets {
		trimmed := strings.TrimSpace(target)
		if trimmed == "" {
			continue
		}

		proxy, err := createReverseProxy(trimmed)
		if err != nil {
			log.Printf("⚠️ [LoadBalancer] Invalid target URL %s: %v", trimmed, err)
			continue
		}

		parsedURL, _ := url.Parse(trimmed)
		nodes = append(nodes, &BackendNode{
			URL:   parsedURL,
			Proxy: proxy,
			Alive: true,
		})
	}

	lb := &LoadBalancer{nodes: nodes}
	if len(nodes) > 0 {
		go lb.startHealthCheckRoutine()
	}
	return lb
}

func (lb *LoadBalancer) startHealthCheckRoutine() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		for _, node := range lb.nodes {
			targetURL := strings.TrimRight(node.URL.String(), "/") + "/health"
			req, err := http.NewRequest(http.MethodGet, targetURL, nil)
			if err != nil {
				continue
			}

			resp, err := internalHTTPClient.Do(req)
			healthy := err == nil && resp.StatusCode < http.StatusBadRequest

			if !healthy {
				altURL := strings.TrimRight(node.URL.String(), "/") + "/api/v1/chat/health"
				if altReq, altErr := http.NewRequest(http.MethodGet, altURL, nil); altErr == nil {
					if altResp, altDoErr := internalHTTPClient.Do(altReq); altDoErr == nil {
						healthy = altResp.StatusCode < http.StatusBadRequest
						_ = altResp.Body.Close()
					}
				}
			}

			if resp != nil {
				_ = resp.Body.Close()
			}

			if healthy {
				if !node.IsAlive() {
					node.SetAlive(true)
					log.Printf("🟢 [HealthCheck] Node %s RECOVERED. Restored to pool.", node.URL.String())
				}
			} else {
				if node.IsAlive() {
					node.SetAlive(false)
					log.Printf("🔴 [HealthCheck] Node %s DOWN. Removed from pool.", node.URL.String())
				}
			}
		}
	}
}

func (lb *LoadBalancer) GetNextHealthyNode() (*BackendNode, bool) {
	total := len(lb.nodes)
	if total == 0 {
		return nil, false
	}

	for i := 0; i < total; i++ {
		idx := atomic.AddUint64(&lb.current, 1) % uint64(total)
		node := lb.nodes[idx]
		if node.IsAlive() {
			return node, true
		}
	}

	return lb.nodes[0], false
}

func createReverseProxy(target string) (*httputil.ReverseProxy, error) {
	parsedURL, err := url.Parse(strings.TrimSpace(target))
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(parsedURL)
	proxy.Transport = defaultTransport

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = parsedURL.Host
		req.URL.Scheme = parsedURL.Scheme
		req.URL.Host = parsedURL.Host
		req.Header.Del("X-Forwarded-Host")
		req.Header.Del("X-Forwarded-Proto")
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		return nil
	}

	targetStr := parsedURL.String()
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("❌ [Gateway 502] Target: %s | Path: %s | Error: %v", targetStr, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(gin.H{
			"success": false,
			"error":   fmt.Sprintf("Downstream service unreachable (%s)", targetStr),
		})
	}

	return proxy, nil
}

// checkUserBanStatus queries user-service to ensure banned users are rejected immediately
func checkUserBanStatus(ctx context.Context, userServiceURL, userID string) bool {
	endpoint := fmt.Sprintf("%s/api/v1/users/internal/status?user_id=%s", strings.TrimRight(userServiceURL, "/"), url.QueryEscape(userID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false
	}

	resp, err := internalHTTPClient.Do(req)
	if err != nil || resp == nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	var statusData struct {
		Success bool `json:"success"`
		Data    struct {
			IsBanned bool `json:"is_banned"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&statusData); err != nil {
		return false
	}

	return statusData.Data.IsBanned
}

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super_secret_jwt_key_12345"
	}

	authURL := os.Getenv("AUTH_SERVICE_URL")
	if authURL == "" {
		authURL = "http://auth-service:8001"
	}

	userURL := os.Getenv("USER_SERVICE_URL")
	if userURL == "" {
		userURL = "http://user-service:8002"
	}

	chatNode1 := os.Getenv("CHAT_SERVICE_1_URL")
	if chatNode1 == "" {
		chatNode1 = os.Getenv("CHAT_SERVICE_URL")
	}
	if chatNode1 == "" {
		chatNode1 = "http://chat-service-1:8003"
	}

	chatNode2 := os.Getenv("CHAT_SERVICE_2_URL")
	if chatNode2 == "" {
		chatNode2 = "http://chat-service-2:8003"
	}

	log.Printf("⚡ [Gateway Init] Auth: %s | User: %s | Chat Nodes: [%s, %s]", authURL, userURL, chatNode1, chatNode2)

	authProxy, err := createReverseProxy(authURL)
	if err != nil {
		log.Fatalf("Fatal: Invalid Auth URL: %v", err)
	}

	userProxy, err := createReverseProxy(userURL)
	if err != nil {
		log.Fatalf("Fatal: Invalid User URL: %v", err)
	}

	chatLB := NewLoadBalancer([]string{chatNode1, chatNode2})

	r := gin.Default()

	// Global CORS Handler
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-User-ID, X-User-Role")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Gateway Health API
	r.GET("/health", func(c *gin.Context) {
		activeNodes := make([]string, 0)
		for _, n := range chatLB.nodes {
			if n.IsAlive() {
				activeNodes = append(activeNodes, n.URL.String())
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"service":        "api-gateway",
			"status":         "operational",
			"active_nodes":   activeNodes,
			"total_capacity": len(chatLB.nodes),
		})
	})

	// ==========================================
	// 1. PUBLIC AUTH ROUTES
	// ==========================================
	r.Any("/api/v1/auth/*path", func(c *gin.Context) {
		authProxy.ServeHTTP(c.Writer, c.Request)
	})

	// ==========================================
	// 2. PROTECTED ROUTES & CENTRALIZED JWT GUARD
	// ==========================================
	authGroup := r.Group("/")
	authGroup.Use(func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Missing authorization token"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := jwt.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid or expired authorization token"})
			c.Abort()
			return
		}

		if checkUserBanStatus(c.Request.Context(), userURL, claims.UserID) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Your account has been suspended by an administrator."})
			c.Abort()
			return
		}

		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)
		c.Next()
	})

	// User Service Path Normalization
	userForwarder := func(c *gin.Context) {
		path := c.Request.URL.Path
		if !strings.HasPrefix(path, "/api/v1/users") {
			c.Request.URL.Path = "/api/v1/users" + path
		}
		userProxy.ServeHTTP(c.Writer, c.Request)
	}

	authGroup.Any("/api/v1/users/*path", func(c *gin.Context) {
		userProxy.ServeHTTP(c.Writer, c.Request)
	})

	authGroup.Any("/api/v1/admin/*path", func(c *gin.Context) {
		authProxy.ServeHTTP(c.Writer, c.Request)
	})

	authGroup.Any("/friends/*path", userForwarder)
	authGroup.Any("/block/*path", userForwarder)
	authGroup.Any("/block", userForwarder)
	authGroup.Any("/search", userForwarder)
	authGroup.Any("/allProfile", userForwarder)
	authGroup.Any("/profile/*path", userForwarder)
	authGroup.Any("/profile", userForwarder)
	authGroup.Any("/heartbeat", userForwarder)
	authGroup.Any("/logout", userForwarder)

	// Chat REST Routes
	authGroup.Any("/api/v1/chat/*path", func(c *gin.Context) {
		node, _ := chatLB.GetNextHealthyNode()
		if node != nil {
			node.Proxy.ServeHTTP(c.Writer, c.Request)
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "No chat nodes available"})
		}
	})

	// ==========================================
	// 3. WEBSOCKET ROUTING
	// ==========================================
	r.GET("/ws", func(c *gin.Context) {
		tokenStr := c.Query("token")
		if tokenStr == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Missing token for WebSocket handshake"})
			return
		}

		claims, err := jwt.ValidateToken(tokenStr, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Invalid token for WebSocket handshake"})
			return
		}

		if checkUserBanStatus(c.Request.Context(), userURL, claims.UserID) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Your account has been suspended by an administrator."})
			return
		}

		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)

		node, _ := chatLB.GetNextHealthyNode()
		if node != nil {
			node.Proxy.ServeHTTP(c.Writer, c.Request)
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "Chat service nodes offline"})
		}
	})

	log.Printf("⚡ API Gateway operational on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start gateway server: %v", err)
	}
}
