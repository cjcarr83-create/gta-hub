"use client";

import { useState } from "react";

// Three genuinely different mechanisms live in this one component,
// because "share to Facebook and Instagram" isn't actually one feature:
//
// 1. Web Share API (navigator.share) — on a phone, this opens the
//    OS-level share sheet, which includes the Facebook and Instagram
//    apps directly if installed. This is the real "share to Instagram"
//    path — Instagram has no equivalent of Facebook's URL-based share
//    dialog, so the native share sheet (or manual copy-paste into a
//    Story/DM) is the only reliable way to get a link into Instagram.
// 2. Facebook Share Dialog — a plain URL-based popup
//    (facebook.com/sharer/sharer.php), works on desktop and mobile web,
//    no login/app-review needed. This one's straightforward because
//    Facebook actually supports link-based sharing; Instagram doesn't.
// 3. Copy link — universal fallback, and genuinely the main path for
//    Instagram on desktop, where there's no app to hand off to.
export default function ShareSheet({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: description, url });
    } catch {
      // user cancelled the share sheet — not an error worth surfacing
    }
  }

  function handleFacebookShare() {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=600");
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-sm uppercase tracking-wide text-sand-muted">Share</h2>

      <div className="space-y-2">
        {canNativeShare && (
          <button onClick={handleNativeShare} className="btn-primary w-full">
            Share…
          </button>
        )}

        <button onClick={handleFacebookShare} className="btn-secondary w-full">
          Share to Facebook
        </button>

        <button onClick={handleCopyLink} className="btn-secondary w-full">
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      {/* Instagram has no URL-based share dialog like Facebook's — the
          only reliable paths are the native share sheet above (on
          mobile, if the person taps "Share…" and picks Instagram) or
          copying the link and pasting it into a Story/DM/bio manually. */}
      <p className="mt-3 text-xs text-sand-muted">
        For Instagram: use &quot;Share…&quot; on mobile and pick Instagram, or copy
        the link and paste it into a Story or DM — Instagram doesn&apos;t support
        direct link-sharing from the web the way Facebook does.
      </p>
    </div>
  );
}
