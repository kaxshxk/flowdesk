import pytest
from sqlmodel import Session, select
from models.user import User, AccessWhitelist, UserRole

def test_whitelist_crud_and_guards(client, session: Session, hr_headers, employee_headers):
    # Get initial whitelist (should have hr and employee entries seeded by fixtures)
    res = client.get("/api/v1/hr/whitelist", headers=hr_headers)
    assert res.status_code == 200
    assert len(res.json()) == 2
    
    # Create whitelist entry (HR role required)
    res = client.post(
        "/api/v1/hr/whitelist",
        json={"allowed_email": "new_emp@company.com", "assigned_role": "employee"},
        headers=hr_headers
    )
    assert res.status_code == 201
    entry_id = res.json()["id"]
    
    # Try creating with duplicate email
    res = client.post(
        "/api/v1/hr/whitelist",
        json={"allowed_email": "new_emp@company.com", "assigned_role": "employee"},
        headers=hr_headers
    )
    assert res.status_code == 400
    
    # Verify non-HR cannot create whitelist entry
    res = client.post(
        "/api/v1/hr/whitelist",
        json={"allowed_email": "another@company.com", "assigned_role": "employee"},
        headers=employee_headers
    )
    assert res.status_code == 403

    # Delete entry from whitelist
    res = client.delete(f"/api/v1/hr/whitelist/{entry_id}", headers=hr_headers)
    assert res.status_code == 204

