"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ACCEPTED_MIME, MANUAL_SOURCES_BUCKET, MAX_PDF_BYTES, formatBytes } from "@/lib/sync-upload";

// UPD-2: admin upload panel. The PDF goes DIRECTLY to private Supabase Storage
// through a short-lived signed URL, so the file never passes through a Vercel
// function and no service-role key is involved. Extraction is performed later
// by the background worker; this component only uploads and queues.

type Stage = "idle" | "requesting" | "uploading" | "queueing" | "done" | "error";

export function PdfUploadPanel() {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);

  const busy = stage === "requesting" || stage === "uploading" || stage === "queueing";

  function pick(selected: File | null) {
    setMessage(null);
    setNeedsOverride(false);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!/\.pdf$/i.test(selected.name) || selected.type !== ACCEPTED_MIME) {
      setFile(null);
      setStage("error");
      setMessage("Only PDF files are accepted.");
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setFile(null);
      setStage("error");
      setMessage(`This file is ${formatBytes(selected.size)}. The maximum is 40 MB.`);
      return;
    }
    setFile(selected);
    setStage("idle");
  }

  // SHA-256 computed in the browser purely so the server can detect duplicates.
  // The worker recomputes it from the stored object as the authoritative value.
  async function hashFile(target: File): Promise<string | null> {
    try {
      const buffer = await target.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return null;
    }
  }

  async function start() {
    if (!file) return;
    setMessage(null);

    try {
      setStage("requesting");
      const urlRes = await fetch("/api/sync/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
      });
      const urlJson = await urlRes.json();
      if (!urlRes.ok) {
        setStage("error");
        setMessage(urlJson.error ?? "Could not start the upload.");
        return;
      }

      setStage("uploading");
      const { error: uploadError } = await supabase.storage
        .from(MANUAL_SOURCES_BUCKET)
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, {
          contentType: ACCEPTED_MIME,
        });
      if (uploadError) {
        setStage("error");
        setMessage("The upload did not complete. Check your connection and try again.");
        return;
      }

      setStage("queueing");
      const sha256 = await hashFile(file);
      const runRes = await fetch("/api/sync/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: urlJson.path,
          originalFilename: file.name,
          sha256,
          overrideReason: overrideReason.trim() || undefined,
        }),
      });
      const runJson = await runRes.json();

      if (runRes.status === 409) {
        setStage("error");
        setNeedsOverride(true);
        setMessage(runJson.error ?? "This PDF is already being processed.");
        return;
      }
      if (!runRes.ok) {
        setStage("error");
        setMessage(runJson.error ?? "Could not queue the sync run.");
        return;
      }

      setStage("done");
      setMessage("Upload complete. The extraction job is queued.");
      setFile(null);
      setOverrideReason("");
      setNeedsOverride(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setStage("error");
      setMessage("Something went wrong during the upload. Try again.");
    }
  }

  return (
    <section className="content-card p-5">
      <h2 className="font-display text-base font-semibold text-ink">Upload new GO TO PDF</h2>
      <p className="mt-1 text-sm leading-6 text-ink-muted">
        PDF only, maximum 40 MB. The file is stored privately and extracted by the background
        worker. Nothing is published automatically.
      </p>

      <div className="mt-4 space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
        />

        {file ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">{file.name}</span>{" "}
            <span className="text-ink-muted">({formatBytes(file.size)})</span>
          </p>
        ) : null}

        {needsOverride ? (
          <div>
            <label htmlFor="override-reason" className="block text-xs font-semibold text-ink-muted">
              Override reason (required to re-process the same PDF)
            </label>
            <input
              id="override-reason"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink"
              placeholder="Why is a repeat run required?"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={start}
          disabled={!file || busy || (needsOverride && overrideReason.trim().length === 0)}
          className="agent-primary touch-target inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {stage === "requesting"
            ? "Preparing upload…"
            : stage === "uploading"
              ? "Uploading…"
              : stage === "queueing"
                ? "Queueing…"
                : "Upload and start sync"}
        </button>

        {message ? (
          <p
            role="status"
            className={`text-sm ${stage === "error" ? "font-semibold text-warn" : "text-ink-muted"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
