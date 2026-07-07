import os
import time
import pytest
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from utils.rate_limit import rate_limit

app = FastAPI()

@app.get("/test-ip")
def api_ip_route(_rate = Depends(rate_limit(2, 5))):
    return {"message": "success"}

@app.get("/test-user")
def api_user_route(_rate = Depends(rate_limit(2, 5))):
    return {"message": "success"}

def test_rate_limit_by_ip():
    # Force enable rate limiter for testing
    os.environ["FORCE_RATE_LIMIT"] = "true"
    try:
        client = TestClient(app)
        
        # Request 1 (Success)
        res = client.get("/test-ip")
        assert res.status_code == 200
        
        # Request 2 (Success)
        res = client.get("/test-ip")
        assert res.status_code == 200
        
        # Request 3 (Rate Limited)
        res = client.get("/test-ip")
        assert res.status_code == 429
        assert "Rate limit exceeded" in res.json()["detail"]
    finally:
        if "FORCE_RATE_LIMIT" in os.environ:
            del os.environ["FORCE_RATE_LIMIT"]

def test_rate_limit_by_user():
    os.environ["FORCE_RATE_LIMIT"] = "true"
    try:
        client = TestClient(app)
        import jwt
        
        # Make tokens for two distinct users
        token1 = jwt.encode({"user_id": 101}, "secret", algorithm="HS256")
        token2 = jwt.encode({"user_id": 102}, "secret", algorithm="HS256")
        
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # User 1 consumes their limit
        assert client.get("/test-user", headers=headers1).status_code == 200
        assert client.get("/test-user", headers=headers1).status_code == 200
        assert client.get("/test-user", headers=headers1).status_code == 429
        
        # User 2 is unaffected (isolated limit state)
        assert client.get("/test-user", headers=headers2).status_code == 200
        assert client.get("/test-user", headers=headers2).status_code == 200
        assert client.get("/test-user", headers=headers2).status_code == 429
    finally:
        if "FORCE_RATE_LIMIT" in os.environ:
            del os.environ["FORCE_RATE_LIMIT"]
