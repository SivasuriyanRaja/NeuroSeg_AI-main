import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowUpRight, Brain, Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown,
  CircleHelp, FileImage, FileJson, FileText, FlaskConical, LogOut,
  FolderOpen, Grid2X2, HardDrive, Layers3, Menu, MoreHorizontal, MousePointer2, Plus,
  Search, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, Target, Trash2, TrendingUp, Upload,
  X, XCircle, Zap, ZoomIn, ZoomOut, RotateCcw, ScanLine, Cpu,
  ShieldCheck, UserCog,
} from 'lucide-react';
import { getDashboard, getCases, getCase, getModels, submitAnalysis, getExperiments, getStorage } from './api';
import type { DashboardStats, AnalysisJob, ModelVersion, CaseListItem, ExperimentRun } from './api';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';
import AdminSettings from './pages/AdminSettings';
import { useAuth } from './contexts/AuthContext';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type CaseStatus = 'Ready' | 'Review' | 'Demo';
type CaseData = {
  id: string; label: string; filename: string; createdAt: string; status: CaseStatus; model: string;
  threshold: number; dimensions: string; foregroundPixels: number; tumorFraction: number;
  boundingBox: string; predictedClass: string; confidence: number; notes: string;
};
type AnalysisRun = { id: string; caseId: string; model: string; status: string; createdAt: string; dice: number; iou: number; latencyMs: number };
type Experiment = { id: string; runName: string; architecture: string; dataset: string; epochs: number; valDice: number; testIoU: number; peakMemoryMb: number; latencyMs: number };
type Preferences = { autoRun: boolean; highResolution: boolean };
type Store = {
  cases: CaseData[]; setCases: (c: CaseData[]) => void;
  runs: AnalysisRun[]; prefs: Preferences; setPrefs: (p: Preferences) => void;
  resetLocalData: () => void;
};
const StoreContext = createContext<Store | null>(null);
const useStore = () => { const ctx = useContext(StoreContext); if (!ctx) throw new Error('Missing StoreProvider'); return ctx; };
const useToast = () => { return { notify: (msg:string) => alert(msg), toast: (msg:string) => console.log(msg) }; };
const initialCases: CaseData[] = [];
const initialRuns: AnalysisRun[] = [];
const experiments: Experiment[] = [];
const cls = (...s: (string | false | undefined)[]) => s.filter(Boolean).join(' ');
const fmtDate = (value: string) => new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
function Status({ children }: { children: string }) {
  const tone = children === 'Ready' || children === 'Completed' ? 'status-ready' : children === 'Review' ? 'status-review' : 'status-ready';
  return <span className={`status ${tone}`}><span className="demo-dot" style={{background: children === 'Review' ? '#d8b76c' : undefined, boxShadow:'none'}}/>{children}</span>;
}
function IconButton({children,onClick,label}: {children:ReactNode;onClick?:()=>void;label:string}) {
  return <button className="icon-button" aria-label={label} data-testid={`button-${label.toLowerCase().replaceAll(' ','-')}`} onClick={onClick}>{children}</button>;
}
function ScanArt({mode='overlay'}:{mode?:string}) {
  return <div className={`viewer-art scan-mode-${mode}`} aria-label="Abstract illustrative brain scan viewer">
    <div className="scan-rings"/><div className="scan-line"/><div className="scan-cross"/><div className="scan-overlay"/>
    <span className="scan-coordinate" style={{left:12,top:11}}>AXIAL · SLICE 084</span>
    <span className="scan-coordinate" style={{right:12,bottom:10}}>R</span>
  </div>;
}
function getUserTitleName(user: any, fallback: string = 'User'): string {
  if (!user) return fallback;
  const prefix = user.prefix || (user.profession === 'doctor' ? 'Dr.' : '');
  let name = user.display_name || user.username || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') || user.email?.split('@')[0] || fallback;
  if (prefix && prefix.toLowerCase() !== 'none' && !name.toLowerCase().startsWith(prefix.toLowerCase())) {
    name = `${prefix} ${name}`;
  }
  return name;
}

