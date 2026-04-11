"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { format, addHours, parseISO } from "date-fns";
import type { TeamMember } from "@/lib/supabase/types";

function buildGCalUrl(title: string, scheduledAt: string, agenda: string) {
  const start = parseISO(scheduledAt);
  const end = addHours(start, 1);
  const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: agenda,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function NewBookingButton({ members }: { members: TeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [agenda, setAgenda] = useState("");
  const router = useRouter();

  const reset = () => {
    setMemberId("");
    setTitle("");
    setScheduledAt("");
    setAgenda("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("interactions").insert({
      participant_id: memberId,
      manager_id: user.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      type: "scheduled",
      status: "upcoming",
      title: title || null,
      agenda: agenda || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Booking scheduled");
      if (agenda !== "" || title !== "") {
        window.open(
          buildGCalUrl(
            title || "1-on-1",
            new Date(scheduledAt).toISOString(),
            agenda,
          ),
          "_blank",
        );
      }
      reset();
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
        Schedule 1-on-1
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a 1-on-1</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="nb-member">Person *</Label>
              <Select value={memberId} onValueChange={setMemberId} required>
                <SelectTrigger id="nb-member">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nb-title">Title</Label>
              <Input
                id="nb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="1-on-1 with…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nb-date">Date & time *</Label>
              <Input
                id="nb-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nb-agenda">Agenda</Label>
              <Textarea
                id="nb-agenda"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                rows={3}
                placeholder="Topics to cover…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !memberId || !scheduledAt}
              >
                {loading ? "Saving…" : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
