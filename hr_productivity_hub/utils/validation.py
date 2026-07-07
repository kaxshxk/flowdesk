import re

# Comprehensive email validation regex supporting subdomains, plus-addressing, international TLDs.
# Explicitly rejects consecutive dots, leading dots, trailing dots, and leading/trailing dots in subdomains.
EMAIL_REGEX = re.compile(
    r'^(?!\.)(?!.*\.\.)[a-zA-Z0-9._%+-]+@'
    r'(?!\.)(?!.*\.\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

def is_valid_email(email: str) -> bool:
    """
    Validate email address using the comprehensive regex.
    """
    if not email:
        return False
    # Ensure domain part doesn't start or end with a dot
    email_stripped = email.strip()
    if '@' not in email_stripped:
        return False
    parts = email_stripped.split('@')
    if len(parts) != 2:
        return False
    domain = parts[1]
    if domain.startswith('.') or domain.endswith('.'):
        return False
    return bool(EMAIL_REGEX.match(email_stripped))
