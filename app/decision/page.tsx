import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
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
export default async function DecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ procedure?: string }>;
}) {
  const { procedure } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("procedure_cards")
    .select(
      "id, title, slug, category, service_code, service_type, summary, keywords, aliases, priority, source_version, last_reviewed_at, chapters(slug)"
    )
    .eq("is_published", true)
    .eq("review_status", "approved")
    .order("priority", { ascending: false })
    .limit(200);

  // The chapters(slug) embed is a to-one relation (single object at runtime),
  // but Supabase's generated types widen it to an array; cast through unknown.
  const cards = ((data ?? []) as unknown as RoutableCard[]).filter(Boolean);
  const initialProcedureSlug =
    typeof procedure === "string" && procedure.trim().length > 0 ? procedure.trim() : null;

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />
      <AgentPage>
        {/* DecisionIntake owns the "Guided decision" header and gracefully
            handles an empty card set and direct ?procedure= preselect. */}
        <DecisionIntake cards={cards} initialProcedureSlug={initialProcedureSlug} />
      </AgentPage>
    </div>
  );
}
