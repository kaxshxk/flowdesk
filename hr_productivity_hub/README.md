# HR-Productivity Hub

A secure HR-Productivity Hub built with FastAPI.

## Features

- Google OIDC Authentication
- Role-based access control (HR/Employee)
- Secure JWT token management
- PostgreSQL database with SQLModel
- Environment-based configuration

## Project Structure

```
hr_productivity_hub/
├── api/                 # API routes
├── core/                # Core configuration and database
├── models/              # Database models
├── services/            # Business logic
├── utils/               # Utility functions
├── main.py             # FastAPI application
├── startup.py          # Application startup script
├── requirements.txt    # Python dependencies
└── .env.example        # Environment variables example
```

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run the application:
   ```bash
   python startup.py
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/google` - Google authentication

### General
- `GET /api/v1/health` - Health check
- `GET /api/v1/me` - Get current user info (protected)

### HR Management (HR role required)
- `GET /api/v1/hr/dashboard` - HR dashboard
- `POST /api/v1/hr/whitelist` - Add email to whitelist
- `GET /api/v1/hr/whitelist` - Get all whitelist entries
- `DELETE /api/v1/hr/whitelist/{whitelist_id}` - Remove email from whitelist
- `GET /api/v1/hr/employees` - Get all employees
- `PATCH /api/v1/hr/users/{user_id}/role` - Update user role
- `PATCH /api/v1/hr/users/{user_id}/status` - Update user active status

### Time Tracking (Employee and HR)
- `GET /api/v1/time/status` - Check clock in status
- `POST /api/v1/time/clock-in` - Clock in
- `POST /api/v1/time/clock-out` - Clock out
- `GET /api/v1/time/stats` - Get weekly and monthly hours

### HR Time Management (HR role required)
- `GET /api/v1/hr/time/stats/{user_id}` - Get specific user's time stats

## Security

- JWT tokens are used for authentication
- Role-based access control implemented
- Google OAuth for secure authentication
- CORS support configurable via environment variables