import pytest
from sqlmodel import Session, select
from models.leavewfhrequest import LeaveWFHRequest, RequestStatus, RequestType

def test_request_lifecycle(client, employee_headers, hr_headers):
    # 1. Create a request as Employee
    payload = {
        "request_type": "leave",
        "start_date": "2026-07-10",
        "end_date": "2026-07-15",
        "justification": "Summer vacation trip"
    }
    res = client.post("/api/v1/requests", json=payload, headers=employee_headers)
    assert res.status_code == 201
    req_id = res.json()["id"]
    assert res.json()["status"] == "pending"
    assert res.json()["request_type"] == "leave"
    
    # 2. Review the request as HR (Approve it)
    review_payload = {
        "status": "approved",
        "hr_note": "Approved, enjoy your trip!",
        "updated_request_type": "leave"
    }
    res = client.patch(
        f"/api/v1/hr/requests/{req_id}/review",
        json=review_payload,
        headers=hr_headers
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"
    assert res.json()["hr_note"] == "Approved, enjoy your trip!"
    
    # 3. Test validation error (end_date earlier than start_date)
    payload_bad = {
        "request_type": "wfh",
        "start_date": "2026-07-15",
        "end_date": "2026-07-10", # End date before start date
        "justification": "Invalid dates"
    }
    res = client.post("/api/v1/requests", json=payload_bad, headers=employee_headers)
    assert res.status_code == 422
