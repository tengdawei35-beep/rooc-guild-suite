import { requirePageAuth } from "@/lib/auth";
import { getPlatformAdmin } from "@/lib/platform-admin";
import HelpWiki from "./HelpWiki";

export default async function HelpPage() {
  const auth = await requirePageAuth();
  const isPlatformAdmin = Boolean(await getPlatformAdmin());
  return <HelpWiki role={auth.role} isPlatformAdmin={isPlatformAdmin} />;
}
