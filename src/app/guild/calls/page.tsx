import Link from "next/link";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import CallsClient from "./CallsClient";

export default async function CallsPage() {
  const auth = await getCurrentAuth();
  if (!auth) return null;
  if (!hasPermission(auth.role, "events.view")) return <main className="min-h-screen bg-zinc-950 p-8 text-white">You do not have permission to view Call To Arms.</main>;
  return <CallsClient canManageDiscord={["ADMIN", "MANAGER", "OFFICER"].includes(auth.role)} />;
}
