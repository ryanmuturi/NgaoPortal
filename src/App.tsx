import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import GuardDashboard from './pages/GuardDashboard'
export default function App(){
  const [session,setSession]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>l.subscription.unsubscribe()
  },[])
  if(loading) return <div style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>Loading secure portal...</div>
  if(!session) return <Login/>
  return <GuardDashboard session={session}/>
}