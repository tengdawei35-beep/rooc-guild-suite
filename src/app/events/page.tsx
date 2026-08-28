import Link from "next/link";
import EventsClient from "./EventsClient";
import { requirePageAuth } from "@/lib/auth";
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
  await requirePageAuth();
  const params =
    await searchParams;

  const view: EventsView =
    params.view === "rosters" ||
    params.view === "preferred"
      ? params.view
      : "events";

  return (
    <EventsClient
      initialView={view}
    />
  );
}<Link
  href="/"
  className="mb-6 inline-block text-sm text-zinc-500 transition hover:text-white"
>
  ← Dashboard
</Link>
