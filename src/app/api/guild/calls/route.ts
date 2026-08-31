import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { announceNewCall, ensureCallTables, newId, refreshCallStatus } from "@/lib/call-to-arms";

export async function GET(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "events.view")) return NextResponse.json({ error: "You do not have permission to view calls." }, { status: 403 });
  try {
    await ensureCallTables();
    const url = new URL(request.url); const mine = url.searchParams.get("mine") === "true";
    const calls = await prisma.$queryRawUnsafe<any[]>(`SELECT c.id,c.title,c.description,c.start_at AS "startAt",c.status,c.creator_user_id AS "creatorUserId",u.username AS "creatorUsername",COALESCE((SELECT SUM(quantity)::integer FROM "guild_call_requirements" r WHERE r.call_id=c.id),0)::integer AS "requiredCount",COALESCE((SELECT COUNT(*)::integer FROM "guild_call_participants" p WHERE p.call_id=c.id AND p.status='ACTIVE'),0)::integer AS "activeCount",EXISTS(SELECT 1 FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id=p.member_id WHERE p.call_id=c.id AND m."userId"=$2) AS "signedUp" FROM "guild_calls" c JOIN "User" u ON u.id=c.creator_user_id WHERE c.guild_id=$1 ${mine?`AND EXISTS(SELECT 1 FROM "guild_call_participants" p JOIN "GuildMember" m ON m.id=p.member_id WHERE p.call_id=c.id AND m."userId"=$2)`:``} ORDER BY c.start_at ASC`,auth.guild.id,auth.user.id);
    return NextResponse.json({ calls });
  } catch (error) { console.error("[CALL TO ARMS] list failed",error); return NextResponse.json({ error:"Failed to load Call To Arms. Please try again."},{status:500}); }
}

export async function POST(request: Request) {
  const auth=await getCurrentAuth();
  if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!hasPermission(auth.role,"events.view"))return NextResponse.json({error:"You do not have permission to create calls."},{status:403});
  try {
    const body=await request.json(); const title=String(body.title??"").trim(); const description=String(body.description??"").trim()||null; const startAt=new Date(body.startAt); const requirements=Array.isArray(body.requirements)?body.requirements:[];
    if(!title||Number.isNaN(startAt.getTime()))return NextResponse.json({error:"Event name and a valid date/time are required."},{status:400});
    if(!requirements.length)return NextResponse.json({error:"Add at least one required job or role."},{status:400});
    if(requirements.some((r:any)=>!String(r.requirement??"").trim()||!Number.isInteger(Number(r.quantity))||Number(r.quantity)<1||Number(r.quantity)>50))return NextResponse.json({error:"Each requirement must have a valid quantity."},{status:400});
    await ensureCallTables(); const webhookRows=await prisma.$queryRawUnsafe<Array<{webhook_url:string}>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id=$1`,auth.guild.id); const id=newId("call");
    await prisma.$executeRawUnsafe(`INSERT INTO "guild_calls" (id,guild_id,creator_user_id,title,description,start_at,discord_webhook_url) VALUES ($1,$2,$3,$4,$5,$6,$7)`,id,auth.guild.id,auth.user.id,title,description,startAt,webhookRows[0]?.webhook_url??null);
    for(const requirement of requirements)await prisma.$executeRawUnsafe(`INSERT INTO "guild_call_requirements" (id,call_id,requirement,quantity) VALUES ($1,$2,$3,$4)`,newId("req"),id,String(requirement.requirement).trim(),Number(requirement.quantity));
    await refreshCallStatus(id);
    try { await announceNewCall(id); } catch(error) { console.error("[CALL TO ARMS] creation announcement failed",error); }
    return NextResponse.json({id},{status:201});
  } catch(error) { console.error("[CALL TO ARMS] create failed",error); return NextResponse.json({error:"Failed to create Call To Arms."},{status:500}); }
}
