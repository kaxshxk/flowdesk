# AGENTS.md

## Repository Overview
This repository contains the HR-Productivity Hub, a FastAPI-based backend for an HR productivity application.

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

## Setup Commands
1. Create virtual environment: `python -m venv venv`
2. Activate virtual environment: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
3. Install dependencies: `pip install -r requirements.txt`
4. Copy and configure environment: `cp .env.example .env`
5. Run application: `python startup.py`

## Development Commands
- Run with auto-reload: `python startup.py --reload`
- Run on specific host/port: `python startup.py --host 0.0.0.0 --port 8080`

## Key Features
- Google OIDC Authentication via `POST /api/v1/auth/google`
- Role-based access control (HR/Employee)
- JWT token management
- PostgreSQL database with SQLModel
- Environment-based configuration

## Important Dependencies
- FastAPI for API framework
- SQLModel for ORM
- Pydantic-settings for configuration
- PyJWT for token management
- psycopg2 for PostgreSQL connectivity

## Authentication Flow
1. User authenticates with Google
2. Backend verifies Google token (mocked in development)
3. Email checked against AccessWhitelist
4. User record fetched or created
5. JWT token returned with user info

## Security Considerations
- Never commit .env files to version control
- SECRET_KEY should be unique in production
- DATABASE_URL should use secure credentials in production
- CORS origins should be restricted in production