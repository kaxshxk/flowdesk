from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List


class FileLogResponse(BaseModel):
    """
    Outbound representation of a single FileLog database record.
    """

    id: int
    user_id: int
    file_name: str
    google_drive_file_id: str
    drive_folder_path: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class FileListResponse(BaseModel):
    """
    Paginated wrapper returned by list endpoints.
    """

    total: int
    files: List[FileLogResponse]
