import pytest
from sqlmodel import Session
from datetime import datetime

def test_clock_in_clock_out_lifecycle(client, employee_headers):
    # Check status (should be clocked out)
    res = client.get("/api/v1/time/status", headers=employee_headers)
    assert res.status_code == 200
    assert res.json()["is_clocked_in"] is False
    
    # Clock in
    res = client.post("/api/v1/time/clock-in", headers=employee_headers)
    assert res.status_code == 201
    assert res.json()["clock_out"] is None
    
    # Try clocking in again (should fail)
    res = client.post("/api/v1/time/clock-in", headers=employee_headers)
    assert res.status_code == 400
    
    # Check status (should be clocked in)
    res = client.get("/api/v1/time/status", headers=employee_headers)
    assert res.status_code == 200
    assert res.json()["is_clocked_in"] is True
    
    # Clock out
    res = client.post("/api/v1/time/clock-out", headers=employee_headers)
    assert res.status_code == 200
    assert res.json()["clock_out"] is not None
    
    # Try clocking out again (should fail)
    res = client.post("/api/v1/time/clock-out", headers=employee_headers)
    assert res.status_code == 400
    
    # Check status (should be clocked out)
    res = client.get("/api/v1/time/status", headers=employee_headers)
    assert res.status_code == 200
    assert res.json()["is_clocked_in"] is False
