import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { MANUAL_SOURCES_BUCKET, MAX_PDF_BYTES, validateUploadRequest, pendingUploadPath } from "@/lib/sync-upload";

// UPD-2: mint a short-lived SIGNED UPLOAD URL so the browser sends the PDF
// straight to private Supabase Storage — the ~20 MB file never passes through
// a Vercel function, and no service-role key is involved. The signed URL is
// created with the ADMIN'S OWN session, so storage RLS still applies.
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session.ok) return session.response;
  const { supabase, user } = session;

  const body = await request.json().catch(() => null);
  const check = validateUploadRequest(body);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, errorCode: check.errorCode }, { status: 400 });
  }

  const path = pendingUploadPath(user.id, check.value.fileName);

  const { data, error } = await supabase.storage
    .from(MANUAL_SOURCES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Signed upload URL failed", error);
    return NextResponse.json(
      { error: "Could not start the upload. Check storage configuration.", errorCode: "UPLOAD_URL_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      bucket: MANUAL_SOURCES_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      maxBytes: MAX_PDF_BYTES,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
