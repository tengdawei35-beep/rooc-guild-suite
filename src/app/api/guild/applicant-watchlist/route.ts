import { NextResponse } from "next/server";
import { getCurrentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Colour = "GREEN" | "YELLOW" | "RED";
const COLOURS: Colour[] = ["GREEN", "YELLOW", "RED"];
const canManagePresets = (role: string) => role === "ADMIN" || role === "MANAGER";
const normalizeName = (value: string) => value.trim().toLocaleLowerCase();

async function authorize(requireManage = false) {
  const auth = await getCurrentAuth();
  if (!auth) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (!canManagePresets(auth.originalRole)) return { response: NextResponse.json({ error: "Only guild admins and managers can manage applicant watchlist presets." }, { status: 403 }) };
  if (requireManage && !auth.subscriptionActive) return { response: NextResponse.json({ error: "This guild is read-only until its subscription is renewed." }, { status: 403 }) };
  return { auth };
}

export async function GET() {
  const result = await authorize();
  if (result.response) return result.response;
  const entries = await prisma.guildApplicantWatchlistEntry.findMany({
    where: { guildId: result.auth.guild.id },
    orderBy: [{ watchlist: "asc" }, { characterName: "asc" }],
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const result = await authorize(true);
  if (result.response) return result.response;
  let body: { characterName?: string; watchlist?: Colour; notes?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const characterName = body.characterName?.trim() ?? "";
  if (!characterName || characterName.length > 80) return NextResponse.json({ error: "Enter an IGN between 1 and 80 characters." }, { status: 400 });
  if (!body.watchlist || !COLOURS.includes(body.watchlist)) return NextResponse.json({ error: "Choose a valid watchlist colour." }, { status: 400 });
  const notes = body.notes?.trim() || null;
  try {
    const entry = await prisma.guildApplicantWatchlistEntry.create({
      data: { guildId: result.auth.guild.id, characterName, normalizedCharacterName: normalizeName(characterName), watchlist: body.watchlist, notes },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "An IGN with that name is already on this guild's watchlist." }, { status: 409 });
    }
    console.error("[APPLICANT-WATCHLIST] Create failed:", error);
    return NextResponse.json({ error: "Failed to add the IGN." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const result = await authorize(true);
  if (result.response) return result.response;
  let body: { id?: string; characterName?: string; watchlist?: Colour; notes?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const characterName = body.characterName?.trim() ?? "";
  if (!body.id || !characterName || characterName.length > 80) return NextResponse.json({ error: "Entry ID and a valid IGN are required." }, { status: 400 });
  if (!body.watchlist || !COLOURS.includes(body.watchlist)) return NextResponse.json({ error: "Choose a valid watchlist colour." }, { status: 400 });
  try {
    const entry = await prisma.guildApplicantWatchlistEntry.update({
      where: { id: body.id, guildId: result.auth.guild.id },
      data: { characterName, normalizedCharacterName: normalizeName(characterName), watchlist: body.watchlist, notes: body.notes?.trim() || null },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "An IGN with that name is already on this guild's watchlist." }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Watchlist entry not found." }, { status: 404 });
    console.error("[APPLICANT-WATCHLIST] Update failed:", error);
    return NextResponse.json({ error: "Failed to update the IGN." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const result = await authorize(true);
  if (result.response) return result.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Entry ID is required." }, { status: 400 });
  const deleted = await prisma.guildApplicantWatchlistEntry.deleteMany({ where: { id, guildId: result.auth.guild.id } });
  if (!deleted.count) return NextResponse.json({ error: "Watchlist entry not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
