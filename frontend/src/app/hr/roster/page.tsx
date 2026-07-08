"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";
import { isValidEmail } from "@/utils/validation";

interface WhitelistEntry {
  id: number;
  allowed_email: string;
  assigned_role: "employee" | "hr";
  created_by_hr_id: number;
  created_at: string;
}

interface Employee {
  id: number;
  company_email: string;
  role: "employee" | "hr";
  is_active: boolean;
  created_at: string;
}

interface RosterRow {
  email: string;
  role: "employee" | "hr";
  status: "active" | "inactive" | "pending";
  whitelistId: number | null;
  userId: number | null;
}

export default function WhitelistRoster() {
  const router = useRouter();
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"employee" | "hr">("employee");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch whitelist and registered employees concurrently
      const [whitelistRes, employeesRes] = await Promise.all([
        api.get<WhitelistEntry[]>("/hr/whitelist"),
        api.get<Employee[]>("/hr/employees"),
      ]);

      setWhitelist(whitelistRes);
      setEmployees(employeesRes);
    } catch (err: any) {
      setError(err?.message || "Failed to load HR roster data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Merged view helper
  const getRosterRows = (): RosterRow[] => {
    const rows: RosterRow[] = [];
    const processedEmails = new Set<string>();

    // 1. Add all registered employees first
    employees.forEach((emp) => {
      // Find matching whitelist entry if any
      const match = whitelist.find((w) => w.allowed_email.toLowerCase() === emp.company_email.toLowerCase());
      rows.push({
        email: emp.company_email,
        role: emp.role,
        status: emp.is_active ? "active" : "inactive",
        whitelistId: match ? match.id : null,
        userId: emp.id,
      });
      processedEmails.add(emp.company_email.toLowerCase());
    });

    // 2. Add whitelist entries that haven't registered yet
    whitelist.forEach((w) => {
      if (!processedEmails.has(w.allowed_email.toLowerCase())) {
        rows.push({
          email: w.allowed_email,
          role: w.assigned_role,
          status: "pending",
          whitelistId: w.id,
          userId: null,
        });
      }
    });

    // Sort by email alphabetically
    return rows.sort((a, b) => a.email.localeCompare(b.email));
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;

    // Client-side email validation
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.post("/hr/whitelist", {
        allowed_email: email,
        assigned_role: newRole,
        job_title: newJobTitle.trim() || null,
        department: newDepartment.trim() || null,
      });

      setNewEmail("");
      setNewJobTitle("");
      setNewDepartment("");
      setSuccess(`Successfully whitelisted email "${email}"!`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to add email to whitelist.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: "employee" | "hr") => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.patch(`/hr/users/${userId}/role`, {
        new_role: newRole,
      });

      setSuccess("User role updated successfully.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to update user role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.patch(`/hr/users/${userId}/status`, {
        is_active: !currentStatus,
      });

      setSuccess(`User account ${!currentStatus ? "reactivated" : "deactivated"} successfully.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to toggle account status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWhitelist = async (whitelistId: number, email: string) => {
    if (!confirm(`Are you sure you want to revoke whitelist access for ${email}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      await api.delete(`/hr/whitelist/${whitelistId}`);

      setSuccess(`Revoked whitelist access for "${email}".`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete whitelist entry.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <TeamsShell title="HR Roster & Whitelist Control">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText">Roster & Whitelist Manager</h1>
        <p className="text-sm text-contrastText/70 mt-1">
          Add allowed company emails to the whitelist, toggle user account lifecycles, and edit authorization roles.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-primaryAccent/15 rounded-2xl text-sm text-primaryAccent">
          <span></span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-successBadge rounded-2xl text-sm text-contrastText">
          <span></span>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Whitelist Addition Form */}
        <div className="bg-cardBacking shadow-ambient border border-secondaryElement/20 shadow-[0_8px_30px_rgb(0,0,0,0.01)] rounded-2xl p-6 h-fit flex flex-col gap-4">
          <h3 className="text-md font-bold text-contrastText">Whitelist New Employee</h3>
          <form onSubmit={handleAddWhitelist} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/70" htmlFor="emailInput">
                Company Email Address
              </label>
              <input
                id="emailInput"
                type="email"
                className="w-full bg-canvasBg/40 border border-secondaryElement/30 focus:border-primaryAccent focus:ring-2 focus:ring-rosewood/10 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/30 transition-all outline-none"
                placeholder="e.g. employee@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={actionLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/70" htmlFor="roleSelect">
                Assigned Role
              </label>
              <select
                id="roleSelect"
                className="w-full bg-canvasBg/40 border border-secondaryElement/30 focus:border-primaryAccent focus:ring-2 focus:ring-rosewood/10 rounded-xl px-3 py-2.5 text-sm text-contrastText outline-none"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "employee" | "hr")}
                disabled={actionLoading}
              >
                <option value="employee">Employee</option>
                <option value="hr">HR Administrator</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/70" htmlFor="jobTitleInput">
                Job Title (Optional)
              </label>
              <input
                id="jobTitleInput"
                type="text"
                className="w-full bg-canvasBg/40 border border-secondaryElement/30 focus:border-primaryAccent focus:ring-2 focus:ring-rosewood/10 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/30 transition-all outline-none"
                placeholder="e.g. Senior Software Engineer"
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-contrastText/70" htmlFor="departmentInput">
                Department (Optional)
              </label>
              <input
                id="departmentInput"
                type="text"
                className="w-full bg-canvasBg/40 border border-secondaryElement/30 focus:border-primaryAccent focus:ring-2 focus:ring-rosewood/10 rounded-xl px-4 py-3 text-sm text-contrastText placeholder-contrastText/30 transition-all outline-none"
                placeholder="e.g. Product Engineering"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-primaryAccent hover:bg-primaryAccent/95 hover:shadow-lg hover:shadow-ambient transition-all text-canvasBg font-semibold text-sm rounded-xl"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-canvasBg"></div>
              ) : (
                "Add to Whitelist"
              )}
            </button>
          </form>
        </div>

        {/* Combined Whitelist & Employee Data Table */}
        <div className="lg:col-span-2 bg-cardBacking shadow-ambient border border-secondaryElement/20 shadow-[0_8px_30px_rgb(0,0,0,0.01)] rounded-2xl p-6">
          <h3 className="text-md font-bold text-contrastText mb-4">Whitelisted & Registered Accounts</h3>
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-canvasBg/50 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-canvasBg/50 rounded animate-pulse"></div>
            </div>
          ) : getRosterRows().length === 0 ? (
            <div className="text-center py-12 text-contrastText/40">
              <span className="text-3xl block mb-2"></span>
              <p className="text-sm">Roster is empty. Add users to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-secondaryElement/20 text-contrastText/50 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-misty-sky/10 text-contrastText/85">
                  {getRosterRows().map((row) => (
                    <tr key={row.email} className="hover:bg-canvasBg/15 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-contrastText">{row.email}</td>
                      <td className="py-3.5 px-4">
                        {row.userId ? (
                          <select
                            value={row.role}
                            onChange={(e) => handleRoleChange(row.userId!, e.target.value as "employee" | "hr")}
                            disabled={actionLoading}
                            className="bg-canvasBg/20 border border-secondaryElement/25 text-xs rounded-lg px-2 py-1 text-contrastText outline-none focus:border-primaryAccent"
                          >
                            <option value="employee">Employee</option>
                            <option value="hr">HR</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-canvasBg/20 border border-secondaryElement/20 text-contrastText/50 capitalize">
                            {row.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {row.status === "active" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-successBadge/15 text-contrastText border border-successBadge/35">
                            Active
                          </span>
                        )}
                        {row.status === "inactive" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primaryAccent/10 text-primaryAccent border border-primaryAccent/30">
                            Deactivated
                          </span>
                        )}
                        {row.status === "pending" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-softHighlight/35 text-primaryAccent border border-softHighlight/45">
                            Pending Invite
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {row.userId ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/hr/employees/${row.userId}`)}
                                className="px-3 py-1.5 font-bold text-xs bg-softHighlight/20 hover:bg-softHighlight/35 border border-softHighlight/30 text-primaryAccent rounded-xl transition-all shadow-sm transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95"
                              >
                                View Dossier
                              </button>
                              <button
                                onClick={() => handleStatusToggle(row.userId!, row.status === "active")}
                                disabled={actionLoading}
                                className={`px-3 py-1.5 font-bold text-xs rounded-xl transition-all shadow-sm transition-all duration-200 ease-out active:scale-[0.97] hover:opacity-95 ${
                                  row.status === "active"
                                    ? "bg-primaryAccent/10 hover:bg-primaryAccent/15 border border-primaryAccent/30 text-primaryAccent"
                                    : "bg-successBadge/20 hover:bg-successBadge/30 border border-successBadge/35 text-contrastText"
                                }`}
                              >
                                {row.status === "active" ? "Deactivate" : "Reactivate"}
                              </button>
                            </div>
                          ) : (
                            row.whitelistId && (
                              <button
                                onClick={() => handleDeleteWhitelist(row.whitelistId!, row.email)}
                                disabled={actionLoading}
                                className="p-2 text-contrastText/40 hover:text-primaryAccent hover:bg-primaryAccent/10 rounded-xl transition-colors"
                                title="Revoke Whitelist invitation"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TeamsShell>
  );
}
