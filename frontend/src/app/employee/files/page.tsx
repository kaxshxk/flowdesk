"use client";

import React, { useState, useEffect, useRef } from "react";
import TeamsShell from "@/components/TeamsShell";
import { api } from "@/utils/api";

interface FileLog {
  id: number;
  file_name: string;
  google_drive_file_id: string;
  drive_folder_path: string;
  timestamp: string;
}

export default function EmployeeFileVault() {
  const [files, setFiles] = useState<FileLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ total: number; files: FileLog[] }>("/files");
      setFiles(res.files || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load Drive file catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFileObject = async (file: File) => {
    // 20MB Soft limit client-side boundary check
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("File exceeds the 20MB size threshold limit. Please select a smaller document.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("file", file);

      // Backend expects a multipart/form-data upload at /files/upload
      const res = await api.post<FileLog>("/files/upload", formData);

      setSuccess(`File "${file.name}" uploaded and synced to Google Drive successfully!`);
      setFiles((prev) => [res, ...prev]);
    } catch (err: any) {
      setError(err?.message || `Failed to upload and archive file "${file.name}".`);
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFileObject(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadFileObject(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <TeamsShell title="Drive Vault & File Drop">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-contrastText font-sans">Google Drive Vault</h1>
        <p className="text-sm text-contrastText/60 mt-1">Upload project materials. Files are dynamically sorted into date-partitioned Drive folders.</p>
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
        
        {/* Left Section / Dropzone */}
        <div className="flex flex-col gap-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all min-h-[300px] shadow-sm relative overflow-hidden ${
              dragActive
                ? "border-primaryAccent bg-primaryAccent/5 shadow-primaryAccent/5"
                : "border-secondaryElement/20 bg-canvasBg/30 hover:bg-canvasBg/45 hover:border-secondaryElement/45"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />

            {uploading ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primaryAccent"></div>
                <div className="text-xs text-contrastText/60 font-semibold animate-pulse">Syncing file metadata with Google Drive...</div>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-5xl block"></span>
                <div>
                  <h3 className="text-sm font-bold text-contrastText/90">Drag & drop files here</h3>
                  <p className="text-xs text-contrastText/40 mt-1">or click to browse local files (soft limit 20MB)</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section / Explorer View */}
        <div className="lg:col-span-2 bg-cardBacking shadow-ambient border border-secondaryElement/20 rounded-2xl p-6 shadow-md">
          <h3 className="text-md font-bold text-contrastText mb-4"> Synced Cloud Directory</h3>
          
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 bg-canvasBg/25 rounded w-1/4 animate-pulse"></div>
              <div className="h-24 bg-canvasBg/25 rounded animate-pulse"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-contrastText/40 space-y-2">
              <span className="text-3xl block"></span>
              <p className="text-sm">Drive Vault is currently empty for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-secondaryElement/20 text-contrastText/60 text-xs font-semibold uppercase bg-canvasBg/15">
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Upload Timestamp</th>
                    <th className="py-3 px-4">Drive Path</th>
                    <th className="py-3 px-4 text-right">Drive link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondaryElement/20 text-contrastText/80">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-canvasBg/20 transition-colors odd:bg-canvasBg/10">
                      <td className="py-4 px-4 font-semibold text-contrastText truncate max-w-[200px]">{file.file_name}</td>
                      <td className="py-4 px-4 text-xs text-contrastText/60">
                        {new Date(file.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-primaryAccent/10 text-primaryAccent border border-primaryAccent/20">
                          {file.drive_folder_path}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-canvasBg/35 border border-secondaryElement/20 text-contrastText/60 select-none"
                          title={`File ID: ${file.google_drive_file_id}`}
                        >
                           Drive Linked
                        </span>
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
