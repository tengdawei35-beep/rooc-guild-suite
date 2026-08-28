import { redirect } from "next/navigation";

import UsersClient from "./UsersClient";
import { requirePageAuth } from "@/lib/auth";

export default async function UsersPage() {
  const auth =
    await requirePageAuth();

  if (
    auth.role !== "LEADER" &&
    auth.role !== "OFFICER"
  ) {
    redirect("/");
  }

  return <UsersClient />;
}