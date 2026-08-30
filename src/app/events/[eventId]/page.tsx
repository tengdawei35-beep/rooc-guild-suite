import { redirect } from "next/navigation";
import EventClient from "./EventClient";

import {
  hasPermission,
  requirePageAuth,
} from "@/lib/auth";

type PageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventPage({
  params,
}: PageProps) {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "events.view")) {
    redirect("/");
  }

  const { eventId } = await params;
  const canEditRosters = hasPermission(
    auth.role,
    "rosters.edit"
  );

  return (
    <EventClient
      eventId={eventId}
      currentUserId={auth.user.id}
      canManageEvents={hasPermission(
        auth.role,
        "events.manage"
      )}
      canEditRosters={canEditRosters}
    />
  );
}