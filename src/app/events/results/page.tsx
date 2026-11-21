import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import EventResultsClient from "./EventResultsClient";

export default async function EventResultsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "events.view")) redirect("/");
  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl px-6 py-10"><Link href="/events" className="text-sm text-zinc-500 hover:text-white">← Events</Link><h1 className="mt-5 text-3xl font-bold">Event Results</h1><p className="mt-2 text-sm text-zinc-500">Browse uploaded result screenshots by event date and type.</p><EventResultsClient /></div></main>;
}
