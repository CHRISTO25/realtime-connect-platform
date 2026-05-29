# Architecture Overview

## High Level Architecture

Client Applications communicate through the API Gateway.

Frontend → API Gateway → Microservices

Services:

1. Auth Service
2. User Service
3. Chat Service
4. Call Service

## Databases

### PostgreSQL

Stores:

* Users
* Profiles
* Conversations
* Messages Metadata

### Redis

Stores:

* Sessions
* Presence Information
* Cache
* Pub/Sub Events

## Communication Flow

### Authentication

Frontend
→ Gateway
→ Auth Service
→ PostgreSQL

### Messaging

Frontend
→ WebSocket
→ Chat Service
→ Redis Pub/Sub
→ PostgreSQL

### Calling

Frontend
→ Call Service
→ WebRTC Signaling
→ Peer Connection

## Security

* JWT Authentication
* Password Hashing using bcrypt
* API Validation
* Rate Limiting
* CORS Protection

## Scalability

* Stateless Services
* Horizontal Scaling
* Redis Pub/Sub
* Containerized Deployment

## Deployment

Docker Compose for local development.

Future deployment:

* Kubernetes
* AWS
* Load Balancers
* CI/CD Pipelines
