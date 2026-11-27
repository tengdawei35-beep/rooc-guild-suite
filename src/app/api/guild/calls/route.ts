import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { announceNewCall, ensureCallTables, isValidCallRequirement, newId, refreshCallStatus } from "@/lib/call-to-arms";

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view calls." }, { status: 403 });
  try {
    await ensureCallTables();
    const url = new URL(request.url); const mine = url.searchParams.get("mine") === "true";
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    type CallListRow = { id: string; title: string; description: string | null; startAt: Date; status: string; creatorUserId: string; creatorUsername: string; requiredCount: number; activeCount: number; signedUp: boolean };
    const calls = await prisma.$queryRawUnsafe<CallListRow[]>(`SELECT c.id,c.title,c.description,c.start_at AS "startAt",c.status,c.creator_user_id AS "creatorUserId",u.username AS "creatorUsername",COALESCE((SELECT SUM(quantity)::integer FROM "guild_call_requirements" r WHERE r.call_id=c.id),0)::integer AS "requiredCount",COALESCE((SELECT COUNT(*)::integer FROM "guild_call_participants" p WHERE p.call_id=c.id AND p.status='ACTIVE'),0)::integer AS "activeCount",EXISTS(SELECT 1 FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id=p.member_id WHERE p.call_id=c.id AND (m."userId"=$2 OR ($3::text IS NOT NULL AND m."discordUserId"=$3))) AS "signedUp" FROM "guild_calls" c JOIN "User" u ON u.id=c.creator_user_id WHERE c.guild_id=$1 AND c.start_at > now() ${mine?`AND EXISTS(SELECT 1 FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id=p.member_id WHERE p.call_id=c.id AND (m."userId"=$2 OR ($3::text IS NOT NULL AND m."discordUserId"=$3)))`:``} ORDER BY c.start_at ASC`,auth.guild.id,auth.user.id,auth.user.discordId ?? null);
    return NextResponse.json({ calls, gameType: guild?.gameType === "RO3" ? "RO3" : "ROOC" });
  } catch (error) { console.error("[CALL TO ARMS] list failed",error); return NextResponse.json({ error:"Failed to load Call To Arms. Please try again."},{status:500}); }
}

export async function POST(request: Request) {
  const auth=await getCurrentAuth();
  if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
  if (!auth.subscriptionActive) return NextResponse.json({ error: "This guild is read-only until its subscription is renewed." }, { status: 403 }); if(!hasPermission(auth.role,"events.view"))return NextResponse.json({error:"You do not have permission to create calls."},{status:403});
  try {
    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) return NextResponse.json({ error: "Invalid call payload." }, { status: 400 });
    const body = rawBody as Record<string, unknown>;
    const title=String(body.title??"").trim(); const description=String(body.description??"").trim()||null; const startAt=new Date(String(body.startAt ?? "")); const requirements=Array.isArray(body.requirements)?body.requirements:[];
    if(!title||Number.isNaN(startAt.getTime()))return NextResponse.json({error:"Event name and a valid date/time are required."},{status:400});
    if(!requirements.length)return NextResponse.json({error:"Add at least one required job or role."},{status:400});
    const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
    const gameType = guild?.gameType === "RO3" ? "RO3" : "ROOC";
    if(requirements.some((raw: unknown) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
      const requirement = raw as Record<string, unknown>;
      const name = String(requirement.requirement ?? "").trim();
      const quantity = Number(requirement.quantity);
      return !name || !isValidCallRequirement(name, gameType) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50;
    }))return NextResponse.json({error:"Each requirement must be a valid job or role for this game and have a quantity between 1 and 50."},{status:400});
    await ensureCallTables();
    const webhookRows=await prisma.$queryRawUnsafe<Array<{webhook_url:string|null}>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id=$1 LIMIT 1`,auth.guild.id);
    const webhookUrl=webhookRows[0]?.webhook_url??null;
    const id=newId("call");
    await prisma.$executeRawUnsafe(`INSERT INTO "guild_calls" (id,guild_id,creator_user_id,title,description,start_at,discord_webhook_url) VALUES ($1,$2,$3,$4,$5,$6,$7)`,id,auth.guild.id,auth.user.id,title,description,startAt,webhookUrl);
    for(const requirement of requirements)await prisma.$executeRawUnsafe(`INSERT INTO "guild_call_requirements" (id,call_id,requirement,quantity) VALUES ($1,$2,$3,$4)`,newId("req"),id,String(requirement.requirement).trim(),Number(requirement.quantity));
    await refreshCallStatus(id);
    try { await announceNewCall(id,new URL(request.url).origin); } catch(error) { console.error("[CALL TO ARMS] creation announcement failed",error); }
    return NextResponse.json({id},{status:201});
  } catch(error) { console.error("[CALL TO ARMS] create failed",error); return NextResponse.json({error:"Failed to create Call To Arms."},{status:500}); }
}