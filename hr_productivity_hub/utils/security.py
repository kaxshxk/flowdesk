import hmac
import hashlib
import json
from core.config import settings


def generate_task_hmac(user_id: int, description: str, timestamp: str) -> str:
    """
    Generate an HMAC-SHA256 signature for a task log entry.
    Uses a sorted JSON-serialized representation of the task data
    to prevent delimiter collisions/ambiguities.
    
    Args:
        user_id (int): The ID of the user creating the task
        description (str): The task description
        timestamp (str): The timestamp of the task creation
        
    Returns:
        str: Hex-encoded HMAC-SHA256 signature
    """
    # Use JSON canonical form to prevent delimiter collisions (e.g. descriptions containing ':')
    data = {
        "user_id": user_id,
        "description": description,
        "timestamp": timestamp
    }
    message = json.dumps(data, sort_keys=True)
    
    # Encode the message and secret key
    message_bytes = message.encode('utf-8')
    secret_key_bytes = settings.HMAC_SECRET_KEY.encode('utf-8')
    
    # Generate HMAC-SHA256 signature
    signature = hmac.new(
        secret_key_bytes,
        message_bytes,
        hashlib.sha256
    ).hexdigest()
    
    return signature