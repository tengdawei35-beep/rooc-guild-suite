import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";
import AffiliatesClient from "./AffiliatesClient";

export default async function AffiliatesPage() {
  if (!(await getPlatformAdmin())) redirect("/login");
  return <AffiliatesClient />;
}
