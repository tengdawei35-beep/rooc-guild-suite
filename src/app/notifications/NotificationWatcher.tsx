"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type RosterState = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  parties: Array<{
    id: string;
    partyNumber: number;
    battlefield: string;
    members: Array<{ id: string; slotNumber: number; memberId: string }>;
  }>;
};

type NotificationState = {
  latestAllocation: { id: string; eventId: string | null; completedAt: string | null } | null;
  rosters: RosterState[];
};

function eventIdFromPath(pathname: string) {
  const match = pathname.match(/^\/events\/([^/]+)$/);
  return match?.[1] ?? null;
}

function rosterSignature(rosters: RosterState[]) {
  return JSON.stringify(
    rosters.map((roster) => ({
      id: roster.id,
      name: roster.name,
      parties: roster.parties.map((party) => ({
        id: party.id,
        members: party.members.map((member) => [member.id, member.memberId, member.slotNumber]),
      })),
    }))
  );
}

export default function NotificationWatcher() {
  const pathname = usePathname();
  const previousRoster = useRef<{ signature: string; rosters: RosterState[] } | null>(null);
  const previousAllocation = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const eventId = eventIdFromPath(pathname);
        const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
        const response = await fetch(`/api/notifications/state${query}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;

        const state = await response.json() as NotificationState;

        const allocationId = state.latestAllocation?.id ?? null;
        if (previousAllocation.current === null) {
          previousAllocation.current = allocationId;
        } else if (allocationId && allocationId !== previousAllocation.current) {
          previousAllocation.current = allocationId;
          const key = `hmdl-notified-bid-${allocationId}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void fetch("/api/notifications/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "bid", allocationRunId: allocationId }),
            });
          }
        }

        if (!eventId) return;

        const signature = rosterSignature(state.rosters);
        if (!previousRoster.current) {
          previousRoster.current = { signature, rosters: state.rosters };
          return;
        }

        if (signature !== previousRoster.current.signature) {
          const oldIds = new Set(previousRoster.current.rosters.map((roster) => roster.id));
          const changedRoster = state.rosters.find((roster) => !oldIds.has(roster.id))
            ?? state.rosters.find((roster) => {
              const old = previousRoster.current?.rosters.find((candidate) => candidate.id === roster.id);
              return old && JSON.stringify(old.parties) !== JSON.stringify(roster.parties);
            });

          const rosterId = changedRoster?.id ?? null;
          const key = `hmdl-notified-roster-${eventId}-${signature}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            void fetch("/api/notifications/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "roster", eventId, rosterId }),
            });
          }
          previousRoster.current = { signature, rosters: state.rosters };
        }
      } catch {
        // Notification delivery must never disrupt the main application.
      }
    }

    void check();
    const timer = window.setInterval(check, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
