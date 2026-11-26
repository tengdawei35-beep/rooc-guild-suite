import { requirePageAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApplicantWatchlistClient from "./ApplicantWatchlistClient";

export default async function ApplicantWatchlistPage() {
  const auth = await requirePageAuth();
  if (auth.role !== "ADMIN" && auth.role !== "MANAGER") redirect("/");
  return <ApplicantWatchlistClient />;
}
