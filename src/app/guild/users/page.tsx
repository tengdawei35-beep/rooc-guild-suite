import { redirect } from "next/navigation";

import UsersClient from "./UsersClient";

import {
  hasPermission,
  requirePageAuth,
} from "@/lib/auth";

export default async function UsersPage() {
  const auth =
    await requirePageAuth();

  if (
    !hasPermission(
      auth.role,
      "users.view"
    )
  ) {
    redirect("/");
  }

  return (
    <UsersClient />
  );
}