import { NextResponse } from "next/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRO3Job } from "@/lib/games/ro3/jobs";
import { RO3_NUMERIC_STATS, RO3_SPECIAL_DISH_SLOTS } from "@/lib/games/ro3/stats";

type Ctx={params:Promise<{memberId:string}>};
const keys=[...RO3_NUMERIC_STATS.map(s=>s.key),...RO3_SPECIAL_DISH_SLOTS.map(s=>s.key)];
function validate(payload:unknown){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return {error:"Stats payload is required."};
 const p=payload as Record<string,unknown>;const stats=p.stats;
 if(!stats||typeof stats!=="object"||Array.isArray(stats))return {error:"Stats object is required."};
 const s=stats as Record<string,unknown>;const normalized:Record<string,number>={};
 for(const k of keys){const v=s[k];if(typeof v!=="number"||!Number.isFinite(v))return {error:"Invalid value for "+k};normalized[k]=v;}
 for(const slot of RO3_SPECIAL_DISH_SLOTS){const v=normalized[slot.key];if(!Number.isInteger(v)||v<0||v>50)return {error:slot.key+" must be an integer from 0 to 50."};}
 if(p.job!==undefined&&!isRO3Job(p.job))return {error:"Invalid RO3 job."};
 return {value:{schemaVersion:1,job:p.job,stats:normalized,remarks:typeof p.remarks==="string"?p.remarks.trim()||null:null}};
}
export async function GET(_request:Request,ctx:Ctx){
 const auth=await getCurrentAuth();if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
 const {memberId}=await ctx.params;const member=await prisma.guildMember.findFirst({where:{id:memberId,guildId:auth.guild.id},select:{id:true,userId:true,discordUserId:true,job:true,characterName:true}});
 if(!member)return NextResponse.json({error:"Member not found."},{status:404});
 const own=member.userId===auth.user.id||member.discordUserId===auth.user.discordId;
 if(auth.role==="MEMBER"&&!own)return NextResponse.json({error:"Permission denied."},{status:403});
 const data=await prisma.guildMemberGameData.findUnique({where:{memberId}});
 return NextResponse.json({member,data:data?.payload??null,job:member.job,characterName:member.characterName});
}
export async function PUT(request:Request,ctx:Ctx){
 const auth=await getCurrentAuth();if(!auth)return NextResponse.json({error:"Authentication required."},{status:401});
 const {memberId}=await ctx.params;const member=await prisma.guildMember.findFirst({where:{id:memberId,guildId:auth.guild.id},select:{id:true,userId:true,discordUserId:true,job:true}});
 if(!member)return NextResponse.json({error:"Member not found."},{status:404});
 const own=member.userId===auth.user.id||member.discordUserId===auth.user.discordId;
 if(!hasPermission(auth.role,"members.edit")&&!(hasPermission(auth.role,"profile.editOwn")&&own))return NextResponse.json({error:"Permission denied."},{status:403});
 const body=await request.json();const valid=validate(body);if("error"in valid)return NextResponse.json(valid,{status:400});
 const job=body.job??member.job;if(!isRO3Job(job))return NextResponse.json({error:"Valid RO3 job is required."},{status:400});
 const payload={...valid.value,job};
 const result=await prisma.guildMemberGameData.upsert({where:{memberId},create:{memberId,gameType:"RO3",payload,schemaVersion:1},update:{gameType:"RO3",payload,schemaVersion:1}});
 if(body.job&&hasPermission(auth.role,"members.edit"))await prisma.guildMember.update({where:{id:memberId},data:{job}});
 return NextResponse.json({success:true,data:result.payload});
}
