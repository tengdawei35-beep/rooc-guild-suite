import MemberProfileClient from "./MemberProfileClient";

import {
  hasPermission,
  requirePageAuth,
} from "@/lib/auth";

import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export default async function MemberProfilePage({
  params,
}: PageProps) {
  const auth =
    await requirePageAuth();

  if (
    !hasPermission(
      auth.role,
      "members.view"
    )
  ) {
    redirect("/guild/members");
  }

  const {
    memberId,
  } = await params;

  return (
    <MemberProfileClient
      memberId={memberId}
    />
  );
}