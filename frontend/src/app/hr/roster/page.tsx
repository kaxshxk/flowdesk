"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

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
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
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
      });

      setNewEmail("");
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
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Roster & Whitelist Manager</h1>
        <p className="text-sm text-slate-400 mt-1">
          Add allowed company emails to the whitelist, toggle user account lifecycles, and edit authorization roles.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Whitelist Addition Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit flex flex-col gap-4">
          <h3 className="text-md font-bold text-slate-100">🎟️ Whitelist New Employee</h3>
          <form onSubmit={handleAddWhitelist} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="emailInput">
                Company Email Address
              </label>
              <input
                id="emailInput"
                type="email"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none"
                placeholder="e.g. employee@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={actionLoading}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400" htmlFor="roleSelect">
                Assigned Role
              </label>
              <select
                id="roleSelect"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "employee" | "hr")}
                disabled={actionLoading}
              >
                <option value="employee">Employee</option>
                <option value="hr">HR Administrator</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Add to Whitelist"
              )}
            </button>
          </form>
        </div>

        {/* Combined Whitelist & Employee Data Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-md font-bold text-slate-100 mb-4">📋 Whitelisted & Registered Accounts</h3>
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-slate-800 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-slate-800 rounded animate-pulse"></div>
            </div>
          ) : getRosterRows().length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-3xl block mb-2">👥</span>
              <p className="text-sm">Roster is empty. Add users to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {getRosterRows().map((row) => (
                    <tr key={row.email} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">{row.email}</td>
                      <td className="py-3.5 px-4">
                        {row.userId ? (
                          <select
                            value={row.role}
                            onChange={(e) => handleRoleChange(row.userId!, e.target.value as "employee" | "hr")}
                            disabled={actionLoading}
                            className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2 py-1 text-slate-300 outline-none focus:border-indigo-500"
                          >
                            <option value="employee">Employee</option>
                            <option value="hr">HR</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-500 capitalize">
                            {row.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {row.status === "active" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                        {row.status === "inactive" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            Deactivated
                          </span>
                        )}
                        {row.status === "pending" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                                className="px-3 py-1.5 font-bold text-xs bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/35 text-indigo-400 rounded-xl transition-all shadow-sm"
                              >
                                View Dossier
                              </button>
                              <button
                                onClick={() => handleStatusToggle(row.userId!, row.status === "active")}
                                disabled={actionLoading}
                                className={`px-3 py-1.5 font-bold text-xs rounded-xl transition-all shadow-sm ${
                                  row.status === "active"
                                    ? "bg-red-950/40 hover:bg-red-900/40 border border-red-900/35 text-red-400"
                                    : "bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-900/35 text-emerald-400"
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
                                className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-xl transition-colors"
                                title="Revoke Whitelist invitation"
                              >
                                🗑️
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
