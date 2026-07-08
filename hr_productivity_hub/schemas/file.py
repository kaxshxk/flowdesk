from pydantic import BaseModel, field_validator, field_serializer
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

    @field_serializer("timestamp")
    def serialize_dt(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

    model_config = {"from_attributes": True}


class FileListResponse(BaseModel):
    """
    Paginated wrapper returned by list endpoints.
    """

    total: int
    files: List[FileLogResponse]
