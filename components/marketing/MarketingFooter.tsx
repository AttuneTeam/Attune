import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#d6d4cb] bg-[#fcf9f2]">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[#7a7870]">
          © {new Date().getFullYear()} Attune. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm text-[#7a7870] hover:text-[#383831] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm text-[#7a7870] hover:text-[#383831] transition-colors"
          >
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
