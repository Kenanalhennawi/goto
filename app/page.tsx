import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { AgentSection } from "@/components/agent/AgentSection";
import { PrimarySearch } from "@/components/agent/PrimarySearch";
import { TaskShortcut } from "@/components/agent/TaskShortcut";
import { AgentWorkspace } from "@/components/AgentWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// SIGNED-OUT ACCESS (UX-R1G): this homepage is currently reachable while signed
// out — the repo has NO global middleware auth boundary, and public read of
// published content depends on Supabase RLS. The footer disclaimer is not an
// access-control mechanism. UX-R1G intentionally did NOT change auth/middleware/
// RLS. Making the guide internal-only must be handled in a separate, approved
// security phase (add middleware requiring a session + tighten RLS).

export const revalidate = 60;

export const metadata = {
  title: "GO TO | flydubai Contact Centre",
  description: "Describe what the customer is asking about and get the right operational answer.",
};

// Plain-language common tasks. Each routes to the best safe destination decided
// on the server: a published procedure card when one exists, otherwise a normal
// search query. No guided workflow is linked here, so nothing unavailable can be
// started from the homepage.
// NOTE (UX-R1G): this order is an INFORMED ASSUMPTION of high-frequency contact-
// centre tasks — no organization-wide usage analytics exist yet. Keep this array
// easy to re-order once real usage data is available. Government deals was moved
// off the homepage (still reachable via Search, Browse services, and its
// procedure page). A task deep-links to a published procedure when a suitable
// card exists, otherwise to a search query — never to a guided workflow.
const COMMON_TASKS: { label: string; hint: string; slug?: string; query: string }[] = [
  { label: "Name correction", hint: "Fix a name on a booking", slug: "name-correction", query: "name correction" },
  { label: "Change or cancel a flight", hint: "Rebooking and cancellation", query: "flight change cancellation" },
  { label: "Refund and voucher", hint: "Refunds and travel vouchers", query: "refund voucher" },
  { label: "Baggage", hint: "Allowances and bags", query: "baggage" },
  { label: "Check-in", hint: "Online and airport check-in", slug: "check-in-olci", query: "check-in" },
  { label: "Wheelchair and medical assistance", hint: "Mobility and medical support", query: "wheelchair medical assistance" },
  { label: "Travel documents", hint: "Visa, residency, OK to Board", slug: "travel-requirements", query: "visa travel requirements OK to board" },
  { label: "Flight disruption", hint: "Delays and disruptions", slug: "flight-disruption", query: "flight disruption" },
];

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  // Only slugs of cards that are approved AND published are eligible to deep-link
  // to a procedure page; everything else falls back to search. This mirrors the
  // published+approved visibility used elsewhere and never leaks internal state.
  const { data: publishedCards } = await supabase
    .from("procedure_cards")
    .select("slug")
    .eq("is_published", true)
    .eq("review_status", "approved");
  const publishedSlugs = new Set(
    ((publishedCards ?? []) as { slug: string }[]).map((card) => card.slug)
  );

  const tasks = COMMON_TASKS.map((task) => ({
    label: task.label,
    hint: task.hint,
    href:
      task.slug && publishedSlugs.has(task.slug)
        ? `/procedure/${task.slug}`
        : `/search?q=${encodeURIComponent(task.query)}`,
  }));

  return (
    <div className="dashboard-shell flex min-h-full flex-col">
      <SiteHeader />

      <AgentPage width="wide">
        <section className="agent-hero p-5 sm:p-7 lg:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            What is the customer asking about?
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Describe the passenger&rsquo;s request or problem in your own words.
          </p>
          <div className="mt-5">
            <PrimarySearch />
          </div>

          {/* Quiet reassurance — what a search returns, in plain language. */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-4 text-xs text-ink-muted">
            <span className="font-semibold uppercase tracking-wider text-ink-faint">What you&rsquo;ll get</span>
            <span>Quick operational answer</span>
            <span aria-hidden="true" className="text-ink-faint">·</span>
            <span>Guided questions when needed</span>
            <span aria-hidden="true" className="text-ink-faint">·</span>
            <span>Original source available</span>
          </div>
        </section>

        <AgentSection title="Common tasks">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tasks.map((task) => (
              <TaskShortcut key={task.label} label={task.label} href={task.href} hint={task.hint} />
            ))}
          </div>
        </AgentSection>

        {/* Adaptive personal workspace (favorites / recent / continue). Always
            renders one compact section; shows a calm hint when empty. */}
        <div className="mt-8">
          <AgentWorkspace />
        </div>
      </AgentPage>
    </div>
  );
}
