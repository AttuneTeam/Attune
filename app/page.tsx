import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  Brain,
  MessageSquare,
  Target,
} from "lucide-react";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-[#fcf9f2]">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 40px, #416c63 40px, #416c63 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #416c63 40px, #416c63 41px)",
            }}
          />
          <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
            <p className="text-sm font-semibold tracking-widest uppercase text-[#416c63] mb-6">
              Leadership Intelligence
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] text-[#383831] mb-8 max-w-3xl">
              Manage with clarity.
              <br />
              Lead with insight.
            </h1>
            <p className="text-lg sm:text-xl text-[#7a7870] max-w-2xl mb-10 leading-relaxed">
              Attune is a leadership intelligence platform that challenges your
              thinking, sharpens your judgment, and helps you become a better
              leader over time.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#b43a10] text-white font-semibold rounded-xl hover:bg-[#9a3009] transition-colors text-base"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-sm text-[#7a7870]">
                Free during early access · No credit card
              </p>
            </div>
          </div>
        </section>

        {/* What makes Attune different */}
        <section className="bg-white border-y border-[#d6d4cb]">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <p className="text-sm font-semibold tracking-widest uppercase text-[#7a7870] mb-12 text-center">
              What makes Attune different
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  from: "Snapshots",
                  to: "Patterns",
                  desc: "Track how your leadership evolves over weeks, not just one-off reviews.",
                },
                {
                  from: "Monitoring",
                  to: "Attunement",
                  desc: "Move from watching your team to genuinely understanding what they need.",
                },
                {
                  from: "Static Advice",
                  to: "Dynamic Perspectives",
                  desc: "AI that debates with you — not a chatbot that just agrees.",
                },
                {
                  from: "Data",
                  to: "Judgment",
                  desc: "Turn interaction history into sharper decisions, not just dashboards.",
                },
              ].map(({ from, to, desc }) => (
                <div
                  key={from}
                  className="rounded-2xl border border-[#d6d4cb] bg-[#fcf9f2] p-6"
                >
                  <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                    <span className="text-base font-medium text-[#7a7870]">
                      From {from}
                    </span>
                    <span className="text-[#b43a10] font-bold text-lg">→</span>
                    <span className="text-base font-bold text-[#416c63]">
                      {to}
                    </span>
                  </div>
                  <p className="text-sm text-[#7a7870] leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-sm font-semibold tracking-widest uppercase text-[#7a7870] mb-12 text-center">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Track interactions",
                desc: "Log 1-on-1s, notes, and Slack messages. Capture what actually happens, not just what you planned.",
              },
              {
                step: "02",
                title: "Surface patterns",
                desc: "Attune reveals what shifts and why — across sentiment, themes, coverage, and your own behaviour.",
              },
              {
                step: "03",
                title: "Sharpen judgment",
                desc: "AI perspectives that challenge your assumptions and strengthen how you decide and lead.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3">
                <span className="text-3xl font-bold text-[#d6d4cb]">
                  {step}
                </span>
                <h3 className="text-lg font-semibold text-[#383831]">
                  {title}
                </h3>
                <p className="text-sm text-[#7a7870] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AI perspectives */}
        <section className="bg-white border-y border-[#d6d4cb]">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <p className="text-sm font-semibold tracking-widest uppercase text-[#7a7870] mb-4 text-center">
              Four AI perspectives
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#383831] text-center mb-12 max-w-xl mx-auto">
              Designed to challenge how you think, not just confirm it
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {[
                {
                  icon: Brain,
                  label: "The Challenger",
                  desc: "Questions your assumptions and stress-tests your reasoning before you act.",
                },
                {
                  icon: TrendingUp,
                  label: "The Systems Thinker",
                  desc: "Reveals structural issues beneath surface-level team dynamics.",
                },
                {
                  icon: MessageSquare,
                  label: "The Mentor",
                  desc: "Guides your development with the perspective of a seasoned leader.",
                },
                {
                  icon: Target,
                  label: "The Realist",
                  desc: "Grounds your decisions in real constraints — no wishful thinking.",
                },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex gap-4 p-5 rounded-2xl border border-[#d6d4cb] bg-[#fcf9f2]"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-[#c8ddd9] flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#416c63]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#383831] mb-1">{label}</p>
                    <p className="text-sm text-[#7a7870] leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mission statement */}
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <blockquote className="text-xl sm:text-2xl font-medium text-[#383831] leading-relaxed">
            "Most leadership tools help you manage tasks. Attune helps you
            understand yourself as a leader — and become someone worth
            following."
          </blockquote>
        </section>

        {/* CTA banner */}
        <section className="bg-[#416c63]">
          <div className="max-w-5xl mx-auto px-6 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for managers who want to become leaders.
            </h2>
            <p className="text-[#c8ddd9] text-lg mb-10">
              Free during early access.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#b43a10] text-white font-bold rounded-xl hover:bg-[#9a3009] transition-colors text-lg"
            >
              Create your account
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
