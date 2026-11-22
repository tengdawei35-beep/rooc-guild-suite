import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import EventResultsClient from "./EventResultsClient";

export default async function EventResultsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "events.view")) redirect("/");
  return <main className="hmdl-management hmdl-results-archive min-h-screen bg-zinc-950 text-white"><div className="hmdl-page mx-auto max-w-7xl"><h1 className="hmdl-page-title">Event Results</h1><p className="mt-2 text-sm text-zinc-500">Browse uploaded result screenshots by event date and type.</p><EventResultsClient /></div></main>;
}
