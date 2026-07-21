import { SiteHeader } from "@/components/SiteHeader";
import { DecisionIntake } from "@/components/decision/DecisionIntake";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { RoutableCard } from "@/lib/decision-engine/types";

export const revalidate = 60;

export const metadata = {
  title: "Decision assistant | GO TO",
  description: "Route an operational question to verified flydubai procedures.",
};

// Phase A: deterministic routing over approved+published cards only.
// No external AI, no drafts, no personal-data persistence.
export default async function DecisionPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      "id, title, slug, category, service_code, service_type, summary, keywords, aliases, priority, source_version"
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("priority", { ascending: false })
    .limit(200);

  const cards = ((data ?? []) as RoutableCard[]).filter(Boolean);

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <main id="main" className="reveal mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Decision assistant
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Route an operational question
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted">
            Deterministic routing to verified, published procedures — never generated policy.
            Official approvals (supervisor, medical, airport, immigration) always stand.
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="content-card p-6">
            <p className="text-sm font-bold text-ink">No published procedures available yet.</p>
            <p className="mt-1 text-sm text-ink-muted">
              The assistant routes only to approved and published operational cards. Publish
              cards from the admin review queue to enable routing.
            </p>
          </div>
        ) : (
          <DecisionIntake cards={cards} />
        )}
      </main>
    </div>
  );
}
