"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "@/components/chat/ChatSheet";
import { MobileNavContext } from "@/components/layout/MobileNavContext";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ sidebar, children }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [participantName, setParticipantName] = useState<string | undefined>();
  const pathname = usePathname();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const memberId = pathname.match(/^\/team\/([^/]+)/)?.[1];
    if (!memberId) {
      setParticipantName(undefined);
      return;
    }
    const supabase = createClient();
    supabase
      .from("team_members")
      .select("name")
      .eq("id", memberId)
      .single()
      .then(({ data }) => setParticipantName(data?.name ?? undefined));
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — static flex item on desktop, fixed overlay on mobile */}
      <MobileNavContext.Provider
        value={{ close: () => setMobileNavOpen(false) }}
      >
        <div
          className={cn(
            "max-[479px]:fixed max-[479px]:inset-y-0 max-[479px]:left-0 max-[479px]:z-50 max-[479px]:transition-transform max-[479px]:duration-300",
            !mobileNavOpen && "max-[479px]:-translate-x-full",
          )}
        >
          {sidebar}
        </div>
      </MobileNavContext.Provider>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 min-[480px]:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <main className="p-4 sm:p-6 flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} participantName={participantName} />}
      </div>

      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="min-[480px]:hidden fixed top-3 left-3 z-30 p-2 rounded-md bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full transition-shadow hover:shadow-lg"
          style={{
            background: "rgba(255, 255, 255, 0.70)",
            backdropFilter: "blur(20px)",
            boxShadow: "0px 24px 48px rgba(56, 56, 49, 0.10)",
            color: "var(--color-primary)",
            border: "1px solid rgba(65, 108, 99, 0.15)",
          }}
          title="Ask Team AI"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}
    </div>
  );
}
