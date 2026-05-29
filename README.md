# Realtime Connect Platform

## Project Overview

Realtime Connect Platform is a scalable real-time communication platform built using a microservices architecture.

The platform supports:

* User Authentication
* User Profile Management
* Real-Time Messaging
* Voice Calling
* Video Calling
* Presence Tracking
* Notifications
* Group Conversations

The goal of the project is to build a production-ready communication platform using modern backend engineering practices.

## Technology Stack

### Backend

* Golang
* Gin Framework
* PostgreSQL
* Redis
* WebSocket
* WebRTC
* Docker

### Frontend

* React
* Vite
* Axios
* React Router DOM

### Infrastructure

* Docker Compose
* Nginx API Gateway
* JWT Authentication

## Microservices

### Auth Service

Responsible for:

* Registration
* Login
* JWT Token Management
* Password Reset

### User Service

Responsible for:

* User Profiles
* User Search
* User Presence

### Chat Service

Responsible for:

* One-to-One Messaging
* Group Messaging
* WebSocket Connections

### Call Service

Responsible for:

* Voice Calls
* Video Calls
* WebRTC Signaling

### Gateway Service

Responsible for:

* Routing Requests
* Authentication Middleware
* Service Discovery

## Development Goals

* Production-grade Architecture
* High Scalability
* Clean Code Structure
* Industry Standard Documentation
* Portfolio-quality Implementation
