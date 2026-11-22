import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";
import AffiliatesClient from "./AffiliatesClient";

export default async function AffiliatesPage() {
  if (!(await getPlatformAdmin())) redirect("/login");
  return <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><AffiliatesClient /></div></main>;
}
