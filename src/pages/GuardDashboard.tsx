import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, LogOut, MapPin, Clock, AlertTriangle, X, Send } from 'lucide-react'

export default function GuardDashboard(_props:{session:any}){
  const [guard,setGuard]=useState<any>(null)
  const [assignedSite,setAssignedSite]=useState<any>(null)
  const [activeLog,setActiveLog]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [loadingGuard,setLoadingGuard]=useState(true)
  const [loadingAction,setLoadingAction]=useState(false)
  const [error,setError]=useState('')
  const [loc,setLoc]=useState<any>(null)

  // Incident state
  const [showReport,setShowReport]=useState(false)
  const [incidentType,setIncidentType]=useState('Unauthorized Access')
  const [incidentSeverity,setIncidentSeverity]=useState('High')
  const [incidentDesc,setIncidentDesc]=useState('')
  const [reporting,setReporting]=useState(false)

  useEffect(()=>{
    (async()=>{
      try{
        const { data: { user } } = await supabase.auth.getUser()
        if(!user) throw new Error("No auth user")
        const { data: guardData, error } = await supabase.from('guards').select('*').eq('auth_user_id', user.id).maybeSingle()
        if(error) throw error
        if(!guardData) throw new Error(`No guard row for auth_user_id ${user.id}`)
        setGuard(guardData)
        if(guardData.site_id){
          const { data: siteData } = await supabase.from('sites').select('*').eq('id', guardData.site_id).maybeSingle()
          setAssignedSite(siteData)
        }
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('guard_id', guardData.guard_id).order('check_in',{ascending:false}).limit(20)
        if(logs){ setHistory(logs); setActiveLog(logs.find((d:any)=>!d.check_out) || null) }
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}), ()=>{}, {enableHighAccuracy:true})
        }
      }catch(e:any){ setError(e.message) } finally{ setLoadingGuard(false) }
    })()
  },[])

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); location.reload() }

  const checkIn = async () => {
    if(!guard?.site_id) return alert('⚠️ No site assigned yet.')
    setLoadingAction(true)
    try{
      const { data, error } = await supabase.from('attendance_logs').insert({
        site_id: guard.site_id, guard_name: guard.name, guard_id: guard.guard_id,
        check_in: new Date().toISOString(), status: 'on_duty'
      }).select('*').single()
      if(error) throw error; setActiveLog(data); setHistory(prev=>[data,...prev])
    }catch(e:any){ alert('Check-in failed: ' + e.message) } finally{ setLoadingAction(false) }
  }

  const checkOut = async () => {
    if(!activeLog) return
    setLoadingAction(true)
    try{
      const { error } = await supabase.from('attendance_logs').update({ check_out: new Date().toISOString(), status:'off_duty' }).eq('id', activeLog.id)
      if(error) throw error; setActiveLog(null)
      const { data } = await supabase.from('attendance_logs').select('*').eq('guard_id', guard.guard_id).order('check_in',{ascending:false}).limit(20)
      if(data) setHistory(data)
    }catch(e:any){ alert(e.message) } finally{ setLoadingAction(false) }
  }

  const submitIncident = async () => {
    if(!incidentDesc.trim()) return alert('Please describe the incident')
    if(!guard?.site_id) return alert('No site assigned')
    setReporting(true)
    try{
      // EXACT columns from your screenshots
      const { error } = await supabase.from('incident_logs').insert({
        site_id: guard.site_id,
        incident_type: incidentType,
        description: `Guard: ${guard.guard_id} - ${guard.name} | Location: ${loc ? `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}` : 'No GPS'} | Details: ${incidentDesc}`,
        severity: incidentSeverity,
        status: 'Open',
        image_url: null,
        video_url: null
      })
      if(error) throw error
      alert('✅ Incident Reported! Saved to incident_logs')
      setShowReport(false)
      setIncidentDesc('')
    }catch(e:any){ alert('Report failed: ' + e.message + '\n\nRun: ALTER TABLE incident_logs DISABLE ROW LEVEL SECURITY;') } finally{ setReporting(false) }
  }

  if(loadingGuard) return <div style={{display:'grid',placeItems:'center',minHeight:'100vh', background:'#0f172a', color:'#fff', fontWeight:900}}>Loading guard profile...</div>
  if(error) return (<div style={{display:'grid',placeItems:'center',minHeight:'100vh', padding:20, background:'#f1f5f9'}}><div style={{background:'#fff', padding:24, borderRadius:12, maxWidth:500}}><h3 style={{color:'#dc2626', margin:0}}>Error: {error}</h3><button onClick={handleLogout} style={{marginTop:16, width:'100%', background:'#0f172a', color:'#fff', padding:'12px', borderRadius:8, border:0, fontWeight:800, cursor:'pointer'}}>Logout & Try Again</button></div></div>)

  return(
    <div style={{background:'#f1f5f9', minHeight:'100vh'}}>
      <div style={{background:'#0f172a', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <div style={{background:'#fff', padding:6, borderRadius:8}}><Shield size={18} color="#0f172a" strokeWidth={2.5}/></div>
          <div><div style={{fontWeight:900, color:'#fff', fontSize:14}}>NGAO SENTINEL</div><div style={{fontWeight:800, color:'#22c55e', fontSize:10, letterSpacing:1}}>GUARD PORTAL • {guard.guard_id}</div></div>
        </div>
        <button onClick={handleLogout} style={{background:'#ef4444', color:'#fff', border:0, padding:'8px 14px', borderRadius:8, fontWeight:800, display:'flex', gap:6, alignItems:'center', cursor:'pointer', fontSize:12}}><LogOut size={14}/> Logout</button>
      </div>

      <div style={{padding:20, maxWidth:600, margin:'0 auto'}}>
        <div style={{background:'#fff', borderRadius:16, padding:'20px', border:'2px solid #0f172a'}}>
          <h1 style={{fontSize:26, fontWeight:900, color:'#0f172a', margin:0}}>Welcome,</h1>
          <h1 style={{fontSize:26, fontWeight:900, color:'#16a34a', margin:'2px 0 0'}}>{guard.name?.toUpperCase()}</h1>
          <div style={{display:'flex', gap:8, marginTop:10}}>
            <span style={{background:'#0f172a', color:'#fff', fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:99}}>ID: {guard.guard_id}</span>
            <span style={{background:'#dcfce7', color:'#16a34a', fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:99}}>{guard.status?.toUpperCase()}</span>
          </div>
        </div>

        <div style={{background: assignedSite ? '#0f172a' : '#fff', borderRadius:16, padding:18, marginTop:16, border:'2px solid #0f172a'}}>
          <div style={{fontSize:11, fontWeight:900, color: assignedSite ? '#94a3b8' : '#dc2626', letterSpacing:1}}>📍 ASSIGNED SITE</div>
          {assignedSite ? (<><div style={{fontSize:22, fontWeight:900, color:'#fff', marginTop:6}}>{assignedSite.name}</div><div style={{marginTop:6, display:'flex', gap:8}}><span style={{background: activeLog ? '#22c55e' : '#475569', color:'#fff', padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:900}}>● {activeLog? 'ON DUTY' : 'OFF DUTY'}</span></div></>) : (<div style={{fontSize:18, fontWeight:900, color:'#dc2626', marginTop:6}}>⚠️ No site assigned</div>)}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div style={{background:'#fff', borderRadius:16, padding:18, border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11, fontWeight:900, display:'flex', gap:6, alignItems:'center'}}><Clock size={14}/> ATTENDANCE</div>
            <div style={{fontSize:22, fontWeight:900, marginTop:12}}>{activeLog? new Date(activeLog.check_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</div>
            {activeLog? (<button onClick={checkOut} disabled={loadingAction} style={{marginTop:14, background:'#ef4444', color:'#fff', width:'100%', padding:'13px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer'}}>{loadingAction?'ENDING...':'CHECK OUT'}</button>) : (<button onClick={checkIn} disabled={loadingAction || !guard.site_id} style={{marginTop:14, background: guard.site_id ? '#16a34a' : '#cbd5e1', color:'#fff', width:'100%', padding:'13px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer'}}>{!guard.site_id ? 'NO SITE' : 'CHECK IN'}</button>)}
            {loc && <div style={{fontSize:10, marginTop:8, color:'#64748b', display:'flex', gap:4, alignItems:'center'}}><MapPin size={10}/> {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>}
          </div>
          <div style={{background:'#fff', borderRadius:16, padding:18, border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11, fontWeight:900}}>📍 MY SITE</div>
            <div style={{marginTop:14, fontWeight:900, fontSize:16}}>{assignedSite?.name || 'No site'}</div>
            <button onClick={()=>setShowReport(true)} style={{marginTop:16, background:'#f59e0b', color:'#fff', width:'100%', padding:'12px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer', display:'flex', gap:6, justifyContent:'center', alignItems:'center', boxShadow:'0 4px 10px rgba(245,158,11,0.4)'}}><AlertTriangle size={16}/> REPORT INCIDENT</button>
            <div style={{marginTop:10, fontSize:10, color:'#64748b', fontWeight:700, textAlign:'center'}}>Tap to report to incident_logs</div>
          </div>
        </div>

        <div style={{marginTop:16, background:'#fff', borderRadius:16, padding:16, border:'1px solid #e2e8f0'}}>
          <div style={{fontWeight:900, borderBottom:'3px solid #0f172a', paddingBottom:8, fontSize:13, display:'flex', justifyContent:'space-between'}}><span>TODAY'S ACTIVITY</span><span style={{color:'#16a34a', fontSize:11}}>{history.length} LOGS</span></div>
          {history.length === 0 ? <div style={{fontSize:13, color:'#94a3b8', padding:'16px 0', textAlign:'center'}}>No activity yet</div> : history.slice(0,5).map((h:any)=>(<div key={h.id} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f1f5f9', fontSize:13}}><span style={{fontWeight:700}}>{h.check_out?'✓ Checked out':'✓ Checked in'} • {h.guard_id}</span><span style={{fontWeight:800}}>{new Date(h.check_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>))}
        </div>
      </div>

      {showReport && (
        <div style={{position:'fixed', inset:0, background:'rgba(15,23,42,0.85)', display:'grid', placeItems:'center', zIndex:100, padding:20}}>
          <div style={{background:'#fff', width:'100%', maxWidth:420, borderRadius:16, padding:20, border:'2px solid #0f172a'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{margin:0, fontWeight:900, display:'flex', gap:8, alignItems:'center'}}><AlertTriangle size={18} color="#f59e0b"/> Report Incident</h3>
              <button onClick={()=>setShowReport(false)} style={{background:'#f1f5f9', border:0, borderRadius:8, padding:6, cursor:'pointer'}}><X size={16}/></button>
            </div>
            <label style={{fontSize:11, fontWeight:900}}>INCIDENT TYPE</label>
            <select value={incidentType} onChange={e=>setIncidentType(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, marginBottom:12, fontWeight:700}}>
              <option>Unauthorized Access</option>
              <option>Theft</option>
              <option>Vandalism</option>
              <option>Fight</option>
              <option>Suspicious Activity</option>
              <option>Fire</option>
              <option>Medical Emergency</option>
              <option>Other</option>
            </select>
            <label style={{fontSize:11, fontWeight:900}}>SEVERITY</label>
            <div style={{display:'flex', gap:8, marginTop:6, marginBottom:12}}>
              {['Low','Medium','High'].map(s=>(<button key={s} onClick={()=>setIncidentSeverity(s)} style={{flex:1, padding:'10px', borderRadius:10, border: incidentSeverity===s ? '2px solid #0f172a' : '2px solid #e2e8f0', background: incidentSeverity===s ? (s==='High'?'#ef4444': s==='Medium'?'#f59e0b':'#22c55e') : '#fff', color: incidentSeverity===s ? '#fff' : '#64748b', fontWeight:900, fontSize:12, cursor:'pointer'}}>{s}</button>))}
            </div>
            <label style={{fontSize:11, fontWeight:900}}>DESCRIPTION</label>
            <textarea value={incidentDesc} onChange={e=>setIncidentDesc(e.target.value)} placeholder="What happened? Where? Who was involved?" style={{width:'100%', padding:'12px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, minHeight:90, fontSize:13}}/>
            {loc && <div style={{fontSize:11, color:'#64748b', marginTop:8}}><MapPin size={12}/> {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} • {assignedSite?.name}</div>}
            <button onClick={submitIncident} disabled={reporting} style={{marginTop:16, width:'100%', background:'#0f172a', color:'#fff', padding:'14px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer', display:'flex', gap:8, justifyContent:'center', alignItems:'center'}}>{reporting ? 'SENDING...' : <><Send size={14}/> SUBMIT TO incident_logs</>}</button>
          </div>
        </div>
      )}
    </div>
  )
}