import MemberProfileClient from "./MemberProfileClient";
import { requirePageAuth } from "@/lib/auth";

type PageProps = {
  params: Promise<{
    memberId: string;
  }>;
};

export default async function MemberProfilePage(
  { params }: PageProps
) {
  await requirePageAuth();
  const { memberId } =
    await params;

  return (
    <MemberProfileClient
      memberId={memberId}
    />
  );
}