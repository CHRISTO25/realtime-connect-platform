# Day 4: User Registration System (Authentication Core)

## 🎯 Objectives
- Implement an automated database user registration API (`POST /api/v1/auth/register`).
- Establish a domain-driven architectural flow: Handlers ➔ DTOs ➔ Services ➔ Repositories.
- Enforce strict security validation, Bcrypt password hashing, and duplicate email assertions.

## 🛠️ Completed Tasks

### 1. Data Contract Tier (DTOs)
- **`RegisterRequest`**: Structured payload mapping featuring automated validation tags for incoming fields (`Email`, `Username`, `Password`).
- **`RegisterResponse`**: Standardized response signature issuing custom string-based UUID identifiers.

### 2. Multi-Layer Application Distribution
- **Handler**: Binds HTTP body strings via Gin, managing client request contexts defensively.
- **Service**: Orchestrates business decisions, intercepting duplicate submissions and hashing user raw strings with `golang.org/x/crypto/bcrypt`.
- **Repository**: Performs database scans via GORM using transaction contexts (`.WithContext(ctx)`).

### 3. Database Architecture Optimization
- Configured a custom GORM lifecycle hook (`BeforeCreate`) within the `User` model to natively provision client-side string-UUID v4 blocks.
- Unified a single `FindByEmail` method to prevent repository code duplication and maintain DRY development patterns.

## 🔍 Postman Test Configurations Saved
- **Successful Register (201 Created)**: Verifies error-free record allocation inside Neon Cloud Postgres.
- **Validation Failure (400 Bad Request)**: Confirms enforcement of string lengths and malformed emails.
- **Duplicate Email Handshake (409 Conflict)**: Asserts validation blocks match structural `ErrEmailAlreadyExists` errors.