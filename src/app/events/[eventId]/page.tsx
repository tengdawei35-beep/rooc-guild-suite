import EventClient from "./EventClient";
import { requirePageAuth } from "@/lib/auth";
type PageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EventPage({
  params,
}: PageProps) {
  await requirePageAuth();
  const { eventId } = await params;

  return (
    <EventClient eventId={eventId} />
  );
}