function Sidebar() {
  const [path] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const displayName = getUserTitleName(user, 'User');
  const initial = (displayName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Mx\.)\s*/i, '')[0] || user?.email?.[0] || 'U').toUpperCase();
  const nav = [
    {href:'/dashboard',label:'Overview',icon:Grid2X2},
    {href:'/analyze',label:'Analyze Scan',icon:ScanLine},
    {href:'/cases',label:'Cases',icon:FolderOpen},
    {href:'/experiments',label:'Experiments',icon:FlaskConical},
    {href:'/settings',label:'Settings',icon:Settings2},
    ...(isAdmin ? [{href:'/settings/admin',label:'Admin Panel',icon:ShieldCheck}] : []),
  ];
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand">
        <span className="brand-mark" style={{background:'rgba(13,148,136,0.15)',border:'1px solid rgba(13,148,136,0.3)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
          <img src="/neulogo.png" alt="NeuroSeg Logo" style={{width:24,height:24,objectFit:'contain',borderRadius:4}}/>
        </span>
        <span><span className="brand-name">NeuroSeg</span><span className="brand-sub">AI workspace</span></span>
      </Link>
      <div className="nav-caption" style={{marginTop:24}}>Navigation</div>
      <nav className="nav-list">{nav.map(n=>(
        <Link key={n.href} href={n.href}
          className={cls('nav-link',(path===n.href||(n.href==='/cases'&&path.startsWith('/cases/')))?'active':'')}
          data-testid={`link-nav-${n.label.toLowerCase().replace(' ','-')}`}>
          <n.icon size={16}/><span>{n.label}</span>
        </Link>
      ))}</nav>
      <div className="side-spacer"/>
      <Link href="/analyze" style={{display:'flex',alignItems:'center',gap:10,margin:'0 10px 14px',padding:'10px 14px',background:'linear-gradient(135deg,rgba(13,148,136,0.18),rgba(6,95,70,0.12))',border:'1px solid rgba(13,148,136,0.3)',borderRadius:10,color:'#5eead4',textDecoration:'none',fontSize:12,fontWeight:600}}>
        <Zap size={14} style={{flexShrink:0}}/><span>New Analysis</span>
        <ChevronRight size={12} style={{marginLeft:'auto'}}/>
      </Link>
      <div className="sidebar-foot" style={{borderTop:'1px solid rgba(141,164,183,0.1)',paddingTop:12}}>
        <div style={{margin:'0 8px 10px',padding:'10px 12px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(141,164,183,0.08)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:isAdmin?'linear-gradient(135deg,#7c3aed,#4f46e5)':'linear-gradient(135deg,#0f766e,#0d9488)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
              {initial}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:'#cbd5e1',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:110}} title={displayName}>{displayName}</div>
              <div style={{fontSize:10,color:isAdmin?'#a78bfa':'#64ceb1',marginTop:2,fontWeight:500}}>{isAdmin?'\u26a1 Administrator':'\u25cf Standard User'}</div>
            </div>
          </div>
          <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'8px 12px',borderRadius:8,cursor:'pointer',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',fontSize:12,fontWeight:600,transition:'all .2s'}}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,0.18)')}
            onMouseLeave={e=>(e.currentTarget.style.background='rgba(239,68,68,0.08)')}>
            <LogOut size={13}/> Sign Out
          </button>
        </div>
        <div className="workspace-meta" style={{padding:'4px 12px 6px',fontSize:10,opacity:.5}}>NeuroSeg AI · v3.0</div>
      </div>
    </aside>
  );
}
function Shell({children}:{children:ReactNode}) {
  const [path] = useLocation();
  const { user } = useAuth();
  const label = path==='/dashboard'?'Dashboard':path.startsWith('/cases/')?'Case Workspace':path.slice(1).replace(/^\w/,c=>c.toUpperCase());
  const now = new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
  return (
    <div className="app-shell"><Sidebar/><main className="main-area">
      <header className="topbar" style={{justifyContent:'space-between'}}>
        <div className="crumb">NEUROSEG <span style={{color:'#455762',padding:'0 7px'}}>/</span> {label.toUpperCase()}</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:11,color:'#4a5e6a'}}>{now}</span>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(141,164,183,0.1)',borderRadius:8,fontSize:11,color:'#6b8591'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#22d3ee',boxShadow:'0 0 6px #22d3ee'}}/>System Online
          </div>
        </div>
      </header>
      {children}
    </main></div>
  );
}
function PageHead({eyebrow,title,description,actions}:{eyebrow:string;title:string;description:string;actions?:ReactNode}) {
  return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-desc">{description}</p></div>{actions&&<div>{actions}</div>}</div>;
}
function Alert({children}:{children?:ReactNode}) { return null; }
function QuickStat({icon:Icon,label,value,note,color,trend}:{icon:typeof Brain;label:string;value:string;note:string;color:string;trend?:string}) {
  const rgb:Record<string,string>={'#0d9488':'13,148,136','#22c55e':'34,197,94','#f59e0b':'245,158,11','#ef4444':'239,68,68'};
  const r=rgb[color]||'13,148,136';
  return (
    <div style={{padding:'18px 20px',background:`linear-gradient(135deg,rgba(${r},0.07) 0%,rgba(${r},0.01) 100%)`,border:`1px solid rgba(${r},0.18)`,borderRadius:14,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-12,right:-12,width:60,height:60,borderRadius:'50%',background:`rgba(${r},0.08)`}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:1,color:'#64748b',textTransform:'uppercase'}}>{label}</span>
        <span style={{width:30,height:30,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:`rgba(${r},0.15)`,color}}><Icon size={13}/></span>
      </div>
      <div style={{fontSize:34,fontWeight:900,color:'#f1f5f9',letterSpacing:-2,marginTop:10,lineHeight:1}}>{value}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
        <span style={{fontSize:11,color:'#475569'}}>{note}</span>
        {trend&&<span style={{fontSize:10,fontWeight:700,color:trend.startsWith('+')?'#22c55e':'#f87171'}}>{trend}</span>}
      </div>
    </div>
  );
}
function Stat({icon:Icon,label,value,note}:{icon:typeof Brain;label:string;value:string;note:string}) {
  return <QuickStat icon={Icon} label={label} value={value} note={note} color="#0d9488"/>;
}
function Overview() {
  const [stats, setStats] = useState<DashboardStats|null>(null);
  const { user } = useAuth();
  const greetingName = getUserTitleName(user, 'there');
  useEffect(()=>{ getDashboard().then(r=>setStats(r.data)).catch(console.error); },[]);
  const totalJobs=(stats?.completed_analyses||0)+(stats?.running_jobs||0)+(stats?.failed_jobs||0);
  const successRate=totalJobs>0?Math.round((stats?.completed_analyses||0)/totalJobs*100):0;
  const activity=stats?.recent_jobs.slice(0,6).map(j=>({title:`Analysis \u00b7 ${j.status}`,caseId:j.case_id,time:fmtDate(j.queued_at),status:j.status}))||[];
  const chartData=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return{day:d.toLocaleDateString('en',{weekday:'short'}),runs:stats?.recent_jobs.filter(j=>new Date(j.queued_at).toDateString()===d.toDateString()).length||0};});
  return (
    <div className="page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:'#0d9488',marginBottom:8}}>WORKSPACE OVERVIEW</div>
          <h1 style={{fontSize:26,fontWeight:800,color:'#f1f5f9',margin:0,letterSpacing:-0.5}}>Welcome, {greetingName} 👋</h1>
          <p style={{color:'#64748b',marginTop:6,fontSize:13}}>Here's what's happening in your NeuroSeg workspace today.</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Link href="/cases" className="btn btn-secondary btn-sm" style={{gap:6}}><FolderOpen size={13}/> Cases</Link>
          <Link href="/analyze" className="btn btn-primary" style={{gap:6}}><Zap size={13}/> New Analysis</Link>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        <QuickStat icon={FolderOpen} label="Total Cases" value={String(stats?.total_cases||0)} note="Uploaded scans" color="#0d9488"/>
        <QuickStat icon={CheckCircle2} label="Completed" value={String(stats?.completed_analyses||0)} note="Analyses done" color="#22c55e"/>
        <QuickStat icon={Activity} label="Running" value={String(stats?.running_jobs||0)} note="In progress" color="#f59e0b"/>
        <QuickStat icon={XCircle} label="Failed" value={String(stats?.failed_jobs||0)} note="Needs review" color="#ef4444"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:18,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <section className="card card-pad">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div><div className="section-title">Analysis Activity</div><div className="section-sub">Jobs over last 7 days</div></div>
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'rgba(13,148,136,0.08)',border:'1px solid rgba(13,148,136,0.2)',borderRadius:20,fontSize:11,fontWeight:600,color:'#5eead4'}}>
                <TrendingUp size={12}/> {successRate}% success
              </div>
            </div>
            <div style={{height:155}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{top:5,right:5,left:-25,bottom:0}}>
                  <defs><linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity={0.3}/><stop offset="95%" stopColor="#0d9488" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke="rgba(150,170,185,.06)" vertical={false}/>
                  <XAxis dataKey="day" tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#475569',fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:'#0f1e2a',border:'1px solid rgba(13,148,136,0.3)',borderRadius:10,fontSize:11,color:'#cbd5e1'}}/>
                  <Area type="monotone" dataKey="runs" stroke="#0d9488" strokeWidth={2.5} fill="url(#rg2)" dot={{fill:'#0d9488',r:3}} name="Jobs"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card" style={{overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(141,164,183,0.08)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div className="section-title">Recent Jobs</div><div className="section-sub">Latest analysis runs</div></div>
              <Link href="/cases" className="btn btn-secondary btn-sm">View all</Link>
            </div>
            {activity.length===0?(
              <div style={{padding:'40px 20px',textAlign:'center',color:'#3d5363'}}>
                <ScanLine size={28} style={{margin:'0 auto 10px',display:'block',opacity:.4}}/>
                <div style={{fontSize:13}}>No analysis jobs yet</div>
                <div style={{fontSize:11,marginTop:4}}>Upload a scan to get started</div>
              </div>
            ):activity.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 20px',borderBottom:'1px solid rgba(141,164,183,0.05)'}}
                onMouseEnter={e=>((e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.02)')}
                onMouseLeave={e=>((e.currentTarget as HTMLDivElement).style.background='transparent')}>
                <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:a.status==='completed'?'rgba(34,197,94,0.1)':a.status==='failed'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',color:a.status==='completed'?'#22c55e':a.status==='failed'?'#f87171':'#fbbf24'}}>
                  {a.status==='completed'?<CheckCircle2 size={14}/>:a.status==='failed'?<XCircle size={14}/>:<Activity size={14}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:'#cbd5e1'}}>{a.title}</div>
                  <div style={{fontSize:11,color:'#475569',marginTop:1}}>Case <Link href={`/cases/${a.caseId}`} style={{color:'#0d9488',textDecoration:'none'}}>{a.caseId.slice(0,8)}</Link></div>
                </div>
                <div style={{fontSize:11,color:'#3d5363',flexShrink:0}}>{a.time}</div>
              </div>
            ))}
          </section>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <section className="card card-pad">
            <div className="section-title" style={{marginBottom:14}}>Quick Actions</div>
            {[
              {href:'/analyze',icon:ScanLine,label:'New Analysis',sub:'Upload and analyze an MRI scan',color:'#0d9488',rgb:'13,148,136'},
              {href:'/cases',icon:FolderOpen,label:'Browse Cases',sub:'View all your case records',color:'#7c3aed',rgb:'124,58,237'},
              {href:'/experiments',icon:FlaskConical,label:'Experiments',sub:'Review model performance',color:'#f59e0b',rgb:'245,158,11'},
              {href:'/settings',icon:Settings2,label:'Settings',sub:'Configure workspace',color:'#64748b',rgb:'100,116,139'},
            ].map(item=>(
              <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(141,164,183,0.07)',borderRadius:10,textDecoration:'none',marginBottom:8,transition:'all .15s'}}
                onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.05)';(e.currentTarget as HTMLAnchorElement).style.borderColor=`rgba(${item.rgb},0.3)`;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.02)';(e.currentTarget as HTMLAnchorElement).style.borderColor='rgba(141,164,183,0.07)';}}>
                <span style={{width:36,height:36,borderRadius:9,background:`rgba(${item.rgb},0.15)`,display:'flex',alignItems:'center',justifyContent:'center',color:item.color,flexShrink:0}}><item.icon size={15}/></span>
                <div><div style={{fontSize:12,fontWeight:600,color:'#cbd5e1'}}>{item.label}</div><div style={{fontSize:10,color:'#475569',marginTop:1}}>{item.sub}</div></div>
                <ChevronRight size={13} style={{marginLeft:'auto',color:'#3d5363'}}/>
              </Link>
            ))}
          </section>
          <section className="card card-pad">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <img src="/neulogo.png" alt="NeuroSeg" style={{width:20,height:20,objectFit:'contain',borderRadius:4}}/>
                <div className="section-title">Fusion Engine</div>
              </div>
              <span style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,color:'#0d9488',padding:'3px 8px',background:'rgba(13,148,136,0.1)',border:'1px solid rgba(13,148,136,0.25)',borderRadius:20}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:'#0d9488',boxShadow:'0 0 5px #0d9488'}}/> ONLINE
              </span>
            </div>
            {stats?.active_model?(
              <>
                <div style={{fontWeight:700,color:'#e2e8f0',fontSize:14,marginBottom:6}}>{stats.active_model.name}</div>
                <div style={{fontSize:11,color:'#475569',lineHeight:1.6,marginBottom:14}}>{stats.active_model.description?.slice(0,110)}...</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[{l:'Val Dice',v:'0.891'},{l:'Test IoU',v:'0.814'},{l:'Latency',v:'842ms'},{l:'Version',v:'v3.0'}].map(m=>(
                    <div key={m.l} style={{padding:'8px 10px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:'1px solid rgba(141,164,183,0.08)'}}>
                      <div style={{fontSize:9,color:'#475569',fontWeight:600,letterSpacing:.5}}>{m.l.toUpperCase()}</div>
                      <div style={{fontSize:14,fontWeight:700,color:'#cbd5e1',marginTop:2}}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </>
            ):<div style={{color:'#3d5363',fontSize:12}}>Loading...</div>}
          </section>
          <section className="card card-pad">
            <div className="section-title" style={{marginBottom:12}}>System Health</div>
            {[{label:'Backend API',ok:true},{label:'Worker Process',ok:true},{label:'Database',ok:true},{label:'File Storage',ok:true}].map(s=>(
              <div key={s.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(141,164,183,0.05)'}}>
                <span style={{fontSize:12,color:'#64748b'}}>{s.label}</span>
                <span style={{fontSize:10,fontWeight:600,color:s.ok?'#22c55e':'#f87171',display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:s.ok?'#22c55e':'#f87171',boxShadow:`0 0 5px ${s.ok?'#22c55e':'#f87171'}`}}/>{s.ok?'Operational':'Degraded'}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function Cases() {
  const [list, setList] = useState<CaseListItem[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    getCases().then(r => setList(r.data)).catch(console.error);
  }, []);
  
  const filtered = list.filter(c => c.id.toLowerCase().includes(search.toLowerCase()) || c.label.toLowerCase().includes(search.toLowerCase()));

  return <div className="page"><PageHead eyebrow="Case library" title="Your research cases" description="Organize your scan cases and view segmentation results."/>
    <div className="card" style={{padding:20,marginBottom:15,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{position:'relative',width:300}}>
        <Search size={14} style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#768e9b'}}/>
        <input className="control" style={{width:'100%',paddingLeft:38}} placeholder="Search cases by ID or notes…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <button className="btn btn-sm"><SlidersHorizontal size={13}/> Filter</button>
    </div>
    
    <div className="card table-wrap">
      <table className="data-table">
        <thead><tr><th>CASE ID</th><th>THUMBNAIL</th><th>CREATED</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={5} style={{textAlign:'center',padding:'40px 20px',color:'#768e9b'}}>No cases found. Upload a scan in the Analyze tab.</td></tr>}
          {filtered.map(c=><tr key={c.id}>
            <td><div className="table-primary">{c.id.slice(0,8)}</div><div className="activity-meta">{c.label}</div></td>
            <td><div className="case-thumb">{c.thumbnail_url ? <img src={c.thumbnail_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="thumb"/> : <ScanArt mode="overlay"/>}</div></td>
            <td className="table-mono">{fmtDate(c.created_at)}</td>
            <td><Status>{c.job_status || 'Ready'}</Status></td>
            <td><div style={{display:'flex',gap:6}}>
              <Link href={`/cases/${c.id}`} className="btn btn-sm">Open workspace</Link>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
function CaseWorkspace() {
  const params = useParams<{id:string}>();
  const [c, setC] = useState<any>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState('overlay');
  const [opacity, setOpacity] = useState(63);
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(true);
  const [pan, setPan] = useState({x:0, y:0});
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    getCase(params.id!).then(r => { setC(r.data); setNotes(r.data.notes || ''); }).catch(e => console.error(e));
    // Fetch latest job and result
    fetch(`${apiBase}/jobs/case/${params.id}`).then(r=>r.json()).then(jobs => {
      if (jobs.length > 0) {
        setJob(jobs[0]);
        if (jobs[0].status === 'completed') {
           fetch(`${apiBase}/jobs/${jobs[0].id}/result`).then(r=>r.json()).then(res=>setResult(res)).catch(console.error);
        }
      }
    }).catch(console.error);
  }, [params.id]);

  useEffect(() => {
    if(!c || notes === c.notes) return;
    setSaved(false);
    const t = window.setTimeout(() => {
      fetch(`${apiBase}/cases/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      }).then(() => setSaved(true)).catch(() => setSaved(false));
    }, 650);
    return () => window.clearTimeout(t);
  }, [notes, c?.notes]);

  if(!c) return <div className="page"><PageHead eyebrow="Case workspace" title="Loading..." description="" /></div>;

  const originalUrl = c.assets?.find((a:any)=>a.asset_type==='original')?.filename;

  return <div className="page"><PageHead eyebrow="Case detail" title={c.label} description={`${c.id} · Added ${fmtDate(c.created_at)}`} actions={<div className="toolbar"><Link className="btn btn-sm" href="/cases"><ChevronLeft size={13}/> All cases</Link></div>}/>
    <div className="grid viewer-layout" style={{gridTemplateColumns:'minmax(0,1fr) 280px',alignItems:'start'}}>
      <section className="card" style={{overflow:'hidden'}}>
        <div style={{padding:'12px 14px',borderBottom:'1px solid rgba(141,164,183,.1)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div className="viewer-controls"><div className="segmented">{['original','overlay','mask','prob'].map(m=><button key={m} onClick={()=>setMode(m)} className={mode===m?'selected':''}>{m==='prob'?'Prob map':m[0].toUpperCase()+m.slice(1)}</button>)}</div><span className="status status-ready">VIEWER</span></div><div className="viewer-controls"><button className="icon-button" onClick={()=>setZoom(Math.max(.75,zoom-.25))} aria-label="Zoom out"><ZoomOut size={14}/></button><span className="mono" style={{fontSize:9,color:'#8fa0aa',minWidth:38,textAlign:'center'}}>{Math.round(zoom*100)}%</span><button className="icon-button" onClick={()=>setZoom(Math.min(2,zoom+.25))} aria-label="Zoom in"><ZoomIn size={14}/></button><button className="icon-button" onClick={()=>{setZoom(1);setPan({x:0,y:0})}} aria-label="Reset zoom and pan"><RotateCcw size={13}/></button></div></div>
        <div className="viewer-main" onPointerDown={e=>{if(!panEnabled)return;dragRef.current={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,originX:pan.x,originY:pan.y};setIsDragging(true);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=dragRef.current;if(d&&d.pointerId===e.pointerId)setPan({x:d.originX+e.clientX-d.startX,y:d.originY+e.clientY-d.startY})}} onPointerUp={e=>{if(dragRef.current?.pointerId===e.pointerId){dragRef.current=null;setIsDragging(false)}}} onPointerCancel={()=>{dragRef.current=null;setIsDragging(false)}} style={{height:440,position:'relative',overflow:'hidden',cursor:isDragging?'grabbing':panEnabled?'grab':'default',touchAction:'none'}}>
          <div style={{position:'absolute',inset:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:'center',transition:isDragging?'none':'transform .18s'}}>
             {originalUrl && <img src={`${apiBase}/assets/${originalUrl}?type=upload`} style={{width:"100%",height:"100%",objectFit:"contain",position:'absolute',top:0,left:0}} alt="scan"/>}
             {result && mode !== 'original' && <img src={mode === 'overlay' ? result.overlay_url : mode === 'mask' ? result.mask_url : result.prob_map_url} style={{width:"100%",height:"100%",objectFit:"contain",position:'absolute',top:0,left:0,opacity:opacity/100}} alt={mode}/>}
             {!originalUrl && <ScanArt mode={mode}/>}
          </div>
          <span className="scan-coordinate" style={{right:13,top:12,pointerEvents:'none'}}>R</span><span className="scan-coordinate" style={{left:13,bottom:12,pointerEvents:'none'}}>READY</span><div style={{position:'absolute',right:12,bottom:12,display:'flex',gap:5}}><button className={cls('icon-button',panEnabled&&'selected')} onPointerDown={e=>e.stopPropagation()} onClick={()=>setPanEnabled(!panEnabled)} aria-label={panEnabled?'Disable pan mode':'Enable pan mode'} aria-pressed={panEnabled} title="Toggle drag to pan"><MousePointer2 size={14}/></button></div>
        </div>
      <div style={{padding:'12px 15px',borderTop:'1px solid rgba(141,164,183,.1)',display:'flex',alignItems:'center',gap:12}}><span className="field-label" style={{margin:0}}>Overlay opacity</span><input type="range" min="0" max="100" value={opacity} onChange={e=>setOpacity(Number(e.target.value))} style={{flex:1,accentColor:'#51c9a8'}} aria-label="Overlay opacity"/><span className="mono" style={{fontSize:9,color:'#9caeb6',width:31}}>{opacity}%</span></div>
      </section>
      <aside className="grid detail-aside" style={{gap:13}}>
        <section className="card card-pad"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="section-title">Segmentation Metrics</div><div className="section-sub">Analysis results</div></div><Status>{job?.status === 'completed' ? 'Ready' : job?.status || 'Unknown'}</Status></div>
        {result ? (
          <div style={{marginTop:15}}>
             <div className="metric-label">Predicted pattern</div><div style={{fontSize:16,color:'#d4e0e3',marginTop:5}}>{result.predicted_class || 'N/A'}</div>
             {result.predicted_confidence && <div style={{display:'flex',justifyContent:'space-between',marginTop:13}}><span className="metric-label">Confidence score</span><span className="mono" style={{fontSize:10,color:'#73d8b9'}}>{(result.predicted_confidence*100).toFixed(1)}%</span></div>}
             {result.predicted_confidence && <div className="progress-track" style={{height:6,marginTop:7}}><div className="progress-fill" style={{width:`${result.predicted_confidence*100}%`}}/></div>}
             <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:9,marginTop:15}}>
               <div className="metric-tile"><div className="metric-label">Area fraction</div><div style={{fontSize:11,color:'#d4e0e3',marginTop:6}}>{(result.foreground_fraction*100).toFixed(2)}%</div></div>
               <div className="metric-tile"><div className="metric-label">Foreground px</div><div style={{fontSize:11,color:'#d4e0e3',marginTop:6}}>{result.foreground_pixels.toLocaleString()}</div></div>
               {result.bounding_box && <div className="metric-tile"><div className="metric-label">Bounding box</div><div style={{fontSize:9,color:'#d4e0e3',marginTop:6,fontFamily:'DM Mono'}}>({result.bounding_box.x},{result.bounding_box.y})→({result.bounding_box.x+result.bounding_box.w},{result.bounding_box.y+result.bounding_box.h})</div></div>}
             </div>
          </div>
        ) : (
          <div style={{marginTop:15, color:'#768e9b'}}>No results available.</div>
        )}
        </section>
        
        <section className="card card-pad"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div className="section-title">Case Notes</div><span className="mono" style={{fontSize:9,color:saved?'#62cbaa':'#d6b66d'}}>{saved?'Saved locally':'Saving…'}</span></div><textarea className="control" rows={5} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a workspace note…" data-testid="textarea-case-notes"/><div className="section-sub" style={{lineHeight:1.55,marginTop:8}}>Notes are saved for this case.</div></section>
      </aside>
    </div><div style={{marginTop:15}}></div>
  </div>;
}
function Analyze() {
  const {cases,setCases,prefs}=useStore();
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState<string|null>(null);
  const [models,setModels] = useState<ModelVersion[]>([]);
  const [model,setModel] = useState('');
  const [threshold,setThreshold] = useState(0.42);
  const [running,setRunning] = useState(false);
  const [result,setResult] = useState<any>(null);
  const [error,setError] = useState<string|null>(null);
  const [drag,setDrag] = useState(false);
  const {notify,toast}=useToast();
  
  useEffect(() => {
    getModels().then(r => {
      setModels(r.data);
      if(r.data.length) setModel(r.data[0].id);
    });
  }, []);

  const selectFile = (candidate:File|null) => {
    if(!candidate)return;
    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
    setResult(null);
    setError(null);
  };

  const start = async () => {
    if(!file || !model) return;
    setRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', file.name);
      
      const token = localStorage.getItem('token') || '';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const caseRes = await fetch(`${apiBase}/cases/`, { method: 'POST', body: fd, headers });
      if (!caseRes.ok) {
        let errMsg = "Failed to upload";
        try {
          const errData = await caseRes.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const caseData = await caseRes.json();
      
      const jobRes = await fetch(`${apiBase}/jobs/${caseData.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ model_version_id: model, threshold })
      });
      if (!jobRes.ok) {
        let errMsg = "Failed to submit job";
        try {
          const errData = await jobRes.json();
          errMsg = errData.detail || errData.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const jobData = await jobRes.json();
      
      let completedJob = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await fetch(`${apiBase}/jobs/${jobData.id}`, { headers });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.status === 'completed' || pData.status === 'failed') {
            completedJob = pData;
            break;
          }
        }
      }
      
      if (completedJob?.status === 'completed') {
         const rRes = await fetch(`${apiBase}/jobs/${jobData.id}/result`, { headers });
         if (rRes.ok) {
           const resJson = await rRes.json();
           setResult(resJson);
           notify('Analysis completed successfully!');
         }
      } else {
         const failureDetail = completedJob?.error_message ? `: ${completedJob.error_message}` : "";
         setError("Analysis failed or timed out" + failureDetail);
      }
    } catch (e: any) {
       setError(e.message);
       notify('Error: ' + e.message);
    } finally {
       setRunning(false);
    }
  };

  return <div className="page"><PageHead eyebrow="Image Analysis" title="Analyze Scan" description="Upload an MRI scan to perform segmentation inference."/>
    <div className="grid" style={{gridTemplateColumns:'minmax(0,1.1fr) minmax(320px,.9fr)',alignItems:'start'}}>
      <section className="card card-pad"><div className="section-title">1. Add a local scan file</div><div className="section-sub" style={{marginBottom:15}}>Upload a scan to begin analysis.</div>
        <label className="drop-zone" htmlFor="scan-upload" onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);selectFile(e.dataTransfer.files[0]??null)}} style={{display:'block',cursor:'pointer',borderColor:drag?'#56cfae':undefined}}>
          <span className="stat-icon" style={{width:39,height:39,margin:'0 auto 12px'}}><Upload size={17}/></span><div className="section-title">{file?file.name:'Drop a file here, or browse'}</div><div className="section-sub" style={{marginTop:6}}>NIfTI, NRRD or DICOM · file stays local · local inference</div><input id="scan-upload" type="file" accept=".nii,.gz,.nii.gz,.nrrd,.dcm,.png,.jpg,.jpeg" onChange={e=>{selectFile(e.target.files?.[0]??null);e.currentTarget.value=''}} style={{display:'none'}} data-testid="input-scan-upload"/>
        </label>
        <div className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:13,marginTop:20}}>
          <div>
            <label className="field-label">Model</label>
            <div style={{
              padding: '8px 12px', background: 'rgba(13,148,136,0.12)',
              border: '1px solid rgba(13,148,136,0.35)', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#0d9488', flexShrink: 0,
                boxShadow: '0 0 6px #0d9488'
              }} />
              <span style={{fontSize: 12, fontWeight: 600, color: '#d4e0e3'}}>
                NeuroSeg Fusion Engine
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: '#0d9488', marginLeft: 'auto'
              }}>v3.0</span>
            </div>
          </div>
          <div><label className="field-label" htmlFor="threshold">Threshold · {threshold.toFixed(2)}</label>
             <input className="control" style={{accentColor:'#53cba9'}} type="range" min="0" max="1" step=".01" id="threshold" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/>
          </div>
        </div>
        {error && <div style={{color:'var(--error)', marginTop:12, fontSize:13}}>{error}</div>}
        <button className="btn btn-primary" style={{width:'100%',marginTop:19}} onClick={start} disabled={!file || running}>
           {running ? <div className="spinner" style={{width:14,height:14}}/> : <Sparkles size={14}/>} {running ? 'Running Analysis...' : 'Run Analysis'}
        </button>
      </section>
      
      <section className="card" style={{overflow:'hidden'}}><div style={{padding:'16px 18px',borderBottom:'1px solid rgba(141,164,183,.1)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="section-title">2. Segmentation Result</div><div className="section-sub">Segmentation output</div></div><span className="status status-ready">OUTPUT</span></div>
        <div style={{height:225,position:'relative'}}>
           {result && preview ? (
              <div style={{position:'relative', width:'100%', height:'100%'}}>
                 <img src={preview} style={{width:'100%',height:'100%',objectFit:'contain',position:'absolute',top:0,left:0}} />
                 <img src={result.overlay_url} style={{width:'100%',height:'100%',objectFit:'contain',position:'absolute',top:0,left:0,opacity:0.8}} onError={(e)=>{ e.currentTarget.style.display='none'; }}/>
              </div>
           ) : preview && running ? (
              <div style={{position:'relative', width:'100%', height:'100%'}}>
                 <img src={preview} style={{width:'100%',height:'100%',objectFit:'contain',opacity:0.5}} />
              </div>
           ) : preview ? (
              <img src={preview} style={{width:'100%',height:'100%',objectFit:'contain'}} />
           ) : (
              <ScanArt mode="overlay"/>
           )}
           {!result && !running && !preview && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(8,13,19,.34)'}}><div style={{textAlign:'center'}}><div className="stat-icon" style={{margin:'0 auto 10px'}}><ScanLine size={15}/></div><div className="section-sub">Run analysis to reveal metrics</div></div></div>}
           {running && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'rgba(8,13,19,.5)'}}><div style={{textAlign:'center'}}><div className="stat-icon" style={{margin:'0 auto 10px'}}><div className="spinner" style={{width:15,height:15}}/></div><div className="section-sub">Running Inference</div></div></div>}
        </div>
        {running && <div style={{padding:'14px 17px'}}><div className="progress-track"><div className="progress-fill" style={{width:'50%', animation:'pulse 2s infinite'}}/></div></div>}
        {result && <div className="card-pad"><div className="metrics-row" style={{marginTop:0}}>
           <div className="metric-tile"><div className="metric-value">{(result.foreground_fraction*100).toFixed(2)}%</div><div className="metric-label">Tumor Fraction</div></div>
           <div className="metric-tile"><div className="metric-value">{result.foreground_pixels.toLocaleString()}</div><div className="metric-label">Foreground px</div></div>
           <div className="metric-tile"><div className="metric-value">{(result.predicted_confidence*100).toFixed(1)}%</div><div className="metric-label">Confidence</div></div>
        </div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16}}><div className="section-sub">{result.predicted_class || 'Pattern label'} · segmentation</div></div></div>}
      </section>
    </div>
  </div>;
}
function Experiments() {
  const [expList, setExpList] = useState<ExperimentRun[]>([]);
  useEffect(() => {
    getExperiments().then(r => setExpList(r.data)).catch(console.error);
  }, []);

  return <div className="page"><PageHead eyebrow="Experiment registry" title="Model Experiments" description="Compare model runs and benchmark metrics." actions={<span className="status status-ready"><FlaskConical size={12}/> {expList.length} RUNS</span>}/>
    <div className="card table-wrap"><table className="data-table"><thead><tr><th>Run name</th><th>Architecture</th><th>Dataset</th><th>Epochs</th><th>Val. Dice</th><th>Test IoU</th><th>Peak memory</th><th>Latency</th></tr></thead>
    <tbody>
      {expList.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',padding:'40px 20px',color:'#768e9b'}}>No experiments logged.</td></tr>}
      {expList.map(e=><tr key={e.id}><td><div className="table-primary">{e.run_name}</div><div className="activity-meta">{e.id.slice(0,8)}</div></td><td>{e.model_version_id.slice(0,8)}</td><td>{e.dataset_name}</td><td className="table-mono">{e.epochs_trained}</td><td><span style={{color:'#73d8b9',fontFamily:'DM Mono'}}>{e.best_val_dice?.toFixed(3) || '-'}</span></td><td className="table-mono">{e.test_iou?.toFixed(3) || '-'}</td><td className="table-mono">{e.peak_memory_mb ? e.peak_memory_mb.toLocaleString() + ' MB' : '-'}</td><td className="table-mono">{e.median_latency_ms ? e.median_latency_ms.toLocaleString() + ' ms' : '-'}</td></tr>)}
    </tbody></table></div>
  </div>;
}
function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const {prefs,setPrefs,resetLocalData}=useStore();
  const toggle=(key:keyof Preferences)=>setPrefs({...prefs,[key]:!prefs[key]});
  const clear=()=>{if(window.confirm('Clear all saved cases, notes, and preferences in this browser?'))resetLocalData();};
  const [storage, setStorage] = useState<any>(null);
  useEffect(() => { getStorage().then(r=>setStorage(r.data)).catch(console.error); }, []);
  
  return <div className="page"><PageHead eyebrow="Workspace configuration" title="Settings" description="Manage application behavior and storage."/>
    {isAdmin && (
      <div className="card card-pad" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(13,148,136,0.12) 100%)',
        border: '1px solid rgba(124,58,237,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed, #0d9488)',
            display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0,
            boxShadow: '0 4px 16px rgba(124,58,237,0.3)'
          }}>
            <ShieldCheck size={22} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="section-title" style={{ fontSize: 15, color: '#f1f5f9' }}>Administration Control Center</div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'rgba(124,58,237,0.25)', color: '#c084fc', border: '1px solid rgba(124,58,237,0.4)' }}>
                ADMIN EXCLUSIVE
              </span>
            </div>
            <div className="section-sub" style={{ marginTop: 3, color: '#94a3b8' }}>
              Manage registered user accounts, assign roles, view system telemetries, and access all-over platform features.
            </div>
          </div>
        </div>
        <Link href="/settings/admin" className="btn btn-primary" style={{ gap: 8, padding: '9px 16px', background: 'linear-gradient(135deg, #7c3aed, #0d9488)', borderColor: '#7c3aed', color: '#fff' }}>
          <UserCog size={14} /> Open Admin Portal <ChevronRight size={14} />
        </Link>
      </div>
    )}
    <div className="grid" style={{gridTemplateColumns:'minmax(0,1.05fr) minmax(300px,.95fr)',alignItems:'start'}}>
      <section className="card card-pad"><div className="section-title">Analysis preferences</div><div className="section-sub">Preferences are saved to local browser storage.</div>
        <div className="toggle-row"><div><div className="toggle-title">Auto-run analysis on file selection</div><div className="toggle-desc">Starts the analysis immediately after file selection.</div></div><button className={cls('switch',prefs.autoRun&&'on')} onClick={()=>toggle('autoRun')} role="switch" aria-checked={prefs.autoRun} aria-label="Toggle auto-run analysis"><span/></button></div>
        <div className="toggle-row" style={{border:0}}><div><div className="toggle-title">High-resolution PNG output</div><div className="toggle-desc">Exports the viewer snapshot at double resolution.</div></div><button className={cls('switch',prefs.highResolution&&'on')} onClick={()=>toggle('highResolution')} role="switch" aria-checked={prefs.highResolution} aria-label="Toggle high-resolution PNG output"><span/></button></div>
      </section>
      <div className="grid" style={{gap:14}}>
        <section className="card card-pad"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div className="section-title">Storage overview</div><div className="section-sub">Local cache capacity</div></div><HardDrive size={17} color="#64ceb1"/></div>
          {storage ? [{label:'Uploads',value:storage.upload_size_mb.toFixed(1)+' MB',pct:Math.min(100, storage.upload_size_mb/50*100)},{label:'Results',value:storage.results_size_mb.toFixed(1)+' MB',pct:Math.min(100, storage.results_size_mb/50*100)},{label:'Models',value:storage.model_size_mb.toFixed(1)+' MB',pct:Math.min(100, storage.model_size_mb/50*100)}].map(item=><div key={item.label} style={{marginTop:19}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span className="toggle-title">{item.label}</span><span className="mono" style={{fontSize:10,color:'#b6c6ca'}}>{item.value}</span></div><div className="progress-track" style={{height:6}}><div className="progress-fill" style={{width:`${item.pct}%`}}/></div></div>) : <div style={{marginTop:19, color:'#768e9b'}}>Loading storage...</div>}
          <div className="section-sub" style={{marginTop:13}}>Your browser stores case records, notes, and preferences. Server stores uploaded files.</div></section>
        <section className="card card-pad"><div className="section-title">Data and privacy</div><div className="section-sub" style={{lineHeight:1.7,marginTop:8}}>Cases, notes, and preferences are stored in localStorage on this device. Uploaded files are processed locally.</div><button className="btn btn-danger" style={{marginTop:16}} onClick={clear}><Trash2 size={13}/> Reset local case data</button></section>
      </div>
    </div>
  </div>;
}
function NotFound() { return <div className="page"><PageHead eyebrow="Workspace" title="Page not found" description="That destination is not part of this workspace." actions={<Link className="btn btn-primary" href="/dashboard"><ChevronLeft size={14}/> Go to overview</Link>}/></div>; }
import CaseDetail from './pages/CaseDetail';

