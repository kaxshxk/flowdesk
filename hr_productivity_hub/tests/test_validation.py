import pytest
from utils.validation import is_valid_email

def test_valid_emails():
    valid = [
        "user@example.com",
        "user+tag@example.com",
        "user.name@example.com",
        "user@sub.domain.example.com",
        "user@domain.museum",
        "user@domain.co.uk",
        "123@domain.org",
        "user@domain-with-dash.com",
    ]
    for email in valid:
        assert is_valid_email(email) is True, f"Failed on valid email: {email}"

def test_invalid_emails():
    invalid = [
        "user",
        "user@",
        "user@example",
        "user@.example.com",
        "user@example.com.",
        "user..name@example.com",
        ".user@example.com",
        "user@example..com",
        "user@example.c",
        "",
        None,
    ]
    for email in invalid:
        assert is_valid_email(email) is False, f"Failed on invalid email: {email}"
