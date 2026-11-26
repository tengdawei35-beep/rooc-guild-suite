import { redirect } from "next/navigation";
import { hasPermission, requirePageAuth } from "@/lib/auth";
import ResourceHistoryClient from "./ResourceHistoryClient";

export default async function ResourceHistoryPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "allocation.view")) redirect("/");
  return <main className="hmdl-management hmdl-history-workspace"><div className="hmdl-page"><ResourceHistoryClient /></div></main>;
}
