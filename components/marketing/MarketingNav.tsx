"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import logo from "@/components/logo2.png";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-[#fcf9f2]/95 backdrop-blur border-b border-[#d6d4cb] shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image alt="Attune" src={logo} width={120} />
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-sm font-medium text-[#7a7870] hover:text-[#383831] transition-colors px-3 py-2"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[#383831] hover:text-[#416c63] transition-colors px-4 py-2 rounded-lg border border-[#d6d4cb] hover:border-[#416c63]"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-white bg-[#b43a10] hover:bg-[#9a3009] transition-colors px-4 py-2 rounded-lg"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
