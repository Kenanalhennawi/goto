import { SiteHeader } from "@/components/SiteHeader";
import { AgentPage } from "@/components/agent/AgentPage";
import { AgentSection } from "@/components/agent/AgentSection";
import { PrimarySearch } from "@/components/agent/PrimarySearch";
import { TaskShortcut } from "@/components/agent/TaskShortcut";
import { AgentWorkspace } from "@/components/AgentWorkspace";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const revalidate = 60;

export const metadata = {
  title: "GO TO | flydubai Contact Centre",
  description: "Describe what the customer is asking about and get the right operational answer.",
};

// Plain-language common tasks. Each routes to the best safe destination decided
// on the server: a published procedure card when one exists, otherwise a normal
// search query. No guided workflow is linked here, so nothing unavailable can be
// started from the homepage.
const COMMON_TASKS: { label: string; hint: string; slug?: string; query: string }[] = [
  { label: "Name correction", hint: "Fix a name on a booking", slug: "name-correction", query: "name correction" },
  { label: "Wheelchair assistance", hint: "Mobility support", slug: "wheelchair", query: "wheelchair" },
  { label: "Baggage", hint: "Allowances and bags", query: "baggage" },
  { label: "Flight disruption", hint: "Delays and cancellations", slug: "flight-disruption", query: "flight disruption" },
  { label: "Check-in", hint: "Online and airport check-in", slug: "check-in-olci", query: "check-in" },
  { label: "Travel documents", hint: "Visa and residency", slug: "travel-requirements", query: "travel documents" },
  { label: "Medical assistance", hint: "Medical and special needs", query: "medical assistance" },
  { label: "Government deals", hint: "Esaad, Al Saada and similar", slug: "government-deals", query: "government deals" },
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

      <AgentPage>
        <section className="agent-hero p-5 sm:p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            What is the customer asking about?
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-ink-muted sm:text-[15px]">
            Describe the passenger&rsquo;s request or problem in your own words.
          </p>
          <div className="mt-5">
            <PrimarySearch />
          </div>
        </section>

        <AgentSection title="Common tasks">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tasks.map((task) => (
              <TaskShortcut key={task.label} label={task.label} href={task.href} hint={task.hint} />
            ))}
          </div>
        </AgentSection>

        {/* Personal workspace (favorites / recent / continue). Device-local and
            self-hiding when empty; renders nothing for a brand-new agent. */}
        <div className="mt-8">
          <AgentWorkspace />
        </div>
      </AgentPage>
    </div>
  );
}