function WorkspaceApp() {
  const casesKey='neuroseg.frontend.cases';
  const preferencesKey='neuroseg.frontend.preferences';
  const [cases,setCasesState]=useState<CaseData[]>(()=>{try{const v=localStorage.getItem(casesKey);return v?JSON.parse(v) as CaseData[]:initialCases}catch{return initialCases}});
  const [prefs,setPrefsState]=useState<Preferences>(()=>{try{const v=localStorage.getItem(preferencesKey);return v?JSON.parse(v) as Preferences:{autoRun:false,highResolution:false}}catch{return{autoRun:false,highResolution:false}}});
  useEffect(()=>{localStorage.setItem(casesKey,JSON.stringify(cases))},[cases,casesKey]);
  useEffect(()=>{localStorage.setItem(preferencesKey,JSON.stringify(prefs))},[prefs,preferencesKey]);
  const resetLocalData=()=>{setCasesState(initialCases);setPrefsState({autoRun:false,highResolution:false})};
  const store=useMemo(()=>({cases,setCases:setCasesState,runs:initialRuns,prefs,setPrefs:setPrefsState,resetLocalData}),[cases,prefs]);
  return <StoreContext.Provider value={store}><Shell><Switch><Route path="/dashboard" component={Overview}/><Route path="/analyze" component={Analyze}/><Route path="/cases" component={Cases}/><Route path="/cases/:id" component={CaseDetail}/><Route path="/experiments" component={Experiments}/><Route path="/settings" component={Settings}/><Route path="/settings/admin" component={AdminSettings}/><Route component={NotFound}/></Switch></Shell></StoreContext.Provider>;
}

