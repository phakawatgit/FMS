"use client";
import { useState } from 'react';
import { authClient, api } from '../../lib/client';
export default function Login() {
  const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[otp,setOtp]=useState(''),[resetToken,setResetToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const auth=await authClient();
      if(mode==='login') { await auth.login(email,password);location.href='/'; }
      else if(mode==='signup') { await auth.signup(email,password,name);location.href='/'; }
      else {
        const base=window.FMS_API_URL;
        const path=mode==='forgot'?'forgot-password':mode==='otp'?'verify-otp':'reset-password';
        const response=await fetch(`${base}/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp,password,resetToken})});
        const body=await response.json();if(!response.ok)throw Error(body.message);
        if(mode==='forgot'){setMode('otp');setMessage('?????????????????????');}
        else if(mode==='otp'){setResetToken(body.resetToken);setMode('reset');}
        else {setMode('login');setMessage('???????????????????');setPassword('');}
      }
    } catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="min-h-screen grid place-items-center p-6"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg"><h1 className="text-2xl font-bold text-cyan-900">FMS ? {({login:'???????????',signup:'???????????',forgot:'???????????',otp:'?????? OTP',reset:'????????????????'} as Record<string,string>)[mode]}</h1><form className="mt-6 grid gap-4" onSubmit={submit}>
    <label>?????<input className="block w-full rounded border p-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {mode==='signup'&&<label>????<input className="block w-full rounded border p-3" required value={name} onChange={e=>setName(e.target.value)}/></label>}
    {['login','signup','reset'].includes(mode)&&<label>????????<input className="block w-full rounded border p-3" type="password" minLength={6} required autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    {mode==='otp'&&<label>OTP<input className="block w-full rounded border p-3" required value={otp} onChange={e=>setOtp(e.target.value)}/></label>}
    <button className="rounded-xl bg-cyan-800 p-3 text-white" disabled={busy}>?????????</button></form>
    <p role="status" className="my-3 text-red-700">{message}</p><div className="flex flex-wrap gap-4 text-cyan-800">{['login','signup','forgot'].map(m=><button key={m} disabled={busy} onClick={()=>{setMode(m);setMessage('');}}>{({login:'???????????',signup:'???????????',forgot:'???????????'} as Record<string,string>)[m]}</button>)}<button disabled={busy} onClick={async()=>{setBusy(true);try{await(await authClient()).google();location.href='/';}catch(e){setMessage((e as Error).message);setBusy(false);}}}>Google</button></div></section></main>;
}
