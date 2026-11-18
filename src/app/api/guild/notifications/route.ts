import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { getNotificationConfig, isDiscordWebhookUrl, saveNotificationConfig } from "@/lib/discord-notifications";

type NotificationType = "roster" | "bid" | "stats" | "calls";

async function ensureCallWebhookTable() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "guild_call_webhooks" ("guild_id" text PRIMARY KEY,"webhook_url" text NOT NULL,"updated_at" timestamptz NOT NULL DEFAULT now())`);
  return prisma;
}

async function getCallWebhook(guildId:string) {
  const prisma=await ensureCallWebhookTable();
  const rows=await prisma.$queryRawUnsafe<Array<{webhook_url:string}>>(`SELECT webhook_url FROM "guild_call_webhooks" WHERE guild_id=$1`,guildId);
  return rows[0]?.webhook_url ?? null;
}

export async function GET(){
  const auth=await getCurrentAuth();
  if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!hasPermission(auth.role,"guild.manage"))return NextResponse.json({error:"You do not have permission to manage guild settings."},{status:403});
  const config=await getNotificationConfig(auth.guild.id);
  return NextResponse.json({configured:{roster:!!config?.rosterWebhookUrl,bid:!!config?.bidWebhookUrl,stats:!!config?.statsWebhookUrl,calls:!!await getCallWebhook(auth.guild.id)}});
}

export async function PUT(request:Request){
  const auth=await getCurrentAuth();
  if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!hasPermission(auth.role,"guild.manage"))return NextResponse.json({error:"You do not have permission to manage guild settings."},{status:403});
  try{
    const body=await request.json() as Record<string,unknown>;
    const normalise=(value:unknown,key:string)=>{if(typeof value!=="string"||!value.trim())return null;const normalized=value.trim();if(!isDiscordWebhookUrl(normalized))throw new Error(`Invalid Discord webhook URL for ${key}.`);return normalized;};
    const calls=normalise(body.callsWebhookUrl,"callsWebhookUrl");
    const values:{rosterWebhookUrl?:string|null;bidWebhookUrl?:string|null;statsWebhookUrl?:string|null}={};
    if(body.clearRoster===true)values.rosterWebhookUrl=null;else if(body.rosterWebhookUrl)values.rosterWebhookUrl=normalise(body.rosterWebhookUrl,"rosterWebhookUrl");
    if(body.clearBid===true)values.bidWebhookUrl=null;else if(body.bidWebhookUrl)values.bidWebhookUrl=normalise(body.bidWebhookUrl,"bidWebhookUrl");
    if(body.clearStats===true)values.statsWebhookUrl=null;else if(body.statsWebhookUrl)values.statsWebhookUrl=normalise(body.statsWebhookUrl,"statsWebhookUrl");
    await saveNotificationConfig(auth.guild.id,values);
    const prisma=await ensureCallWebhookTable();
    if(body.clearCalls===true)await prisma.$executeRawUnsafe(`DELETE FROM "guild_call_webhooks" WHERE guild_id=$1`,auth.guild.id);
    else if(calls)await prisma.$executeRawUnsafe(`INSERT INTO "guild_call_webhooks" (guild_id,webhook_url,updated_at) VALUES ($1,$2,now()) ON CONFLICT (guild_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url,updated_at=now()`,auth.guild.id,calls);
    return NextResponse.json({success:true});
  }catch(error){console.error("[DISCORD] Failed to save notification settings:",error);return NextResponse.json({error:error instanceof Error?error.message:"Failed to save notification settings."},{status:500});}
}

export async function POST(request:Request){
  const auth=await getCurrentAuth();
  if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!hasPermission(auth.role,"guild.manage"))return NextResponse.json({error:"You do not have permission to manage guild settings."},{status:403});
  const body=await request.json() as {type?:NotificationType};
  const type=body.type;
  if(!type)return NextResponse.json({error:"Notification type is required."},{status:400});
  const config=await getNotificationConfig(auth.guild.id);
  const configured=type==="roster"?config?.rosterWebhookUrl:type==="bid"?config?.bidWebhookUrl:type==="stats"?config?.statsWebhookUrl:await getCallWebhook(auth.guild.id);
  if(!configured)return NextResponse.json({error:"That notification channel is not configured."},{status:400});
  try{const response=await fetch(configured,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:`✅ HMDL ${type} notification test`,allowed_mentions:{parse:[]}})});if(!response.ok)throw new Error(`Discord returned ${response.status}`);return NextResponse.json({success:true});}catch(error){console.error("[DISCORD] Test notification failed:",error);return NextResponse.json({error:"Discord rejected the test notification."},{status:502});}
}
