"use client";

import { useEffect } from "react";

export default function RosterSaveNotificationBridge({
  eventId,
}: {
  eventId: string;
}) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.textContent?.trim() !== "Done Editing") return;

      void fetch(`/api/events/${eventId}/rosters/save`, {
        method: "POST",
      }).catch((error) => {
        console.error("[ROSTER SAVE] Notification request failed:", error);
      });
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [eventId]);

  return null;
}
