"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, authClient, Account } from '../lib/client';
const modules=[['dashboard','Dashboard ?????????'],['infirmary-visit','???????????'],['stock','??????'],['catalog','??????????????????????'],['borrow-return','???????'],['duty-shift','????????'],['activity','???????????????'],['settings','???????????????']];
export default function Home(){
 const [user,setUser]=useState<Account|null>(null),[duties,setDuties]=useState<any[]>([]),[message,setMessage]=useState('??????????');
 useEffect(()=>{(async()=>{const auth=await authClient();const me=await auth.me();if(!me){location.replace('/login');return;}setUser(me);setDuties(await api('duties'));setMessage('');})().catch(e=>setMessage(e.message));},[]);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main className="mx-auto max-w-7xl space-y-8 p-8"><header className="flex flex-wrap justify-between gap-4"><h1 className="text-3xl font-bold text-cyan-900">FMS ? ??????????????????</h1>{user&&<button onClick={async()=>{await(await authClient()).logout();location.href='/login';}}>??????????</button>}</header><p role="status">{message}</p>{user&&<><p>{user.name} ? {user.role}</p><section className="rounded-2xl bg-white p-6 shadow"><h2 className="text-xl font-semibold">????????? ? {today}</h2>{duties.filter(d=>d.date===today).map(d=><p key={d.id}>{d.nurseName} ? {d.affiliation} ? {d.colorId}</p>)}{!duties.some(d=>d.date===today)&&<p>??????????????????????????</p>}<Link className="text-cyan-800" href="/modules/duty-shift">?????? / ??????????</Link></section><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{modules.filter(([slug])=>slug!=='settings'||user.role==='ADMIN').map(([slug,title])=><Link key={slug} className="rounded-2xl bg-white p-7 text-lg font-semibold text-cyan-900 shadow hover:bg-cyan-50" href={'/modules/'+slug}>{title}</Link>)}</section><Link href="/legacy/menu.html">???????????? Legacy</Link></>}</main>;
}
