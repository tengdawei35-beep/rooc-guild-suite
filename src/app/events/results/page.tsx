import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import EventResultsClient from "./EventResultsClient";
import ManagementPageHeader from "@/app/ManagementPageHeader";

export default async function EventResultsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "events.view")) redirect("/");
  return <main className="hmdl-management hmdl-results-archive min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="EVENT OPERATIONS" title="Event Results" description="Browse uploaded result screenshots by event date and type." breadcrumb={{ label: "Events", href: "/events" }} /><EventResultsClient /></div></main>;
}
