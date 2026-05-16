"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 68;
const SNAP_THRESHOLD = ACTION_WIDTH * 0.45;

export function SwipeableActionRow({
  rowId,
  activeSwipeId,
  setActiveSwipeId,
  onEdit,
  onDeleteRequest,
  children,
  className,
}: {
  rowId: string;
  activeSwipeId: string | null;
  setActiveSwipeId: (id: string | null) => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const touchStartX = useRef(0);
  const baseOffset = useRef(0);
  const [displayOffset, setDisplayOffset] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (activeSwipeId && !activeSwipeId.startsWith(rowId)) {
      setTransitioning(true);
      baseOffset.current = 0;
      setDisplayOffset(0);
    }
  }, [activeSwipeId, rowId]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setTransitioning(false);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const raw = baseOffset.current + dx;
    setDisplayOffset(Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, raw)));
  }

  function handleTouchEnd() {
    setTransitioning(true);
    if (displayOffset < -SNAP_THRESHOLD) {
      baseOffset.current = -ACTION_WIDTH;
      setDisplayOffset(-ACTION_WIDTH);
      setActiveSwipeId(`${rowId}:left`);
    } else if (displayOffset > SNAP_THRESHOLD) {
      baseOffset.current = ACTION_WIDTH;
      setDisplayOffset(ACTION_WIDTH);
      setActiveSwipeId(`${rowId}:right`);
    } else {
      baseOffset.current = 0;
      setDisplayOffset(0);
      setActiveSwipeId(null);
    }
  }

  function closeSwipe() {
    setTransitioning(true);
    baseOffset.current = 0;
    setDisplayOffset(0);
    setActiveSwipeId(null);
  }

  return (
    <div className={cn("relative overflow-hidden border-b last:border-0", className)}>
      {/* Edit — revealed by swipe right */}
      <div className="absolute left-0 inset-y-0 w-[68px] bg-accent flex items-center justify-center">
        <button
          type="button"
          onClick={() => { closeSwipe(); onEdit(); }}
          className="flex flex-col items-center gap-1 text-foreground"
          aria-label="Edit"
        >
          <Pencil className="h-5 w-5" />
          <span className="text-[10px] font-medium">Edit</span>
        </button>
      </div>

      {/* Delete — revealed by swipe left */}
      <div className="absolute right-0 inset-y-0 w-[68px] bg-destructive flex items-center justify-center">
        <button
          type="button"
          onClick={() => { closeSwipe(); onDeleteRequest(); }}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>

      {/* Row content */}
      <div
        style={{ transform: `translateX(${displayOffset}px)`, touchAction: "pan-y" }}
        className={cn("relative bg-card", transitioning && "transition-transform duration-200")}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => displayOffset !== 0 && closeSwipe()}
      >
        {children}
      </div>
    </div>
  );
}
