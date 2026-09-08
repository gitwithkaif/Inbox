"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Pouch } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";
import {
  Package,
  Plus,
  Copy,
  Check,
  Eye,
  Lock,
  HardDrive,
  LogOut,
  AlertCircle,
  Loader2,
  FolderArchive,
  RefreshCw,
  Info,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pouches, setPouches] = useState<Pouch[]>([]);
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [slug, setSlug] = useState("");
  const [addPassword, setAddPassword] = useState(false);
  const [password, setPassword] = useState("");

  const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/pouch/manage?type=list");
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to load pouches.");
      }

      setPouches(data.pouches || []);
      setTotalStorageBytes(data.totalStorageBytes || 0);
      setIsSupabaseConnected(Boolean(data.isSupabaseConnected));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load pouches.";
      console.error("Failed to load dashboard data:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Inbox";

    // Auth verification if Supabase is configured
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.push("/login");
        } else {
          fetchDashboardData();
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.push("/login");
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Local mode
      fetchDashboardData();
    }
  }, [router, fetchDashboardData]);

  const handleCreatePouch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError("Pouch name is required.");
      return;
    }

    if (addPassword && !password.trim()) {
      setError("Please enter a password or uncheck password protection.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/pouch/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          message: message.trim() || null,
          slug: slug.trim() || undefined,
          isPasswordProtected: addPassword,
          password: password.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to create pouch.");
      }

      // Reset form
      setName("");
      setMessage("");
      setSlug("");
      setAddPassword(false);
      setPassword("");
      setSuccessMsg(`Pouch "${result.pouch.name}" created successfully!`);

      // Refresh list
      await fetchDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create pouch.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const [lanUrl, setLanUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/network-info")
      .then((res) => res.json())
      .then((data) => {
        if (data?.lanUrl) setLanUrl(data.lanUrl);
      })
      .catch(() => {});
  }, []);

  const handleCopyLink = (pouchSlug: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const base = lanUrl || origin;
    const publicUrl = `${base}/p/${pouchSlug}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedSlug(pouchSlug);
    setTimeout(() => {
      setCopiedSlug(null);
    }, 2000);
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  };

  const storagePercentage = Math.min(
    100,
    Math.round((totalStorageBytes / STORAGE_LIMIT_BYTES) * 100)
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-card-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="Inbox">📦</span>
            <h1 className="text-xl font-bold text-navy tracking-tight">Inbox</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-navy hover:bg-cream rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Supabase Connection Helper Banner if running in Local Mode */}
        {!isSupabaseConnected && (
          <div className="mb-6 p-4 rounded-xl bg-[#fef7ee] border border-[#f5dfc6] text-[#844d18] text-xs sm:text-sm flex items-start gap-3 shadow-2xs">
            <Info className="w-5 h-5 text-orange-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-[#5c320d]">Local Storage Mode Active</p>
              <p className="mt-0.5 leading-relaxed text-[#734316]">
                You can create pouches and test uploads right now! To persist data in cloud Postgres and Storage, configure your real{" "}
                <code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
                <code className="bg-[#faecd9] px-1 py-0.5 rounded font-mono text-xs">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* Error / Success Notifications */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-green-600 hover:text-green-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Responsive Grid: New Pouch Form & Pouches List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: New Pouch Form (5 cols on desktop) */}
          <div className="lg:col-span-5 order-2 lg:order-1 space-y-6">
            <div className="bg-white border border-card-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-card-border">
                <div className="w-8 h-8 rounded-lg bg-orange-light flex items-center justify-center text-orange-accent">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-navy">New Pouch</h2>
                  <p className="text-xs text-gray-500">Create a destination for incoming files</p>
                </div>
              </div>

              <form onSubmit={handleCreatePouch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Pouch Name <span className="text-orange-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tax Documents 2026"
                    required
                    className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Custom URL Slug <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2.5 bg-[#f0ede6] border border-r-0 border-card-border rounded-l-xl text-xs text-gray-500 select-none">
                      /p/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="auto-generated if blank"
                      className="w-full px-3.5 py-2.5 bg-[#faf8f5] border border-card-border rounded-r-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Leave blank to automatically generate a random URL-safe slug.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Message <span className="text-gray-400 font-normal lowercase">(optional instructions)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Please upload your scanned receipts and forms here."
                    className="w-full px-3.5 py-2 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors resize-none"
                  />
                </div>

                {/* Password Protection Toggle */}
                <div className="pt-2 border-t border-card-border">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={addPassword}
                      onChange={(e) => setAddPassword(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-accent focus:ring-orange-accent border-gray-300 accent-orange-accent"
                    />
                    <span className="text-sm font-medium text-navy flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-gray-500" />
                      Add password protection
                    </span>
                  </label>

                  {addPassword && (
                    <div className="mt-3 pl-6 animate-fadeIn">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                        Pouch Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required={addPassword}
                        className="w-full px-3.5 py-2 bg-[#faf8f5] border border-card-border rounded-xl text-navy text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-accent/30 focus:border-orange-accent transition-colors"
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        Visitors will need this password before uploading.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-navy hover:bg-navy-hover text-white text-sm font-semibold py-3 px-4 rounded-xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Pouch...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Pouch</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Storage + Your Pouches List (7 cols on desktop) */}
          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
            {/* Storage Usage Widget */}
            <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-orange-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Storage Used
                  </span>
                </div>
                <span className="text-xs font-semibold text-navy">
                  {formatBytes(totalStorageBytes)} / 1 GB
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#f0ece5] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-orange-accent h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(storagePercentage, 2)}%` }}
                />
              </div>
            </div>

            {/* Your Pouches Section */}
            <div className="bg-white border border-card-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-card-border">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-navy" />
                  <h2 className="text-lg font-bold text-navy">Your Pouches</h2>
                  <span className="ml-1.5 px-2 py-0.5 text-xs font-semibold bg-[#faf8f5] border border-card-border rounded-full text-gray-600">
                    {pouches.length}
                  </span>
                </div>
                <button
                  onClick={fetchDashboardData}
                  disabled={loading}
                  className="p-1.5 text-gray-400 hover:text-navy rounded-lg hover:bg-cream transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Pouches List State */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-accent" />
                  <p className="text-xs">Loading pouches...</p>
                </div>
              ) : pouches.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cream border border-card-border flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-navy">No pouches yet</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Create your first pouch using the form on the left to start collecting files.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {pouches.map((pouch) => {
                    const isCopied = copiedSlug === pouch.slug;
                    return (
                      <div
                        key={pouch.id}
                        className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/dashboard/pouch/${pouch.slug}`}
                              className="text-base font-bold text-navy hover:text-orange-accent transition-colors truncate"
                            >
                              {pouch.name}
                            </Link>
                            {pouch.has_password && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                                <Lock className="w-2.5 h-2.5" />
                                Protected
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span>Created {formatDate(pouch.created_at)}</span>
                            <span>•</span>
                            <span className="font-medium text-navy">
                              {pouch.file_count || 0} {pouch.file_count === 1 ? "file" : "files"}
                            </span>
                            <span>•</span>
                            <span className="text-gray-400 font-mono text-[11px]">
                              /p/{pouch.slug}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                          <button
                            onClick={() => handleCopyLink(pouch.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border bg-white text-navy hover:bg-[#faf8f5] transition-colors shadow-2xs"
                            title="Copy public link"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-green-700 font-semibold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-gray-500" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          <Link
                            href={`/dashboard/pouch/${pouch.slug}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy hover:bg-navy-hover text-white transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
