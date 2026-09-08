"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { PouchPublicInfo } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import {
  Lock,
  Unlock,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Film,
  Music,
  File,
  MessageSquare,
  FolderOpen,
} from "lucide-react";

interface UploadFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  errorMessage?: string;
}

export default function PublicPouchUploadPage() {
  const params = useParams();
  const slug = params?.slug as string;

  // Pouch state
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pouch, setPouch] = useState<PouchPublicInfo | null>(null);

  // Password Lock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Upload Form state
  const [senderName, setSenderName] = useState("");
  const [senderMessage, setSenderMessage] = useState("");
  const [nameError, setNameError] = useState(false);
  const [filesQueue, setFilesQueue] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch public pouch info
  useEffect(() => {
    if (!slug) return;

    async function loadPouch() {
      try {
        setLoading(true);
        setNotFound(false);

        const res = await fetch(`/api/pouch/manage?type=detail&slug=${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!res.ok || data.error || !data.pouch) {
          setNotFound(true);
          return;
        }

        const pouchData = data.pouch;
        const hasPassword = Boolean(pouchData.password_hash || pouchData.has_password);
        const pouchInfo: PouchPublicInfo = {
          id: pouchData.id,
          slug: pouchData.slug,
          name: pouchData.name,
          message: pouchData.message,
          has_password: hasPassword,
          created_at: pouchData.created_at,
        };

        setPouch(pouchInfo);
        document.title = `Upload to ${pouchInfo.name} — Inbox`;

        // If no password is required, auto-unlock
        if (!hasPassword) {
          setIsUnlocked(true);
        }
      } catch (err) {
        console.error("Error loading pouch:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadPouch();
  }, [slug]);

  // Handle password submission
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordInput) {
      setPasswordError("Please enter the password.");
      return;
    }

    setVerifyingPassword(true);

    try {
      const res = await fetch("/api/pouch/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          password: passwordInput,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setPasswordError(result.error || "Incorrect password. Please try again.");
      } else {
        setIsUnlocked(true);
      }
    } catch {
      setPasswordError("Verification failed. Please try again.");
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
    // reset input value so selecting the same file again triggers onChange
    if (e.target) {
      e.target.value = "";
    }
  };

  const addFilesToQueue = (newFiles: File[]) => {
    const items: UploadFileItem[] = newFiles.map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "pending",
    }));

    setFilesQueue((prev) => [...prev, ...items]);
  };

  const removeFileFromQueue = (id: string) => {
    setFilesQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Upload individual file with real-time progress and retry capability
  const uploadSingleFile = async (
    item: UploadFileItem,
    pouchId: string,
    currentSender: string,
    currentMessage: string
  ): Promise<boolean> => {
    setFilesQueue((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status: "uploading", progress: 5, errorMessage: undefined } : f))
    );

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("pouch_id", pouchId);
      formData.append("sender_name", currentSender);
      if (currentMessage.trim()) {
        formData.append("sender_message", currentMessage.trim());
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/pouch/upload");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(95, Math.round((event.loaded / event.total) * 100));
            setFilesQueue((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: percent } : f))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || `Upload failed (Status ${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network connection dropped during upload. Please retry."));
        };

        xhr.send(formData);
      });

      // Mark completed
      setFilesQueue((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "completed", progress: 100 } : f))
      );

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed. Click to retry.";
      console.error(`Upload error for ${item.name}:`, err);
      setFilesQueue((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, status: "error", progress: 0, errorMessage: msg }
            : f
        )
      );
      return false;
    }
  };

  // Start uploading queued files
  const handleStartUpload = async () => {
    if (!senderName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);

    if (!pouch) return;

    const pendingFiles = filesQueue.filter((f) => f.status === "pending" || f.status === "error");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    let completedCount = 0;
    for (const item of pendingFiles) {
      const success = await uploadSingleFile(item, pouch.id, senderName.trim(), senderMessage.trim());
      if (success) {
        completedCount++;
      }
    }

    // Trigger email notification for admin
    if (completedCount > 0) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pouch_id: pouch.id,
          sender_name: senderName.trim(),
          sender_message: senderMessage.trim() || undefined,
          file_names: pendingFiles.map((f) => f.name),
        }),
      }).catch((e) => console.warn("Notification trigger notice:", e));
    }

    setIsUploading(false);

    // Check if everything in the queue is completed
    setTimeout(() => {
      setFilesQueue((currentQueue) => {
        const remaining = currentQueue.filter((f) => f.status !== "completed");
        if (remaining.length === 0 && currentQueue.length > 0) {
          setAllCompleted(true);
        }
        return currentQueue;
      });
    }, 400);
  };

  // Retry a single file
  const handleRetryFile = async (item: UploadFileItem) => {
    if (!pouch) return;
    if (!senderName.trim()) {
      setNameError(true);
      return;
    }
    await uploadSingleFile(item, pouch.id, senderName.trim(), senderMessage.trim());

    setFilesQueue((currentQueue) => {
      const remaining = currentQueue.filter((f) => f.status !== "completed");
      if (remaining.length === 0 && currentQueue.length > 0) {
        setAllCompleted(true);
      }
      return currentQueue;
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "svg", "webp", "avif"].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) {
      return <Film className="w-5 h-5 text-purple-500" />;
    }
    if (["mp3", "wav", "ogg", "flac"].includes(ext)) {
      return <Music className="w-5 h-5 text-pink-500" />;
    }
    if (["pdf", "doc", "docx", "txt", "rtf", "md"].includes(ext)) {
      return <FileText className="w-5 h-5 text-orange-accent" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  // 1. Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-accent mb-3" />
        <p className="text-sm font-medium text-gray-600">Loading pouch...</p>
      </div>
    );
  }

  // 2. Clean 404 state for invalid/missing slug
  if (notFound || !pouch) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-center items-center px-4 py-12">
        <div className="bg-white border border-card-border rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-cream border border-card-border flex items-center justify-center mx-auto mb-4 text-gray-400">
            <span className="text-2xl" role="img" aria-label="Inbox">📦</span>
          </div>
          <h2 className="text-xl font-bold text-navy">Pouch Not Found</h2>
          <p className="text-sm text-gray-600 mt-2">
            This file request link is invalid or may have been removed by the recipient.
          </p>
          <div className="mt-8 pt-4 border-t border-card-border text-xs text-gray-400">
            Inbox — Dead-simple file requests
          </div>
        </div>
      </div>
    );
  }

  // 3. Password Lock Screen
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-center items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-card-border shadow-sm mb-3">
              <span className="text-2xl" role="img" aria-label="Inbox">📦</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-navy">Inbox</h1>
          </div>

          <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>

            <h2 className="text-lg font-bold text-navy">
              This pouch is password-protected
            </h2>
            <p className="text-xs text-gray-600 mt-1 mb-6">
              Enter the password to access <strong className="text-navy">{pouch.name}</strong>
            </p>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter pouch password"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingPassword}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-navy hover:bg-navy-hover text-white text-sm font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60 shadow-sm"
              >
                {verifyingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Unlock</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Inbox — Dead-simple file requests
          </p>
        </div>
      </div>
    );
  }

  // 4. Completion State
  if (allCompleted) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-center items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-card-border shadow-sm mb-3">
              <span className="text-2xl" role="img" aria-label="Inbox">📦</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-navy">Inbox</h1>
          </div>

          <div className="bg-white border border-card-border rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 text-green-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-xl font-bold text-navy mb-2">All done!</h2>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              Your files have been uploaded to <strong className="text-navy">{pouch.name}</strong>.
            </p>

            <p className="text-xs text-gray-500 bg-[#faf8f5] border border-card-border rounded-xl p-3.5 mb-6">
              When you&apos;re done uploading, just close this window.
            </p>

            <button
              onClick={() => {
                setFilesQueue([]);
                setAllCompleted(false);
              }}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-accent hover:text-orange-hover py-2 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload more files</span>
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Inbox — Dead-simple file requests
          </p>
        </div>
      </div>
    );
  }

  // 5. Upload Form (Unlocked or No Password)
  const pendingOrErrorCount = filesQueue.filter((f) => f.status === "pending" || f.status === "error").length;

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Brand Header */}
      <header className="bg-white border-b border-card-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="Inbox">📦</span>
            <span className="text-lg font-bold text-navy tracking-tight">Inbox</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-800 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
            <span>🔒 Encrypted &amp; Secure</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header & Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">
              Upload files for {pouch.name}
            </h1>

            {pouch.message && (
              <p className="mt-2.5 text-xs sm:text-sm text-gray-600 bg-[#faf8f5] border border-card-border rounded-xl p-3.5">
                {pouch.message}
              </p>
            )}
          </div>

          {/* Form Inputs: Your Name + Optional Client Message + Click/Drag-and-Drop Zone */}
          <div className="space-y-5">
            {/* Input 1: Your Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Your Name <span className="text-orange-accent">*</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => {
                  setSenderName(e.target.value);
                  if (nameError) setNameError(false);
                }}
                placeholder="e.g. Alex Morgan"
                required
                className={`w-full px-3.5 py-2.5 bg-[#faf8f5] border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors ${
                  nameError ? "border-red-400 ring-1 ring-red-300" : "border-card-border"
                }`}
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Please enter your name before uploading.
                </p>
              )}
            </div>

            {/* Input 2: Client Message (Optional) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                <span>Message / Note</span>
                <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={senderMessage}
                onChange={(e) => setSenderMessage(e.target.value)}
                placeholder="Leave an optional note or details about these files..."
                className="w-full px-3.5 py-2 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors resize-none"
              />
            </div>

            {/* Input 3: Click to Browse & Drag-and-Drop Zone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                Files to Upload
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                multiple
                className="hidden"
                id="inbox-file-input"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-150 select-none ${
                  isDragging
                    ? "border-orange-accent bg-orange-light/40 scale-[0.99]"
                    : "border-[#d8d3cb] hover:border-orange-accent/70 bg-[#faf8f5] hover:bg-[#f6f2ec]"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-card-border flex items-center justify-center mx-auto mb-3 text-orange-accent shadow-2xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-navy">
                  Drag files here or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  Any file type supported • Add as many files as you need
                </p>

                {/* Prominent Click Button for mobile & easy tap */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-card-border hover:border-orange-accent text-navy text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-orange-accent" />
                  <span>Choose Files</span>
                </button>
              </div>
            </div>
          </div>

          {/* Files Queue & Progress */}
          {filesQueue.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700 pb-1">
                <span>Selected Files ({filesQueue.length})</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-orange-accent hover:text-orange-hover transition-colors text-xs font-semibold"
                >
                  + Add more
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {filesQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#faf8f5] border border-card-border rounded-xl flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex-shrink-0">{getFileIcon(item.name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-navy truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {formatBytes(item.size)}
                          </p>
                        </div>
                      </div>

                      {/* Status / Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            Uploaded
                          </span>
                        )}

                        {item.status === "uploading" && (
                          <span className="text-xs font-semibold text-orange-accent flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {item.progress}%
                          </span>
                        )}

                        {item.status === "error" && (
                          <button
                            onClick={() => handleRetryFile(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            title="Retry upload"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}

                        {item.status === "pending" && !isUploading && (
                          <button
                            onClick={() => removeFileFromQueue(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-file Progress Bar */}
                    {item.status === "uploading" && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-orange-accent h-1.5 rounded-full transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.status === "error" && item.errorMessage && (
                      <p className="text-[11px] text-red-600">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Upload Button */}
              {pendingOrErrorCount > 0 && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleStartUpload}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-hover text-white text-sm font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading Files...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>
                          Upload {pendingOrErrorCount} {pendingOrErrorCount === 1 ? "File" : "Files"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500">
          Inbox — Dead-simple file requests
        </p>
      </main>
    </div>
  );
}