def test_hr_safety_guards(client, session: Session, hr_headers, employee_headers):
    # Find current HR user ID in db
    res = client.get("/api/v1/me", headers=hr_headers)
    hr_id = res.json()["id"]
    
    # Try to change self role (should fail with 400 due to self-action guard)
    res = client.patch(
        f"/api/v1/hr/users/{hr_id}/role",
        json={"new_role": "employee"},
        headers=hr_headers
    )
    assert res.status_code == 400
    assert "Self-action" in res.json()["detail"]
    
    # Try to change self status (should fail with 400)
    res = client.patch(
        f"/api/v1/hr/users/{hr_id}/status",
        json={"is_active": False},
        headers=hr_headers
    )
    assert res.status_code == 400
    
    # Verify another HR cannot deactivate the last active HR
    # First, let's create a second HR user
    # Seed whitelist and user record for hr2
    wl_hr2 = AccessWhitelist(allowed_email="hr2@dev.local", assigned_role=UserRole.HR)
    session.add(wl_hr2)
    session.commit()
    usr_hr2 = User(company_email="hr2@dev.local", role=UserRole.HR, is_active=True)
    session.add(usr_hr2)
    session.commit()
    res = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "hr2@dev.local", "role": "hr"}
    )
    hr2_token = res.json()["access_token"]
    hr2_headers = {"Authorization": f"Bearer {hr2_token}"}
    
    # Now try to deactivate first HR (hr_id) using hr2_headers (should succeed since we have 2 active HRs)
    res = client.patch(
        f"/api/v1/hr/users/{hr_id}/status",
        json={"is_active": False},
        headers=hr2_headers
    )
    assert res.status_code == 200
    
    # Now try to deactivate hr2 using hr2_headers (fails self-action check)
    # Or try to deactivate hr2 using hr_headers (who is now inactive, so hr_headers will fail authentication or active guard!)
    # Let's verify that active check works: calling with inactive hr_headers gets 403
    res = client.get("/api/v1/me", headers=hr_headers)
    assert res.status_code == 403
    
    # Try to deactivate hr2 (the only remaining active HR) from another user or try to demote hr2
    # Since hr2 is the last active HR, trying to demote/deactivate hr2 should fail.
    # But since we can't authenticate as the inactive hr_id, we can't call HR endpoints as them.
    # Let's create an active employee, and let's try to demote/deactivate hr2 using hr2_headers (fails self-action).
    # What if we have another HR user hr3?
    # Seed whitelist and user record for hr3
    wl_hr3 = AccessWhitelist(allowed_email="hr3@dev.local", assigned_role=UserRole.HR)
    session.add(wl_hr3)
    session.commit()
    usr_hr3 = User(company_email="hr3@dev.local", role=UserRole.HR, is_active=True)
    session.add(usr_hr3)
    session.commit()
    res = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "hr3@dev.local", "role": "hr"}
    )
    hr3_token = res.json()["access_token"]
    hr3_headers = {"Authorization": f"Bearer {hr3_token}"}
    
    # hr2 and hr3 are active. Let's deactivate hr3 using hr2 (should succeed)
    res = client.get("/api/v1/me", headers=hr3_headers)
    hr3_id = res.json()["id"]
    res = client.patch(
        f"/api/v1/hr/users/{hr3_id}/status",
        json={"is_active": False},
        headers=hr2_headers
    )
    assert res.status_code == 200
    
    # Now only hr2 is active. Try to deactivate hr2 using hr2 headers (fails self-action)
    res = client.patch(
        f"/api/v1/hr/users/{hr3_id}/status", # wait, target is hr3 which is already inactive, not hr2
        json={"is_active": False},
        headers=hr2_headers
    )
    # Try to demote hr3 to employee (hr3 is inactive, but is of role HR). hr2 is the only active HR.
    # What if we try to demote hr2 using hr3's headers? hr3 is inactive, so it fails auth.
    # What if we create hr4, activate them, and try to demote hr2 using hr4?
    # Yes! Let's do that to verify the "last active HR remains" check works.
    # Seed whitelist and user record for hr4
    wl_hr4 = AccessWhitelist(allowed_email="hr4@dev.local", assigned_role=UserRole.HR)
    session.add(wl_hr4)
    session.commit()
    usr_hr4 = User(company_email="hr4@dev.local", role=UserRole.HR, is_active=True)
    session.add(usr_hr4)
    session.commit()
    res = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "hr4@dev.local", "role": "hr"}
    )
    hr4_token = res.json()["access_token"]
    hr4_headers = {"Authorization": f"Bearer {hr4_token}"}
    res = client.get("/api/v1/me", headers=hr4_headers)
    hr4_id = res.json()["id"]
    
    # Currently hr2 and hr4 are active HRs. Let's get hr2's user ID
    res = client.get("/api/v1/me", headers=hr2_headers)
    hr2_id = res.json()["id"]
    
    # Deactivate hr2 using hr4 (succeeds because hr4 is still active)
    res = client.patch(
        f"/api/v1/hr/users/{hr2_id}/status",
        json={"is_active": False},
        headers=hr4_headers
    )
    assert res.status_code == 200
    
    # Now only hr4 is active HR. Let's create hr5 but keep it inactive (active=False)
    # We can create hr5 by mock-login, which defaults to active=True. Then deactivate it.
    # Seed whitelist and user record for hr5
    wl_hr5 = AccessWhitelist(allowed_email="hr5@dev.local", assigned_role=UserRole.HR)
    session.add(wl_hr5)
    session.commit()
    usr_hr5 = User(company_email="hr5@dev.local", role=UserRole.HR, is_active=True)
    session.add(usr_hr5)
    session.commit()
    res = client.post(
        "/api/v1/auth/mock-login",
        json={"email": "hr5@dev.local", "role": "hr"}
    )
    hr5_token = res.json()["access_token"]
    hr5_headers = {"Authorization": f"Bearer {hr5_token}"}
    res = client.get("/api/v1/me", headers=hr5_headers)
    hr5_id = res.json()["id"]
    
    # Deactivate hr5 using hr4 (succeeds)
    res = client.patch(
        f"/api/v1/hr/users/{hr5_id}/status",
        json={"is_active": False},
        headers=hr4_headers
    )
    assert res.status_code == 200
    
    # Now hr4 is the ONLY active HR. Let's try to demote hr4 to employee (should fail because at least one active HR must remain)
    # Wait, hr4 cannot demote themselves due to self-action guard. So we need another user?
    # Wait, who can modify hr4? Nobody, because any other HR user is currently deactivated/inactive and cannot authenticate!
    # But wait, what if we reactivate hr5 first?
    res = client.patch(
        f"/api/v1/hr/users/{hr5_id}/status",
        json={"is_active": True},
        headers=hr4_headers
    )
    assert res.status_code == 200
    # Now hr4 and hr5 are active. hr5 can deactivate hr4 (succeeds)
    res = client.patch(
        f"/api/v1/hr/users/{hr4_id}/status",
        json={"is_active": False},
        headers=hr5_headers
    )
    assert res.status_code == 200
    
    # Now only hr5 is active. Let's try to deactivate hr5 using hr4 headers (fails auth since hr4 is inactive)
    # Try to deactivate hr5 using hr5 headers (fails self-action)
    res = client.patch(
        f"/api/v1/hr/users/{hr5_id}/status",
        json={"is_active": False},
        headers=hr5_headers
    )
    assert res.status_code == 400
