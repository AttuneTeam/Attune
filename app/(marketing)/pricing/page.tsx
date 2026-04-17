import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export const metadata = {
  title: "Pricing · Attune",
  description: "Simple, honest pricing. Free during early access.",
};

const features = [
  "Unlimited team members",
  "AI-powered meeting insights",
  "Team pulse & coverage tracking",
  "Strategic initiatives",
  "Manager profile insights",
  "Stakeholder tracking",
  "Google Calendar integration",
  "Slack integration",
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#383831] mb-4">
          Simple, honest pricing.
        </h1>
        <p className="text-lg text-[#7a7870]">
          Everything included. Free while we're in early access.
        </p>
      </section>

      {/* Plan card */}
      <section className="max-w-md mx-auto px-6 pb-20">
        <div className="rounded-2xl border-2 border-[#416c63] bg-white shadow-sm overflow-hidden">
          <div className="p-8 border-b border-[#d6d4cb]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-[#416c63] mb-1">
                  Early Access
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-[#383831]">Free</span>
                </div>
              </div>
              <span className="text-xs font-medium bg-[#c8ddd9] text-[#2a4f47] px-2.5 py-1 rounded-full">
                For a limited time
              </span>
            </div>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#b43a10] text-white font-semibold rounded-xl hover:bg-[#9a3009] transition-colors"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7a7870] mb-5">
              Everything included
            </p>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-[#416c63]" />
                  <span className="text-sm text-[#383831]">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section className="border-t border-[#d6d4cb] bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#7a7870] mb-4">
            Coming later in 2025
          </p>
          <h2 className="text-2xl font-bold text-[#383831] mb-3">
            Team &amp; Enterprise plans
          </h2>
          <p className="text-[#7a7870] mb-8">
            Per-seat pricing · Advanced analytics · SSO · Priority support
          </p>
          <p className="text-sm text-[#7a7870]">
            Lock in free access now — early users keep it free longer.
          </p>
        </div>
      </section>
    </>
  );
}
