import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield } from 'lucide-react'

export default function Login(){
  const [guardId,setGuardId]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const handleLogin = async (e:any) => {
    e.preventDefault()
    setError('')
    if(!guardId || !password) return setError('Enter Guard ID and Password')

    setLoading(true)
    try{
      const email = `${guardId.trim().toLowerCase()}@guards.ngao.local`
      console.log("Trying login as:", email)
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if(error) throw error
      
      console.log("Login success:", data.user.id)

    }catch(err:any){
      console.error(err)
      setError(err.message || 'Invalid Guard ID or Password')
      setLoading(false)
    }
  }

  return(
    <div style={{minHeight:'100vh', display:'grid', placeItems:'center', background:'#0f172a', padding:20}}>
      <form onSubmit={handleLogin} style={{background:'#fff', padding:'32px 28px', borderRadius:16, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
        
        {/* HIGHLY VISIBLE HEADER */}
        <div style={{display:'flex', gap:12, alignItems:'center', justifyContent:'center', marginBottom:8, background:'#0f172a', padding:'12px 16px', borderRadius:12}}>
          <div style={{background:'#fff', padding:6, borderRadius:8, display:'grid', placeItems:'center'}}>
            <Shield size={24} color="#0f172a" strokeWidth={2.5}/>
          </div>
          <span style={{fontWeight:900, fontSize:20, color:'#fff', letterSpacing:-0.5}}>NGAO SENTINEL</span>
        </div>

        <div style={{textAlign:'center', marginBottom:24, marginTop:18}}>
          <h1 style={{fontWeight:900, margin:0, fontSize:28, color:'#0f172a', letterSpacing:-1, lineHeight:1}}>GUARD PORTAL</h1>
          <div style={{height:4, background:'#16a34a', width:60, margin:'8px auto 0', borderRadius:99}}></div>
          <p style={{fontSize:13, color:'#334155', marginTop:10, fontWeight:700}}>Sign in with Guard ID</p>
        </div>

        {error && <div style={{background:'#fef2f2', color:'#dc2626', padding:10, borderRadius:8, fontSize:13, marginBottom:14, fontWeight:700, border:'1px solid #fecaca'}}>{error}</div>}

        <label style={{fontSize:11, fontWeight:900, letterSpacing:0.8, color:'#0f172a'}}>GUARD ID</label>
        <input value={guardId} onChange={e=>setGuardId(e.target.value)} placeholder="NG-0001" style={{width:'100%', padding:'14px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, marginBottom:16, fontWeight:800, fontSize:15, outline:'none'}}/>

        <label style={{fontSize:11, fontWeight:900, letterSpacing:0.8, color:'#0f172a'}}>PASSWORD</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{width:'100%', padding:'14px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, marginBottom:22, fontSize:15, outline:'none'}}/>

        <button disabled={loading} style={{width:'100%', background:'#0f172a', color:'#fff', padding:'15px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer', fontSize:16, letterSpacing:0.5}}>
          {loading? 'SIGNING IN...' : 'Sign In'}
        </button>

        <div style={{textAlign:'center', marginTop:14, fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:1}}>SECURE • NGAO GUARD SYSTEM</div>
      </form>
    </div>
  )
}