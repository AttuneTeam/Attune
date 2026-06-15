"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Target,
  Network,
  Plus,
  CalendarPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { OrgTreeDisplay } from "@/components/dashboard/OrgStructureSheet";
import { DescriptionEditor } from "@/components/action-items/DescriptionEditor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format, addHours, parseISO } from "date-fns";
import type { Team, TeamMember } from "@/lib/supabase/types";

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

interface Props {
  teams: Team[];
  members: TeamMember[];
  userId: string;
}

export function DashboardOverflowMenu({ teams, members, userId }: Props) {
  const router = useRouter();

  // — New initiative —
  const [creatingInitiative, setCreatingInitiative] = useState(false);

  // — Org chart —
  const [orgOpen, setOrgOpen] = useState(false);

  // — Add action —
  const [actionOpen, setActionOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");
  const [actionAssigneeId, setActionAssigneeId] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const resetAction = () => {
    setActionTitle("");
    setActionDescription("");
    setActionDueDate("");
    setActionAssigneeId("");
  };

  const handleSaveAction = async () => {
    const trimmedDesc = actionDescription.trim();
    if (!trimmedDesc) return;
    setSavingAction(true);
    const supabase = createClient();
    const { error } = await supabase.from("action_items").insert({
      user_id: userId,
      title: actionTitle.trim() || null,
      description: trimmedDesc,
      status: "open",
      due_date: actionDueDate || null,
      assignee_id: actionAssigneeId || null,
    });
    setSavingAction(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Action created");
      setActionOpen(false);
      resetAction();
      router.refresh();
    }
  };

  // — Schedule 1-on-1 —
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingMemberId, setBookingMemberId] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingScheduledAt, setBookingScheduledAt] = useState("");
  const [bookingAgenda, setBookingAgenda] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);

  const resetBooking = () => {
    setBookingMemberId("");
    setBookingTitle("");
    setBookingScheduledAt("");
    setBookingAgenda("");
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBooking(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingBooking(false);
      return;
    }
    const { error } = await supabase.from("interactions").insert({
      participant_id: bookingMemberId,
      manager_id: user.id,
      scheduled_at: new Date(bookingScheduledAt).toISOString(),
      type: "scheduled",
      status: "upcoming",
      title: bookingTitle || null,
      agenda: bookingAgenda || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Booking scheduled");
      if (bookingAgenda || bookingTitle) {
        window.open(
          buildGCalUrl(
            bookingTitle || "1-on-1",
            new Date(bookingScheduledAt).toISOString(),
            bookingAgenda,
          ),
          "_blank",
        );
      }
      setBookingOpen(false);
      resetBooking();
      router.refresh();
    }
    setSavingBooking(false);
  };

  const handleNewInitiative = async () => {
    setCreatingInitiative(true);
    try {
      const res = await fetch("/api/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      const { id } = await res.json();
      router.push(`/initiatives/${id}`);
    } catch {
      setCreatingInitiative(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setActionOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add action
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setBookingOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Schedule 1-on-1
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleNewInitiative}
            disabled={creatingInitiative}
          >
            <Target className="h-3.5 w-3.5" />
            {creatingInitiative ? "Creating…" : "New initiative"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOrgOpen(true)}>
            <Network className="h-3.5 w-3.5" />
            Org chart
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add action dialog */}
      <Dialog
        open={actionOpen}
        onOpenChange={(o) => {
          setActionOpen(o);
          if (!o) resetAction();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Title (optional)
              </label>
              <Input
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder="Short title…"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </label>
              {actionOpen && (
                <DescriptionEditor
                  key="new-action"
                  initialValue={actionDescription}
                  onChange={setActionDescription}
                  placeholder="What needs to be done?"
                />
              )}
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Person (optional)
                </label>
                <select
                  value={actionAssigneeId}
                  onChange={(e) => setActionAssigneeId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No one</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Due date (optional)
              </label>
              <Input
                type="date"
                value={actionDueDate}
                onChange={(e) => setActionDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAction}
              disabled={savingAction || !actionDescription.trim()}
            >
              {savingAction ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule 1-on-1 dialog */}
      <Dialog
        open={bookingOpen}
        onOpenChange={(o) => {
          setBookingOpen(o);
          if (!o) resetBooking();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule a 1-on-1</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBooking} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="nb-member">Person *</Label>
              <Select
                value={bookingMemberId}
                onValueChange={(v) => setBookingMemberId(v ?? "")}
                required
              >
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
                value={bookingTitle}
                onChange={(e) => setBookingTitle(e.target.value)}
                placeholder="1-on-1 with…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-date">Date & time *</Label>
              <Input
                id="nb-date"
                type="datetime-local"
                value={bookingScheduledAt}
                onChange={(e) => setBookingScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-agenda">Agenda</Label>
              <Textarea
                id="nb-agenda"
                value={bookingAgenda}
                onChange={(e) => setBookingAgenda(e.target.value)}
                rows={3}
                placeholder="Topics to cover…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBookingOpen(false);
                  resetBooking();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingBooking || !bookingMemberId || !bookingScheduledAt}
              >
                {savingBooking ? "Saving…" : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Org chart sheet */}
      <Sheet open={orgOpen} onOpenChange={setOrgOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto p-0 gap-0">
          <SheetHeader className="border-b px-6 py-4 sticky top-0 bg-popover z-10">
            <SheetTitle>Org Structure</SheetTitle>
          </SheetHeader>
          <div className="px-6 py-6">
            <OrgTreeDisplay teams={teams} members={members} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
