# JWT Token Configuration and Authorization Middleware

## Overview

This document explains the JWT (JSON Web Token) authentication system implemented in the BikeHub API. The system provides secure token-based authentication with role-based access control (RBAC).

## Architecture

### Components

1. **config_jwt.py** - JWT Configuration
   - Token expiration times
   - Secret keys
   - Algorithm settings
   - Role definitions

2. **api/middleware/auth.py** - Authorization Middleware
   - Authentication decorators
   - Role-based access control decorators
   - Error handling

3. **api/utils/jwt_utils.py** - JWT Utilities
   - Token creation and management
   - Token validation
   - User information extraction

4. **api/routes/auth_routes.py** - Authentication Endpoints
   - User registration
   - Login
   - Token refresh
   - Logout
   - User info retrieval

## Configuration

### JWT Settings (config_jwt.py)

```python
# Token expiration
ACCESS_TOKEN_EXPIRES = 24 hours  # Can be changed via JWT_ACCESS_TOKEN_EXPIRES env var
REFRESH_TOKEN_EXPIRES = 30 days  # Can be changed via JWT_REFRESH_TOKEN_EXPIRES env var

# Security
JWT_SECRET_KEY = 'your-super-secret-jwt-key'  # Change in production
ALGORITHM = 'HS256'

# Token locations
JWT_TOKEN_LOCATION = ['headers', 'cookies', 'json']
JWT_HEADER_TYPE = 'Bearer'
```

### Environment Variables

Create a `.env` file in the Backend root directory:

```bash
# JWT Configuration
JWT_SECRET_KEY=your-secret-key-here-change-in-production
JWT_ACCESS_TOKEN_EXPIRES=24  # in hours
JWT_REFRESH_TOKEN_EXPIRES=30  # in days

# Database
DATABASE_URI=sqlite:///bikehub.db

# Other
DEBUG=False
HOST=0.0.0.0
PORT=9999
```

## Usage Examples

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "username": "john_doe",
  "password": "securePassword123",
  "email": "john@example.com",
  "full_name": "John Doe",
  "role": "USER"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "user_id": 1,
    "username": "john_doe",
    "role": "USER"
  }
}
```

### 2. User Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "username": "john_doe",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "user_id": 1,
      "username": "john_doe",
      "role": "USER"
    }
  }
}
```

### 3. Refresh Access Token

**Endpoint:** `POST /api/auth/refresh`

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400
  }
}
```

### 4. Get Current User Info

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "username": "john_doe",
    "role": "USER",
    "email": "john@example.com",
    "full_name": "John Doe"
  }
}
```

## Decorators for Route Protection

### 1. `@require_auth` - Basic Authentication

Requires valid JWT token. User info is set in `g.user`.

```python
from api.middleware.auth import require_auth

@app.route('/profile')
@require_auth
def get_profile():
    user_id = g.user['user_id']
    role = g.user['role']
    return jsonify({"user_id": user_id, "role": role})
```

### 2. `@require_role(*roles)` - Role-Based Access Control

Requires valid JWT token with specific role(s).

```python
from api.middleware.auth import require_role

# Single role
@app.route('/admin-panel')
@require_role('ADMIN')
def admin_panel():
    return jsonify({"message": "Admin access granted"})

# Multiple roles allowed
@app.route('/seller-dashboard')
@require_role('SELLER', 'ADMIN')
def seller_dashboard():
    return jsonify({"message": "Seller or Admin access"})
```

### 3. `@require_admin` - Admin-Only Access

Shorthand for `@require_role('ADMIN')`.

```python
from api.middleware.auth import require_admin

@app.route('/users/list')
@require_admin
def list_users():
    return jsonify({"users": []})
```

### 4. `@optional_auth` - Optional Authentication

Works with or without authentication. User info is in `g.user` if authenticated, `None` otherwise.

```python
from api.middleware.auth import optional_auth

@app.route('/listings')
@optional_auth
def list_listings():
    user = g.user
    if user:
        return jsonify({"listings": [], "user_id": user['user_id']})
    else:
        return jsonify({"listings": []})
```

### 5. `@log_access` - Access Logging

Logs API access attempts (successful and failed authentication).

```python
from api.middleware.auth import log_access, require_auth

@app.route('/sensitive')
@log_access
@require_auth
def sensitive_endpoint():
    return jsonify({"data": "sensitive"})
```

### 6. `@rate_limit_per_user(requests_per_minute)` - Rate Limiting

