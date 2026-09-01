package main

import (
	"encoding/json"
	"log"
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

// Global shared HTTP client with timeout for internal gateway queries
var internalHTTPClient = &http.Client{
	Timeout: 2 * time.Second,
}

// BackendNode represents a single microservice node in the load balancing pool
type BackendNode struct {
	URL   *url.URL
	Proxy *httputil.ReverseProxy
	Alive bool
	mux   sync.RWMutex
}

func (node *BackendNode) SetAlive(alive bool) {
	node.mux.Lock()
	node.Alive = alive
	node.mux.Unlock()
}

func (node *BackendNode) IsAlive() bool {
	node.mux.RLock()
	defer node.mux.RUnlock()
	return node.Alive
}

// LoadBalancer manages dynamic health checks and failover routing across replicas
type LoadBalancer struct {
	nodes   []*BackendNode
	current uint64
}

func NewLoadBalancer(targets []string) *LoadBalancer {
	var nodes []*BackendNode

	for _, target := range targets {
		trimmedTarget := strings.TrimSpace(target)
		if trimmedTarget == "" {
			continue
		}

		parsedURL, err := url.Parse(trimmedTarget)
		if err != nil {
			log.Printf("⚠️ Invalid target upstream URL %s: %v", trimmedTarget, err)
			continue
		}

		proxy := httputil.NewSingleHostReverseProxy(parsedURL)
		originalDirector := proxy.Director

		proxy.Director = func(req *http.Request) {
			originalDirector(req)
			req.Host = parsedURL.Host
			req.URL.Scheme = parsedURL.Scheme
			req.URL.Host = parsedURL.Host
			req.Header.Del("X-Forwarded-Host")
		}

		// Strip downstream duplicate CORS headers
		proxy.ModifyResponse = func(resp *http.Response) error {
			resp.Header.Del("Access-Control-Allow-Origin")
			resp.Header.Del("Access-Control-Allow-Credentials")
			resp.Header.Del("Access-Control-Allow-Methods")
			resp.Header.Del("Access-Control-Allow-Headers")
			return nil
		}

		targetCopy := trimmedTarget
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("❌ [Gateway Error] Target %s unreachable for %s: %v", targetCopy, r.URL.Path, err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`{"success":false,"error":"Microservice node is offline or unreachable"}`))
		}

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

// Dynamic Background Health Checker
func (lb *LoadBalancer) startHealthCheckRoutine() {
	client := http.Client{Timeout: 2000 * time.Millisecond}

	for {
		time.Sleep(3 * time.Second)
		for _, node := range lb.nodes {
			healthURL := strings.TrimRight(node.URL.String(), "/") + "/health"
			resp, err := client.Get(healthURL)

			if err != nil || resp.StatusCode >= 400 {
				healthURL = strings.TrimRight(node.URL.String(), "/") + "/api/v1/chat/health"
				resp, err = client.Get(healthURL)
			}

			if err != nil || (resp != nil && resp.StatusCode >= 500) {
				if node.IsAlive() {
					node.SetAlive(false)
					log.Printf("🔴 [Health Check Failover] Node %s DOWN. Dropped from balancing pool.", node.URL.String())
				}
			} else {
				if !node.IsAlive() {
					node.SetAlive(true)
					log.Printf("🟢 [Health Check Failover] Node %s RECOVERED. Restored into balancing pool.", node.URL.String())
				}
			}

			if resp != nil {
				_ = resp.Body.Close()
			}
		}
	}
}

// GetNextHealthyNode picks an active, healthy node with round-robin failover
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

func createProxy(target string) (*httputil.ReverseProxy, error) {
	trimmedTarget := strings.TrimSpace(target)
	parsedURL, err := url.Parse(trimmedTarget)
	if err != nil {
		return nil, err
	}
	proxy := httputil.NewSingleHostReverseProxy(parsedURL)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = parsedURL.Host
		req.URL.Scheme = parsedURL.Scheme
		req.URL.Host = parsedURL.Host
		req.Header.Del("X-Forwarded-Host")
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("❌ [Gateway 502 Error] Target %s unreachable for URL %s: %v", trimmedTarget, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"success":false,"error":"Downstream microservice is offline or unreachable"}`))
	}

	return proxy, nil
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

	log.Printf("⚡ Gateway Routing -> Auth: %s | User: %s | Chat Nodes: [%s, %s]", authURL, userURL, chatNode1, chatNode2)

	authProxy, err := createProxy(authURL)
	if err != nil {
		log.Fatalf("Fatal: Invalid Auth URL: %v", err)
	}

	userProxy, err := createProxy(userURL)
	if err != nil {
		log.Fatalf("Fatal: Invalid User URL: %v", err)
	}

	chatLB := NewLoadBalancer([]string{chatNode1, chatNode2})

	r := gin.Default()

	// Global Dynamic CORS Middleware
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

	// Gateway Health & Cluster Node Metrics API
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
	// 1. PUBLIC AUTH ROUTES (:8001) — NO JWT GUARD
	// ==========================================
	r.Any("/api/v1/auth/*path", func(c *gin.Context) {
		authProxy.ServeHTTP(c.Writer, c.Request)
	})

	// ==========================================
	// 2. CENTRALIZED JWT GUARD & LIVE BAN ENFORCEMENT
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

		// Instant Gateway Ban Enforcement Check
		statusEndpoint := strings.TrimRight(userURL, "/") + "/api/v1/users/internal/status?user_id=" + url.QueryEscape(claims.UserID)
		statusReq, reqErr := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, statusEndpoint, nil)
		if reqErr == nil {
			statusResp, statusErr := internalHTTPClient.Do(statusReq)
			if statusErr == nil && statusResp != nil {
				defer statusResp.Body.Close()
				if statusResp.StatusCode == http.StatusOK {
					var statusData struct {
						Success bool `json:"success"`
						Data    struct {
							IsBanned bool `json:"is_banned"`
						} `json:"data"`
					}
					if json.NewDecoder(statusResp.Body).Decode(&statusData) == nil {
						if statusData.Data.IsBanned {
							c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Your account has been suspended by an administrator."})
							c.Abort()
							return
						}
					}
				}
			}
		}

		// Inject verified metadata headers downstream
		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)
		c.Next()
	})

	// Path Normalization for user-service (:8002)
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

	// Shorthand Fallback Mappings to user-service
	authGroup.Any("/friends/*path", userForwarder)
	authGroup.Any("/block/*path", userForwarder)
	authGroup.Any("/block", userForwarder)
	authGroup.Any("/search", userForwarder)
	authGroup.Any("/allProfile", userForwarder)
	authGroup.Any("/profile/*path", userForwarder)
	authGroup.Any("/profile", userForwarder)
	authGroup.Any("/heartbeat", userForwarder)
	authGroup.Any("/logout", userForwarder)

	// Balanced Chat REST routes
	authGroup.Any("/api/v1/chat/*path", func(c *gin.Context) {
		node, _ := chatLB.GetNextHealthyNode()
		if node != nil {
			node.Proxy.ServeHTTP(c.Writer, c.Request)
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "No chat nodes available"})
		}
	})

	// ==========================================
	// 3. WEBSOCKET TUNNEL (FAILOVER BALANCED)
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

		// Instant WebSocket Handshake Ban Check
		statusEndpoint := strings.TrimRight(userURL, "/") + "/api/v1/users/internal/status?user_id=" + url.QueryEscape(claims.UserID)
		statusReq, reqErr := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, statusEndpoint, nil)
		if reqErr == nil {
			statusResp, statusErr := internalHTTPClient.Do(statusReq)
			if statusErr == nil && statusResp != nil {
				defer statusResp.Body.Close()
				if statusResp.StatusCode == http.StatusOK {
					var statusData struct {
						Success bool `json:"success"`
						Data    struct {
							IsBanned bool `json:"is_banned"`
						} `json:"data"`
					}
					if json.NewDecoder(statusResp.Body).Decode(&statusData) == nil {
						if statusData.Data.IsBanned {
							c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Your account has been suspended by an administrator."})
							return
						}
					}
				}
			}
		}

		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)

		node, isHealthy := chatLB.GetNextHealthyNode()
		if node != nil {
			log.Printf("🔀 [Gateway WebSocket Proxy] Handshake -> Node: %s (Healthy: %v) for User: %s", node.URL.String(), isHealthy, claims.UserID)
			node.Proxy.ServeHTTP(c.Writer, c.Request)
		} else {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "Chat service nodes offline"})
		}
	})

	log.Printf("⚡ API Gateway operational on :%s (Self-Healing Load Balancer Active)", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start gateway server: %v", err)
	}
}
