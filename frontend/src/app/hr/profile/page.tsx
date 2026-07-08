"use client";

import React, { useState, useEffect, useRef } from "react";
import TeamsShell from "@/components/TeamsShell";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/utils/api";

interface UserProfile {
  id: number;
  company_email: string;
  role: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_number: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<UserProfile>("/me");
      setProfile(data);
      setFullName(data.full_name || "");
      setJobTitle(data.job_title || "");
      setDepartment(data.department || "");
      setPhoneNumber(data.phone_number || "");
      setBio(data.bio || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.put<UserProfile>("/me", {
        full_name: fullName.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        phone_number: phoneNumber.trim() || null,
        bio: bio.trim() || null,
      });
      setProfile(updated);
      setSuccess("Profile updated successfully!");
      // Reload page after a short delay so that sidebar updates too
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Failed to save profile changes.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // Limit to 5MB for avatar
    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar image size must be under 5MB.");
      return;
    }

    setPhotoLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post<UserProfile>("/me/avatar", formData);
      setProfile(res);
      setSuccess("Profile picture uploaded successfully!");
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Failed to upload profile picture.");
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) return;
    setPhotoLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.delete<UserProfile>("/me/avatar");
      setProfile(res);
      setSuccess("Profile picture removed successfully!");
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Failed to remove profile picture.");
    } finally {
      setPhotoLoading(false);
    }
  };

  if (!user) return null;

  const emailUsername = user.email.split("@")[0];
  const initial = user.email.charAt(0).toUpperCase();

  return (
    <TeamsShell title="My Profile">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Banners & Alerts */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold animate-scale-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-semibold animate-scale-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primaryAccent"></div>
            <span className="text-[12px] font-semibold">Retrieving profile details...</span>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            
            {/* Header Banner Background */}
            <div className="h-[120px] bg-gradient-to-r from-primaryAccent via-indigo-600 to-indigo-800 relative" />

            {/* Profile Avatar Card */}
            <div className="px-6 pb-6 relative flex flex-col md:flex-row items-center justify-between gap-5 border-b border-gray-100 bg-gray-50/40">
              <div className="flex flex-col md:flex-row items-center gap-5 -mt-12 text-center md:text-left w-full md:w-auto">
                <div className="relative shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={`${profile.avatar_url}?t=${new Date().getTime()}`}
                      alt="Profile Avatar"
                      className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-md bg-white animate-scale-in"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-gradient-to-br from-primaryAccent to-indigo-400 text-white font-bold text-3xl flex items-center justify-center shadow-md select-none">
                      {initial}
                    </div>
                  )}
                  
                  {photoLoading && (
                    <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center text-white">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 md:pt-10">
                  <h2 className="text-[17px] font-bold text-gray-800 truncate">
                    {profile?.full_name || emailUsername}
                  </h2>
                  <p className="text-[11px] font-mono text-gray-400 truncate mt-0.5">
                    {profile?.company_email}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 justify-center md:justify-start mt-2">
                    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] text-gray-500 font-bold capitalize shadow-sm">
                      {profile?.role} account
                    </span>
                    {profile?.department && (
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[10px] text-primaryAccent font-bold shadow-sm">
                        {profile.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Actions */}
              <div className="flex items-center gap-2 shrink-0 md:pt-10">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  disabled={photoLoading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoLoading}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-primaryAccent font-bold text-[11px] rounded-xl transition-all shadow-sm"
                >
                  Upload Photo
                </button>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={photoLoading}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] rounded-xl transition-all shadow-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Profile fields form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="full_name" className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[12px] placeholder-gray-400 font-medium text-gray-700 focus:bg-white focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/10 outline-none transition-all"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={50}
                  />
                </div>

                {/* Job Title */}
                <div className="space-y-1.5">
                  <label htmlFor="job_title" className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Job Title
                  </label>
                  <input
                    type="text"
                    id="job_title"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[12px] placeholder-gray-400 font-medium text-gray-700 focus:bg-white focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/10 outline-none transition-all"
                    placeholder="e.g. Senior Software Engineer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    maxLength={60}
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label htmlFor="department" className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Department
                  </label>
                  <input
                    type="text"
                    id="department"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[12px] placeholder-gray-400 font-medium text-gray-700 focus:bg-white focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/10 outline-none transition-all"
                    placeholder="e.g. Engineering, Sales, HR"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    maxLength={50}
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label htmlFor="phone_number" className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    id="phone_number"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-[12px] placeholder-gray-400 font-medium text-gray-700 focus:bg-white focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/10 outline-none transition-all"
                    placeholder="e.g. +1 (555) 019-2834"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={20}
                  />
                </div>

              </div>

              {/* Bio Description (Add something on your own) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="bio" className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                    Professional Biography
                  </label>
                  <span className="text-[9px] text-gray-450 font-semibold">{bio.length}/500 chars</span>
                </div>
                <textarea
                  id="bio"
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[12px] placeholder-gray-400 font-medium text-gray-700 focus:bg-white focus:border-primaryAccent focus:ring-2 focus:ring-primaryAccent/10 outline-none transition-all resize-none"
                  placeholder="Share a professional statement or summarize your role, experience, and projects..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                />
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={fetchProfile}
                  disabled={saveLoading}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-[12px] font-semibold text-gray-500 rounded-xl transition-all"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2 bg-primaryAccent hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-[12px] rounded-xl transition-all shadow-sm shadow-indigo-200/50 flex items-center gap-1.5"
                >
                  {saveLoading && (
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  )}
                  Save Changes
                </button>
              </div>

            </form>

          </div>
        )}

      </div>
    </TeamsShell>
  );
}
