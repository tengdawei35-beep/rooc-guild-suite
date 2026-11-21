import { redirect } from "next/navigation";
import EventClient from "./EventClient";
import FinalRosterControls from "./FinalRosterControls";
import Ro3EventResourceLink from "./Ro3EventResourceLink";

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
    <>
      {hasPermission(auth.role, "events.manage") && (
        <Ro3EventResourceLink eventId={eventId} />
      )}
      {canEditRosters && (
        <FinalRosterControls eventId={eventId} />
      )}
      <EventClient
        eventId={eventId}
        currentUserId={auth.user.id}
        canManageEvents={hasPermission(
          auth.role,
          "events.manage"
        )}
        canEditRosters={canEditRosters}
      />
    </>
  );
}
