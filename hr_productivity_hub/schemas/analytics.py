from pydantic import BaseModel
from datetime import date
from typing import List, Optional


class HRDashboardSummary(BaseModel):
    """
    Consolidated statistical snapshot of the company.
    """

    total_employees: int
    currently_clocked_in: int
    pending_leaves_count: int
    unresolved_alerts_count: int


class PayrollReportItem(BaseModel):
    """
    Payroll & compliance metrics for a single employee.
    """

    user_id: int
    company_email: str
    total_hours_worked: float
    approved_leave_days: int
    approved_wfh_days: int
    tasks_logged_count: int


class PayrollReportResponse(BaseModel):
    """
    Wrapper for a JSON payroll report.
    """

    total: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    records: List[PayrollReportItem]
