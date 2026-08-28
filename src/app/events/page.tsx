import { redirect } from "next/navigation";

import EventsClient from "./EventsClient";

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
    <EventsClient
      initialView={view}
    />
  );
}