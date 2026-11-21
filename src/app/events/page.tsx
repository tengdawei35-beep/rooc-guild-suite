import { redirect } from "next/navigation";

import EventsClient from "./EventsClient";
import EventTypesManager from "./EventTypesManager";

import {
  hasPermission,
  requirePageAuth,
} from "@/lib/auth";

type EventsView = "events" | "rosters" | "preferred";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const auth = await requirePageAuth();
  const params = await searchParams;
  const view: EventsView =
    params.view === "rosters" || params.view === "preferred"
      ? params.view
      : "events";

  if (view === "events" && !hasPermission(auth.role, "events.view")) redirect("/");
  if ((view === "rosters" || view === "preferred") && !hasPermission(auth.role, "rosters.view")) redirect("/");

  const canManageRo3EventTypes =
    view === "events" &&
    auth.guild.gameType === "RO3" &&
    hasPermission(auth.role, "events.manage");

  return (
    <>
      <EventsClient initialView={view} />
      {canManageRo3EventTypes && (
        <div className="mx-auto max-w-7xl px-6 pb-10">
          <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="font-semibold text-white">Event type & schedule settings</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure recurring RO3 event formats, capacity and guild timezone.
                </p>
              </div>
              <span className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition group-open:rotate-45">+</span>
            </summary>
            <div className="border-t border-zinc-800 p-2 sm:p-4">
              <EventTypesManager />
            </div>
          </details>
        </div>
      )}
    </>
  );
}