Rate limits requests per authenticated user (placeholder implementation).

```python
from api.middleware.auth import rate_limit_per_user, require_auth

@app.route('/expensive-operation')
@require_auth
@rate_limit_per_user(10)
def expensive_operation():
    return jsonify({"result": "computed"})
```

## Role-Based Access Control

### Available Roles

```python
ROLES = {
    'ADMIN': ['read', 'write', 'delete', 'admin'],
    'SELLER': ['read', 'write', 'sell'],
    'BUYER': ['read', 'buy'],
    'INSPECTOR': ['read', 'inspect'],
    'USER': ['read'],
}
```

### Role Hierarchy

```python
ADMIN > SELLER/BUYER/INSPECTOR > USER
```

Admins have access to all permissions. Specific role permissions are handled via `@require_role()` decorator.

## Token Structure

### Access Token Claims

```python
{
    "user_id": 123,
    "role": "SELLER",
    "exp": 1704067200,  # Expiration timestamp
    "iat": 1703980800,  # Issued at timestamp
    "type": "access"
}
```

### Refresh Token Claims

```python
{
    "user_id": 123,
    "role": "SELLER",
    "exp": 1706659200,  # Expiration timestamp (30 days)
    "iat": 1703980800,
    "type": "refresh"
}
```

## Security Best Practices

1. **Use HTTPS in Production** - Always use HTTPS to prevent token interception
2. **Secure Secret Key** - Use a strong, secret key (minimum 32 characters)
3. **Short Access Token Expiration** - Set to 24 hours or less
4. **Long Refresh Token Expiration** - Set to 30 days
5. **Token Blacklist** - Implement token blacklist for logout (built-in support in config)
6. **Secure Cookies** - If using cookies, set `secure` and `httpOnly` flags
7. **CSRF Protection** - Enable CSRF protection for cookie-based tokens

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Insufficient permissions to access this resource"
}
```

## Database Models

The authentication system assumes the following database model for users:

```python
class UserModel(Base):
    user_id: int
    username: str (unique)
    password_hash: str
    email: str (optional)
    full_name: str (optional)
    role: str (ADMIN, SELLER, BUYER, INSPECTOR, USER)
    created_at: datetime
    updated_at: datetime
```

## Testing Authentication

### Using cURL

```bash
# Register
curl -X POST http://localhost:9999/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123",
    "email": "test@example.com",
    "role": "USER"
  }'

# Login
curl -X POST http://localhost:9999/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# Access protected endpoint
curl -X GET http://localhost:9999/api/auth/me \
  -H "Authorization: Bearer <access_token>"

# Refresh token
curl -X POST http://localhost:9999/api/auth/refresh \
  -H "Authorization: Bearer <refresh_token>"
```

### Using Python Requests

```python
import requests

BASE_URL = "http://localhost:9999"

# Register
response = requests.post(
    f"{BASE_URL}/api/auth/register",
    json={
        "username": "testuser",
        "password": "password123",
        "role": "USER"
    }
)
print(response.json())

# Login
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={
        "username": "testuser",
        "password": "password123"
    }
)
tokens = response.json()['data']
access_token = tokens['access_token']

# Access protected endpoint
response = requests.get(
    f"{BASE_URL}/api/auth/me",
    headers={"Authorization": f"Bearer {access_token}"}
)
print(response.json())
```

## Token Refresh Flow

```
1. User logs in → Receives access_token + refresh_token
2. User makes requests → Includes access_token in Authorization header
3. access_token expires → User receives 401 Unauthorized
4. User calls /api/auth/refresh with refresh_token → Gets new access_token
5. User continues with new access_token
```

## Troubleshooting

### Common Issues

1. **"Invalid token"** - Token expired or malformed
   - Solution: Get new token or refresh using refresh token

2. **"Missing Authorization header"** - Token not provided
   - Solution: Include `Authorization: Bearer <token>` header

3. **"Invalid header type"** - Wrong header format
   - Solution: Use `Authorization: Bearer <token>` (with space)

4. **"Invalid claims"** - Token claims cannot be verified
   - Solution: Check JWT secret key matches between server instances

## Future Enhancements

1. **Token Blacklist** - Implement Redis-based token blacklist for logout
2. **Multi-factor Authentication** - Add 2FA support
3. **OAuth2 Integration** - Support third-party providers
4. **Permission-based Access** - More granular permission system
5. **Token Rotation** - Automatically rotate tokens on each refresh
