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

export default function FileVault() {
  const [files, setFiles] = useState<FileLog[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ total: number; files: FileLog[] }>("/files");
      setFiles(res.files);
    } catch (err: any) {
      setError(err?.message || "Failed to load files list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setBtnLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post("/files/upload", formData);

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      setSuccess("File uploaded successfully and synced to Google Drive!");
      await fetchFiles();
    } catch (err: any) {
      setError(err?.message || "Failed to upload file.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <TeamsShell title="Drive File Vault">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Google Drive File Manager</h1>
        <p className="text-sm text-slate-400 mt-1">Upload project assets, reports, or contracts. Files are dynamically sorted into date-partitioned folders on Google Drive.</p>
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
        {/* Upload card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
          <h3 className="text-md font-bold text-slate-100 mb-4">📤 Upload New Document</h3>
          <form onSubmit={handleUpload}>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-semibold text-slate-400" htmlFor="fileInput">Select File</label>
              <input
                id="fileInput"
                type="file"
                ref={fileInputRef}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 transition-all outline-none"
                onChange={handleFileChange}
                disabled={btnLoading}
                required
              />
            </div>
            
            {selectedFile && (
              <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <div className="text-xs font-semibold truncate text-indigo-300">{selectedFile.name}</div>
                <div className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/25 transition-all text-white font-semibold text-sm rounded-xl disabled:opacity-50"
              disabled={btnLoading || !selectedFile}
            >
              {btnLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Upload File"
              )}
            </button>
          </form>
        </div>

        {/* Files index list */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-md font-bold text-slate-100 mb-4">📁 Synced Drive Files</h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-sm">No uploaded assets found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Uploaded At</th>
                    <th className="py-3 px-4">Drive Path Partition</th>
                    <th className="py-3 px-4">Google Drive ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">{file.file_name}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{new Date(file.timestamp).toLocaleString()}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {file.drive_folder_path}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500" title={file.google_drive_file_id}>
                        {file.google_drive_file_id.substring(0, 12)}...
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
