import { redirect } from "next/navigation";

import EventsClient from "./EventsClient";
import EventTypesManager from "./EventTypesManager";

import {
  hasPermission,
  requirePageAuth,
} from "@/lib/auth";

type EventsView =
  | "events"
  | "rosters"
  | "preferred";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
  }>;
}) {
  const auth =
    await requirePageAuth();

  const params =
    await searchParams;

  const view: EventsView =
    params.view === "rosters" ||
    params.view === "preferred"
      ? params.view
      : "events";

  // ===========================================================
  // PAGE ACCESS
  // ===========================================================

  if (
    view === "events" &&
    !hasPermission(
      auth.role,
      "events.view"
    )
  ) {
    redirect("/");
  }

  if (
    (
      view === "rosters" ||
      view === "preferred"
    ) &&
    !hasPermission(
      auth.role,
      "rosters.view"
    )
  ) {
    redirect("/");
  }

  return (
    <>
      {view === "events" && auth.guild.gameType === "RO3" && hasPermission(auth.role, "events.manage") && <div className="mx-auto max-w-7xl px-6 pt-8"><EventTypesManager /></div>}
      <EventsClient initialView={view} />
    </>
  );
}