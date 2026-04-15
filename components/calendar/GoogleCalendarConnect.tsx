"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, X } from "lucide-react";
import { toast } from "sonner";

export function GoogleCalendarConnect({
  connected,
}: {
  connected: boolean;
}) {
  const [isConnected, setIsConnected] = useState(connected);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setIsConnected(false);
      toast.success("Google Calendar disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 text-green-500" />
        <span>Google Calendar connected</span>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="p-0.5 rounded hover:text-destructive hover:bg-muted transition-colors"
          title="Disconnect"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      render={<a href="/api/auth/google" />}
    >
      <CalendarDays className="h-3.5 w-3.5" />
      Connect Google Calendar
    </Button>
  );
}
