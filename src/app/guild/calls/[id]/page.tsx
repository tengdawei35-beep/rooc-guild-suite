import Link from "next/link";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import CallDetailClient from "./CallDetailClient";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentAuth();
  if (!auth) return null;
  if (!hasPermission(auth.role, "events.view")) return <main className="min-h-screen bg-zinc-950 p-8 text-white">You do not have permission to view this call.</main>;
  const { id } = await params;
  return <CallDetailClient id={id} />;
}
