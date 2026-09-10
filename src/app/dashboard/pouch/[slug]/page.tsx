"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Pouch, PouchFile } from "@/lib/types";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  Lock,
  Trash2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Film,
  Music,
  File,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  Clock,
  HardDrive,
  Wifi,
  Laptop,
  Globe,
  MessageSquare,
} from "lucide-react";

export default function PouchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(true);
  const [pouch, setPouch] = useState<Pouch | null>(null);
  const [files, setFiles] = useState<PouchFile[]>([]);
  const [copiedLinkType, setCopiedLinkType] = useState<"primary" | "lan" | "local" | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Network info for sharing on other devices
  const [networkInfo, setNetworkInfo] = useState<{
    lanIp: string | null;
    lanUrl: string | null;
    configuredAppUrl: string | null;
    publicUrl?: string | null;
  } | null>(null);
  const [customUrl, setCustomUrl] = useState<string>("");
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [shareMode, setShareMode] = useState<"wifi" | "local" | "custom">("wifi");

  // Password section state
  const [hasPassword, setHasPassword] = useState(false);
  const [requirePasswordChecked, setRequirePasswordChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Global messages
  const [error, setError] = useState<string | null>(null);

  const fetchPouchData = useCallback(async () => {
    if (!slug) return;
    try {
      setError(null);

      const res = await fetch(`/api/pouch/manage?type=detail&slug=${encodeURIComponent(slug)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Pouch not found.");
      }

      if (!data.pouch) {
        setError("Pouch not found.");
        setLoading(false);
        return;
      }

      setPouch(data.pouch);
      const isProtected = Boolean(data.pouch.password_hash || data.pouch.has_password);
      setHasPassword(isProtected);
      setRequirePasswordChecked(isProtected);
      setFiles(data.files || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load pouch.";
      console.error("Error fetching pouch details:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    document.title = pouch ? `${pouch.name} — Inbox` : "Inbox";

    // Load saved custom / tunnel URL
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inbox_custom_url");
      if (saved) {
        setCustomUrl(saved);
        setShareMode("custom");
      }
    }

    // Fetch network info for multi-device sharing
    fetch("/api/network-info")
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch(() => {});

    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.push("/login");
        } else {
          fetchPouchData();
        }
      });
    } else {
      fetchPouchData();
    }
  }, [slug, fetchPouchData, router, pouch]);

  // Determine share URLs
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const isProductionDomain = Boolean(origin && !origin.includes("localhost") && !origin.includes("127.0.0.1"));
  const productionBase = networkInfo?.publicUrl || (isProductionDomain ? origin : null);

  const localUrl = `${origin}/p/${slug}`;
  const wifiUrl = networkInfo?.lanUrl ? `${networkInfo.lanUrl}/p/${slug}` : localUrl;
  const customShareUrl = customUrl ? `${customUrl.replace(/\/$/, "")}/p/${slug}` : localUrl;
  const prodShareUrl = productionBase ? `${productionBase}/p/${slug}` : localUrl;

  const currentShareUrl =
    productionBase
      ? prodShareUrl
      : shareMode === "custom" && customUrl
      ? customShareUrl
      : shareMode === "wifi" && networkInfo?.lanUrl
      ? wifiUrl
      : localUrl;

  const handleSaveCustomUrl = (val: string) => {
    setCustomUrl(val);
    if (typeof window !== "undefined") {
      if (val.trim()) {
        localStorage.setItem("inbox_custom_url", val.trim());
        setShareMode("custom");
      } else {
        localStorage.removeItem("inbox_custom_url");
        setShareMode("wifi");
      }
    }
    setShowCustomUrlInput(false);
  };

  const handleCopyLink = (urlToCopy: string, type: "primary" | "lan" | "local") => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pouch) return;
    setPasswordStatusMsg(null);

    if (requirePasswordChecked && !hasPassword && !passwordInput.trim()) {
      setPasswordStatusMsg({
        type: "error",
        text: "Please enter a password.",
      });
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/pouch/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_password",
          id: pouch.id,
          isPasswordProtected: requirePasswordChecked,
          password: passwordInput.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to update password settings.");
      }

      setHasPassword(requirePasswordChecked && (Boolean(passwordInput.trim()) || hasPassword));
      setPasswordInput("");
      setPasswordStatusMsg({
        type: "success",
        text: requirePasswordChecked
          ? "Password protection enabled and saved."
          : "Password protection removed.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordStatusMsg({
        type: "error",
        text: msg,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDownload = async (file: PouchFile) => {
    try {
      setDownloadingId(file.id);

      const downloadUrl = `/api/pouch/download?fileId=${file.id}&path=${encodeURIComponent(
        file.storage_path
      )}&name=${encodeURIComponent(file.file_name)}`;

      const res = await fetch(downloadUrl);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed (status ${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not retrieve file.";
      alert(`Download failed: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeletePouch = async () => {
    if (!pouch) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/pouch/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: pouch.id,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to delete pouch.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting pouch.";
      alert(`Failed to delete pouch: ${msg}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-accent mb-3" />
        <p className="text-sm text-gray-500">Loading pouch details...</p>
      </div>
    );
  }

  if (error || !pouch) {
    return (
      <div className="min-h-screen bg-cream px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="bg-white border border-card-border rounded-2xl p-8 max-w-md w-full shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-navy">Pouch Not Found</h2>
          <p className="text-sm text-gray-500 mt-2 mb-6">
            The pouch you are looking for does not exist or has been deleted.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-navy hover:bg-navy-hover text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Top Bar */}
      <header className="bg-white border-b border-card-border sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-navy transition-colors py-1 px-2 rounded-lg hover:bg-cream"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Pouches</span>
            </Link>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-lg" role="img" aria-label="Inbox">📦</span>
              <span className="text-sm font-bold text-navy truncate max-w-[180px] sm:max-w-xs">
                {pouch.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/p/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy hover:text-orange-accent border border-card-border rounded-lg bg-white hover:bg-[#faf8f5] transition-colors"
            >
              <span>Preview Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Pouch Header Card */}
        <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-navy tracking-tight">
                  {pouch.name}
                </h1>
                {hasPassword && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                    <Lock className="w-3 h-3" />
                    Password Protected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Created {formatDate(pouch.created_at)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                  {files.length} {files.length === 1 ? "file" : "files"} (
                  {formatBytes(files.reduce((acc, f) => acc + Number(f.file_size || 0), 0))})
                </span>
              </div>

              {pouch.message && (
                <p className="mt-3 text-sm text-gray-600 bg-[#faf8f5] border border-card-border rounded-xl p-3.5">
                  &ldquo;{pouch.message}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Share Link Box with Multi-Device / Wi-Fi Support */}
          <div className="mt-6 pt-6 border-t border-card-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Public Share Link
              </label>

              {/* Toggle Wi-Fi vs Localhost vs Custom */}
              <div className="flex items-center gap-1 bg-[#f0ede6] p-0.5 rounded-lg text-xs font-medium self-start sm:self-auto flex-wrap">
                {networkInfo?.lanUrl && (
                  <button
                    type="button"
                    onClick={() => setShareMode("wifi")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      shareMode === "wifi" ? "bg-white text-navy font-bold shadow-2xs" : "text-gray-600 hover:text-navy"
                    }`}
                  >
                    <Wifi className="w-3 h-3 text-orange-accent" />
                    <span>Wi-Fi / Phone</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShareMode("local")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    shareMode === "local" ? "bg-white text-navy font-bold shadow-2xs" : "text-gray-600 hover:text-navy"
                  }`}
                >
                  <Laptop className="w-3 h-3" />
                  <span>Localhost</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareMode("custom");
                    setShowCustomUrlInput(!showCustomUrlInput);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    shareMode === "custom" ? "bg-white text-navy font-bold shadow-2xs" : "text-gray-600 hover:text-navy"
                  }`}
                >
                  <Globe className="w-3 h-3 text-blue-600" />
                  <span>{customUrl ? "Custom URL" : "+ Public/Tunnel"}</span>
                </button>
              </div>
            </div>

            {/* Custom URL Input if opened */}
            {showCustomUrlInput && (
              <div className="mb-3 p-3 bg-[#faf8f5] border border-card-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy">Enter Public / Tunnel URL (e.g. from ngrok, localtunnel, or domain)</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomUrlInput(false)}
                    className="text-xs text-gray-400 hover:text-navy"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    defaultValue={customUrl}
                    placeholder="https://your-tunnel.loca.lt or https://yourdomain.com"
                    id="custom-url-input"
                    className="flex-1 px-3 py-1.5 bg-white border border-card-border rounded-lg text-xs font-mono text-navy focus:outline-none focus:ring-1 focus:ring-orange-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById("custom-url-input") as HTMLInputElement;
                      if (input) handleSaveCustomUrl(input.value);
                    }}
                    className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-hover transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 px-3.5 py-2.5 bg-[#faf8f5] border border-card-border rounded-xl text-navy font-mono text-xs sm:text-sm truncate select-all">
                {currentShareUrl}
              </div>
              <button
                onClick={() => handleCopyLink(currentShareUrl, "primary")}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy hover:bg-navy-hover text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors shadow-2xs flex-shrink-0"
              >
                {copiedLinkType === "primary" ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span>Copied Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Helper explanation for opening on other devices */}
            {shareMode === "wifi" && networkInfo?.lanIp && (
              <div className="mt-3 p-3 bg-[#faf8f5] border border-card-border rounded-xl text-xs text-gray-600 flex items-start gap-2">
                <Wifi className="w-4 h-4 text-orange-accent flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-navy">To open on your phone or other device:</span> Make sure your device is connected to the same Wi-Fi and open{" "}
                  <code className="bg-white px-1.5 py-0.5 rounded border border-card-border font-mono text-[11px] select-all text-orange-accent font-bold">
                    {wifiUrl}
                  </code>
                </div>
              </div>
            )}

            {shareMode === "local" && (
              <div className="mt-3 p-3 bg-[#faf8f5] border border-card-border rounded-xl text-xs text-gray-500 flex items-start gap-2">
                <Laptop className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Localhost is for this computer only. To open on a phone or other device, switch to the <strong className="text-navy">Wi-Fi / Phone</strong> tab above.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Files List Section */}
        <div className="bg-white border border-card-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-card-border">
            <h2 className="text-lg font-bold text-navy">Uploaded Files</h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-[#faf8f5] border border-card-border rounded-full text-gray-600">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>

          {files.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-cream border border-card-border flex items-center justify-center mx-auto mb-3 text-gray-400">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-navy">No files yet</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No files yet — share your pouch link and files will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-card-border">
              {files.map((file) => {
                const isDownloading = downloadingId === file.id;
                return (
                  <div
                    key={file.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#faf8f5] border border-card-border flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getFileIcon(file.file_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy truncate" title={file.file_name}>
                          {file.file_name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="font-semibold text-navy">
                            {formatBytes(Number(file.file_size || 0))}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <User className="w-3 h-3 text-gray-400" />
                            <strong className="text-navy">{file.sender_name}</strong>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {formatDateTime(file.uploaded_at)}
                          </span>
                        </div>

                        {/* Client Message (if provided) */}
                        {file.sender_message && (
                          <div className="mt-2.5 p-2.5 bg-[#faf8f5] border border-card-border rounded-xl text-xs text-gray-700 flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-orange-accent flex-shrink-0 mt-0.5" />
                            <div className="italic">
                              &ldquo;{file.sender_message}&rdquo;
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="self-start sm:self-center flex-shrink-0 pl-13 sm:pl-0">
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#faf8f5] hover:bg-white border border-card-border text-navy hover:text-orange-accent transition-colors shadow-2xs disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings & Password Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Password Protection Card */}
          <div className="bg-white border border-card-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
              <Lock className="w-4 h-4 text-orange-accent" />
              <h3 className="text-base font-bold text-navy">Password Protection</h3>
            </div>

            {passwordStatusMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordStatusMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {passwordStatusMsg.type === "success" ? (
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span>{passwordStatusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requirePasswordChecked}
                  onChange={(e) => setRequirePasswordChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-accent focus:ring-orange-accent border-gray-300 accent-orange-accent"
                />
                <span className="text-sm font-medium text-navy">
                  Require password to access this pouch
                </span>
              </label>

              {requirePasswordChecked && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    {hasPassword ? "Change Password" : "Set Password"}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={hasPassword ? "Leave blank to keep existing" : "Enter new password"}
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    {hasPassword
                      ? "Enter a new password above to change it, or uncheck the box to remove protection."
                      : "Choose a password for public visitors."}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-navy hover:bg-navy-hover text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs disabled:opacity-60"
              >
                {savingPassword ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Password Settings</span>
                )}
              </button>
            </form>
          </div>

          {/* Delete Danger Zone */}
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-100">
                <Trash2 className="w-4 h-4 text-red-500" />
                <h3 className="text-base font-bold text-red-900">Danger Zone</h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Permanently delete this pouch, its public URL, and all associated files stored in Supabase Storage. This action cannot be undone.
              </p>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 text-xs font-semibold rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Pouch</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-card-border rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-navy">Delete &ldquo;{pouch.name}&rdquo;?</h3>
            <p className="text-xs text-gray-600 mt-2">
              Are you sure you want to delete this pouch? All {files.length} uploaded files and the public upload link will be permanently deleted.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-[#faf8f5] rounded-xl border border-card-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePouch}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-2xs disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
