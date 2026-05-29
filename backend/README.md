# Backend Services

## Overview

The backend of Realtime Connect Platform is built using Golang and follows a microservices architecture. Each service is independently deployable and responsible for a specific business domain.

The backend is designed for scalability, maintainability, fault isolation, and real-time communication.

## Services

### API Gateway

Responsibilities:

* Entry point for all client requests
* Request routing
* Authentication middleware
* Rate limiting
* Service aggregation

### Auth Service

Responsibilities:

* User registration
* User login
* JWT token generation
* Password hashing
* Authentication validation

### User Service

Responsibilities:

* User profile management
* User search
* Presence tracking
* Account settings

### Chat Service

Responsibilities:

* Real-time messaging
* WebSocket connections
* Conversation management
* Message persistence
* Group chat support

### Call Service

Responsibilities:

* Voice calling
* Video calling
* WebRTC signaling
* Call session management

## Technology Stack

* Golang
* Gin Framework
* PostgreSQL (NeonDB)
* Redis
* WebSocket
* WebRTC
* Docker

## Project Structure

backend/
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── chat-service/
│   ├── call-service/
│   └── gateway-service/
│
├── docs/
├── shared/
├── pkg/
└── docker-compose.yml

## Development Principles

* Clean Architecture
* Domain Separation
* Stateless Services
* Centralized Logging
* Configuration via Environment Variables
* API-First Design

## Future Enhancements

* Kubernetes Deployment
* Service Discovery
* Distributed Tracing
* Monitoring and Alerting
* CI/CD Pipelines