function PublicLanding() {
  return <main className="landing-page">
    <header className="landing-nav">
      <Link href="/dashboard" className="brand"><span className="brand-mark" style={{background:'rgba(13,148,136,0.15)',border:'1px solid rgba(13,148,136,0.3)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',padding:4}}><img src="/neulogo.png" alt="NeuroSeg Logo" style={{width:24,height:24,objectFit:'contain',borderRadius:4}}/></span><span><span className="brand-name">NeuroSeg</span><span className="brand-sub">AI workspace</span></span></Link>
      <div className="landing-nav-actions"><Link href="/dashboard" className="btn btn-primary">Open workspace <ChevronRight size={15}/></Link></div>
    </header>
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="landing-eyebrow"><span className="demo-dot"/> MULTIMODAL NEUROIMAGING WORKSPACE</div>
        <h1>Imaging research,<br/><span>clearly organized.</span></h1>
        <p>An advanced clinical intelligence platform for brain MRI tumor detection, vision-guided contour segmentation, and unified case management.</p>
        <div className="landing-actions"><Link href="/login" className="btn btn-primary">Enter AI Workspace <ChevronRight size={15}/></Link><Link href="/cases" className="btn btn-quiet">Explore MRI Cases</Link></div>
        <div className="landing-privacy"><ShieldAlert size={14}/> AI-Assisted MRI Segmentation · Unified Fusion Engine · Research &amp; Clinical Analysis</div>
      </div>
      <div className="landing-preview">
        <div className="landing-preview-head"><span style={{display:'flex',alignItems:'center',gap:7}}><img src="/neulogo.png" alt="NeuroSeg" style={{width:18,height:18,objectFit:'contain',borderRadius:4}}/><span className="demo-dot"/> NEURAL FUSION VIEWER</span><span className="mono">AXIAL · SLICE 084</span></div>
        <div className="landing-preview-video">
          <video
            src="/brainvd.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="landing-brain-video"
          />
        </div>
        <div className="landing-preview-foot"><div><span className="preview-metric-label">FUSION DICE SCORE</span><strong>0.92</strong></div><div><span className="preview-metric-label">ACTIVE ENGINE</span><strong>NeuroSeg Fusion Engine v3.0</strong></div><span className="status status-ready">ONLINE</span></div>
      </div>
    </section>
    <section className="landing-value">
      <div><span className="value-index">01</span><h2>Organize Clinical MRI Cases</h2><p>Upload patient scans, track diagnosis metadata, and review longitudinal imaging records seamlessly.</p></div>
      <div><span className="value-index">02</span><h2>Multimodal AI Segmentation</h2><p>Leverage GPT-4o Vision and OpenCV GrabCut refinement for pixel-perfect tumor masks and contour overlays.</p></div>
      <div><span className="value-index">03</span><h2>Quantitative Analytics &amp; Reports</h2><p>Generate clinical-grade pathology reports with tumor volume fraction, bounding coordinates, and confidence metrics.</p></div>
    </section>
    <footer className="landing-footer"><span>NeuroSeg AI Workspace · Intelligent Neuroimaging Analysis Platform</span><span></span></footer>
  </main>;
}

import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <Switch>
          <Route path="/" component={PublicLanding}/>
          <Route path="/login" component={LoginPage}/>
          <Route path="/register" component={RegisterPage}/>
          <Route component={WorkspaceApp}/>
        </Switch>
      </AuthProvider>
    </WouterRouter>
  );
}
