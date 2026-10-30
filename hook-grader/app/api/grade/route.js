import { validateSubmission } from '../../../lib/rules.mjs';
import { processSubmission } from '../../../lib/server.mjs';
export const runtime='nodejs';
export const maxDuration=120;
export const dynamic='force-dynamic';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request){
  try{
    const origin=request.headers.get('origin');
    if(origin){
      let source;try{source=new URL(origin);}catch{return json({error:'Submit this form from the tool page.'},403);}
      if(!['http:','https:'].includes(source.protocol)||source.host!==request.headers.get('host'))return json({error:'Submit this form from the tool page.'},403);
    }
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Expected a JSON submission.'},415);
    const reader=request.body?.getReader();if(!reader)return json({error:'The submission is empty.'},400);
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return json({error:'The submission is too large.'},413);}chunks.push(Buffer.from(value));}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json({error:'The submission is invalid.'},400);}
    const input=validateSubmission(body);
    const ip=process.env.VERCEL?request.headers.get('x-real-ip')||'unknown':'local';
    const result=await processSubmission(input,{ip});
    return json(result,result.status==='pending'?202:200);
  }catch(error){return json({error:error.status?error.message:'The tool is temporarily unavailable. Please try again.'},error.status||503);}
}
