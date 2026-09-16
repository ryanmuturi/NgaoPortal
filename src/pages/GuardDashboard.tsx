import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, LogOut, MapPin, Clock, AlertTriangle, X, Send, Image as ImageIcon, Timer } from 'lucide-react'

export default function GuardDashboard(){
  const [guard,setGuard]=useState<any>(null)
  const [assignedSite,setAssignedSite]=useState<any>(null)
  const [activeLog,setActiveLog]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])
  const [loadingGuard,setLoadingGuard]=useState(true)
  const [loadingAction,setLoadingAction]=useState(false)
  const [error,setError]=useState('')
  const [loc,setLoc]=useState<any>(null)

  const [showReport,setShowReport]=useState(false)
  const [incidentType,setIncidentType]=useState('Unauthorized Access')
  const [incidentSeverity,setIncidentSeverity]=useState('High')
  const [incidentDesc,setIncidentDesc]=useState('')
  const [reporting,setReporting]=useState(false)
  const [incidentFile,setIncidentFile]=useState<File | null>(null)
  const [previewUrl,setPreviewUrl]=useState('')

  const formatKenyaTime = (iso: string) => {
    if(!iso) return '--:--'
    return new Date(iso).toLocaleTimeString('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
  const formatKenyaDate = (iso: string) => {
    if(!iso) return ''
    return new Date(iso).toLocaleDateString('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getTime = (log:any) => log.check_in_time || log.check_in || log.created_at
  const getOutTime = (log:any) => log.check_out_time || log.check_out

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
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('guard_id', guardData.guard_id).order('check_in_time',{ascending:false}).limit(20)
        if(logs && logs.length > 0){ 
          setHistory(logs); 
          setActiveLog(logs.find((d:any)=> !getOutTime(d)) || null) 
        } else {
          const { data: logs2 } = await supabase.from('attendance_logs').select('*').eq('guard_id', guardData.guard_id).order('created_at',{ascending:false}).limit(20)
          if(logs2){ setHistory(logs2); setActiveLog(logs2.find((d:any)=> !getOutTime(d)) || null) }
        }
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}), ()=>{}, {enableHighAccuracy:true})
        }
      }catch(e:any){ setError(e.message) } finally{ setLoadingGuard(false) }
    })()
  },[])

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); location.reload() }

  // FIXED: Writes to ALL possible column names
  const checkIn = async () => {
    if(!guard?.site_id) return alert('⚠️ No site assigned yet.')
    setLoadingAction(true)
    try{
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('attendance_logs').insert({
        site_id: guard.site_id, 
        guard_name: guard.name, 
        guard_id: guard.guard_id,
        status: 'on_duty',
        check_in: now,
        check_in_time: now,
        created_at: now,
        lat: loc?.lat || null,
        lng: loc?.lng || null,
        check_out: null,
        check_out_time: null
      }).select('*').single()
      if(error) throw error; 
      setActiveLog(data); 
      setHistory(prev=>[data,...prev])
    }catch(e:any){ alert('Check-in failed: ' + e.message) } finally{ setLoadingAction(false) }
  }

  // FIXED: Writes to BOTH check_out and check_out_time so never NULL
  const checkOut = async () => {
    if(!activeLog) return
    setLoadingAction(true)
    try{
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('attendance_logs').update({ 
        check_out: now,
        check_out_time: now, 
        status:'off_duty' 
      }).eq('id', activeLog.id).select().single()
      
      if(error) throw error
      
      setActiveLog(null)
      const { data: logs } = await supabase.from('attendance_logs').select('*').eq('guard_id', guard.guard_id).order('check_in_time',{ascending:false}).limit(20)
      if(logs && logs.length > 0) setHistory(logs)
      else {
        const { data: logs2 } = await supabase.from('attendance_logs').select('*').eq('guard_id', guard.guard_id).order('created_at',{ascending:false}).limit(20)
        if(logs2) setHistory(logs2)
      }
    }catch(e:any){ alert('Checkout failed: ' + e.message) } finally{ setLoadingAction(false) }
  }

  const handleFileChange = (e:any) => {
    const file = e.target.files?.[0]
    if(!file) return
    if(file.size > 50*1024*1024) return alert('File too big, max 50MB')
    setIncidentFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const submitIncident = async () => {
    if(!activeLog) return alert('⛔ You MUST Check-In first (ON DUTY) before reporting incidents!')
    if(!incidentDesc.trim()) return alert('Please describe the incident')
    if(!guard?.site_id) return alert('No site assigned')
    setReporting(true)
    try{
      let image_url = null
      let video_url = null
      if(incidentFile){
        const ext = incidentFile.name.split('.').pop()
        const fileName = `${guard.guard_id}_${Date.now()}.${ext}`
        const isVideo = incidentFile.type.startsWith('video')
        const { error: uploadError } = await supabase.storage.from('incident_media').upload(fileName, incidentFile)
        if(uploadError) throw new Error('Bucket incident_media not found. Create it in Supabase Storage! ' + uploadError.message)
        const { data: publicData } = supabase.storage.from('incident_media').getPublicUrl(fileName)
        if(isVideo) video_url = publicData.publicUrl
        else image_url = publicData.publicUrl
      }
      const { error } = await supabase.from('incident_logs').insert({
        site_id: guard.site_id,
        incident_type: incidentType,
        description: `Guard: ${guard.guard_id} - ${guard.name} | Location: ${loc ? `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}` : 'No GPS'} | Time: ${new Date().toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})} | Details: ${incidentDesc}`,
        severity: incidentSeverity,
        status: 'Open',
        image_url: image_url,
        video_url: video_url
      })
      if(error) throw error
      alert('✅ Incident Reported!')
      setShowReport(false)
      setIncidentDesc('')
      setIncidentFile(null)
      setPreviewUrl('')
    }catch(e:any){ alert('Report failed: ' + e.message) } finally{ setReporting(false) }
  }

  const getDuration = () => {
    if(!activeLog) return null
    const start = new Date(getTime(activeLog)).getTime()
    const now = new Date().getTime()
    const diff = Math.floor((now - start)/1000/60)
    const h = Math.floor(diff/60)
    const m = diff%60
    return `${h}h ${m}m on duty`
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
          {assignedSite ? (<><div style={{fontSize:22, fontWeight:900, color:'#fff', marginTop:6}}>{assignedSite.name}</div><div style={{marginTop:6, display:'flex', gap:8, alignItems:'center'}}><span style={{background: activeLog ? '#22c55e' : '#475569', color:'#fff', padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:900}}>● {activeLog? 'ON DUTY' : 'OFF DUTY'}</span>{activeLog && <span style={{color:'#22c55e', fontSize:11, fontWeight:800, display:'flex', gap:4, alignItems:'center'}}><Timer size={12}/>{getDuration()}</span>}</div></>) : (<div style={{fontSize:18, fontWeight:900, color:'#dc2626', marginTop:6}}>⚠️ No site assigned</div>)}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:16}}>
          <div style={{background:'#fff', borderRadius:16, padding:18, border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:11, fontWeight:900, display:'flex', gap:6, alignItems:'center'}}><Clock size={14}/> ATTENDANCE (EAT)</div>
            <div style={{fontSize:22, fontWeight:900, marginTop:12}}>{activeLog? formatKenyaTime(getTime(activeLog)) : '--:--'}</div>
            <div style={{fontSize:10, color:'#64748b', fontWeight:700}}>{activeLog? formatKenyaDate(getTime(activeLog)) : 'Not checked in'}</div>
            {activeLog? (<button onClick={checkOut} disabled={loadingAction} style={{marginTop:14, background:'#ef4444', color:'#fff', width:'100%', padding:'13px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer'}}>{loadingAction?'ENDING...':'CHECK OUT'}</button>) : (<button onClick={checkIn} disabled={loadingAction || !guard.site_id} style={{marginTop:14, background: guard.site_id ? '#16a34a' : '#cbd5e1', color:'#fff', width:'100%', padding:'13px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer'}}>{!guard.site_id ? 'NO SITE' : 'CHECK IN'}</button>)}
            {loc && <div style={{fontSize:10, marginTop:8, color:'#64748b', display:'flex', gap:4, alignItems:'center'}}><MapPin size={10}/> {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>}
          </div>
          <div style={{background:'#fff', borderRadius:16, padding:18, border:'1px solid #e2e8f0', opacity: activeLog ? 1 : 0.6}}>
            <div style={{fontSize:11, fontWeight:900}}>📍 MY SITE</div>
            <div style={{marginTop:14, fontWeight:900, fontSize:16}}>{assignedSite?.name || 'No site'}</div>
            <button onClick={()=> activeLog ? setShowReport(true) : alert('⛔ You must CHECK IN first to report incidents!')} style={{marginTop:16, background: activeLog ? '#f59e0b' : '#94a3b8', color:'#fff', width:'100%', padding:'12px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer', display:'flex', gap:6, justifyContent:'center', alignItems:'center', boxShadow: activeLog ? '0 4px 10px rgba(245,158,11,0.4)' : 'none'}}><AlertTriangle size={16}/> REPORT INCIDENT</button>
            <div style={{marginTop:10, fontSize:10, color: activeLog ? '#16a34a' : '#ef4444', fontWeight:800, textAlign:'center'}}>{activeLog ? '● Ready to report' : '🔒 Check-in required'}</div>
          </div>
        </div>

        {/* FIXED: Shows CHECK-IN time logically, even if 0 min */}
        <div style={{marginTop:16, background:'#fff', borderRadius:16, padding:16, border:'1px solid #e2e8f0'}}>
          <div style={{fontWeight:900, borderBottom:'3px solid #0f172a', paddingBottom:8, fontSize:13, display:'flex', justifyContent:'space-between'}}><span>TODAY'S ACTIVITY</span><span style={{color:'#16a34a', fontSize:11}}>{history.length} LOGS</span></div>
          {history.length === 0 ? <div style={{fontSize:13, color:'#94a3b8', padding:'16px 0', textAlign:'center'}}>No activity yet</div> : history.slice(0,5).map((h:any)=>{
            const out = getOutTime(h)
            const inn = getTime(h)
            const durationMin = out ? Math.max(0, Math.round((new Date(out).getTime()-new Date(inn).getTime())/1000/60)) : 0
            return (
              <div key={h.id} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f1f5f9', fontSize:13}}>
                <span style={{fontWeight:700}}>{out?'✓ Checked out':'✓ Checked in'} • {h.guard_id} {out && `(${durationMin} min)`}</span>
                <span style={{fontWeight:800}}>{formatKenyaTime(inn)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {showReport && (
        <div style={{position:'fixed', inset:0, background:'rgba(15,23,42,0.85)', display:'grid', placeItems:'center', zIndex:100, padding:20}}>
          <div style={{background:'#fff', width:'100%', maxWidth:420, borderRadius:16, padding:20, border:'2px solid #0f172a', maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{margin:0, fontWeight:900, display:'flex', gap:8, alignItems:'center'}}><AlertTriangle size={18} color="#f59e0b"/> Report Incident</h3>
              <button onClick={()=>{setShowReport(false); setIncidentFile(null); setPreviewUrl('')}} style={{background:'#f1f5f9', border:0, borderRadius:8, padding:6, cursor:'pointer'}}><X size={16}/></button>
            </div>
            <label style={{fontSize:11, fontWeight:900}}>INCIDENT TYPE</label>
            <select value={incidentType} onChange={e=>setIncidentType(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, marginBottom:12, fontWeight:700}}>
              <option>Unauthorized Access</option><option>Theft</option><option>Vandalism</option><option>Fight</option><option>Suspicious Activity</option><option>Fire</option><option>Medical Emergency</option><option>Other</option>
            </select>
            <label style={{fontSize:11, fontWeight:900}}>SEVERITY</label>
            <div style={{display:'flex', gap:8, marginTop:6, marginBottom:12}}>
              {['Low','Medium','High'].map(s=>(<button key={s} onClick={()=>setIncidentSeverity(s)} style={{flex:1, padding:'10px', borderRadius:10, border: incidentSeverity===s ? '2px solid #0f172a' : '2px solid #e2e8f0', background: incidentSeverity===s ? (s==='High'?'#ef4444': s==='Medium'?'#f59e0b':'#22c55e') : '#fff', color: incidentSeverity===s ? '#fff' : '#64748b', fontWeight:900, fontSize:12, cursor:'pointer'}}>{s}</button>))}
            </div>
            <label style={{fontSize:11, fontWeight:900}}>DESCRIPTION</label>
            <textarea value={incidentDesc} onChange={e=>setIncidentDesc(e.target.value)} placeholder="What happened? Where? Who was involved?" style={{width:'100%', padding:'12px', borderRadius:10, border:'2px solid #0f172a', marginTop:6, minHeight:90, fontSize:13}}/>
            <div style={{marginTop:12}}>
              <label style={{fontSize:11, fontWeight:900, display:'flex', gap:6, alignItems:'center'}}><ImageIcon size={12}/> ATTACH EVIDENCE (Image / Video)</label>
              <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={{width:'100%', marginTop:6, padding:'10px', border:'2px dashed #0f172a', borderRadius:10, fontSize:12, background:'#f8fafc'}}/>
              {previewUrl && (
                <div style={{marginTop:10, position:'relative', borderRadius:10, overflow:'hidden', border:'2px solid #0f172a'}}>
                  {incidentFile?.type.startsWith('video') ? <video src={previewUrl} controls style={{width:'100%', maxHeight:200}}/> : <img src={previewUrl} style={{width:'100%', maxHeight:200, objectFit:'cover'}}/>}
                  <button onClick={()=>{setIncidentFile(null); setPreviewUrl('')}} style={{position:'absolute', top:6, right:6, background:'#ef4444', color:'#fff', border:0, borderRadius:99, padding:'4px 8px', fontSize:10, fontWeight:900, cursor:'pointer'}}><X size={12}/> Remove</button>
                </div>
              )}
              <div style={{fontSize:10, color:'#64748b', marginTop:6}}>Max 50MB • Saves to incident_logs table</div>
            </div>
            {loc && <div style={{fontSize:11, color:'#64748b', marginTop:12}}><MapPin size={12}/> {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} • {assignedSite?.name} • {new Date().toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</div>}
            <button onClick={submitIncident} disabled={reporting} style={{marginTop:16, width:'100%', background:'#0f172a', color:'#fff', padding:'14px', borderRadius:10, border:0, fontWeight:900, cursor:'pointer', display:'flex', gap:8, justifyContent:'center', alignItems:'center'}}>{reporting ? 'SENDING...' : <><Send size={14}/> SUBMIT TO incident_logs</>}</button>
          </div>
        </div>
      )}
    </div>
  )
}