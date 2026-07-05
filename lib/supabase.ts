import { createBrowserClient } from "@supabase/ssr";

// These are PUBLIC keys (safe to expose in the browser); Row Level Security
// in Supabase controls what each request can actually read/write.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
