import { useState, useEffect, useCallback, useRef } from "react";
import { GAMES as INIT_GAMES } from "./games.js";
import { supabase, signInWithGitHub, signOut, getUser, loadData, saveData } from "./supabase.js";

const CATS = [
  {id:"tier1",label:"Tier 1"},{id:"tier2",label:"Tier 2"},{id:"pickup",label:"Pick Up and Play"},
  {id:"completed",label:"Completed"},{id:"parked",label:"Parked"},{id:"other",label:"Other"},
];
const PC = {"Xbox Series S":"#107c10","Dreamcast":"#0057a8","PS2 Emulator":"#3b5998","Nintendo Switch":"#e4000f","Steam Deck":"#1a9fff","Steam":"#1a9fff"};
const PC_BG = {"PS2 Emulator":"#1a1a24","Dreamcast":"#ffffff"};

function getAllChapterIds(g){return g.chapters?g.chapters.flatMap(gr=>gr.sub.map(s=>s.id)):[];}
function getProgress(g,d){
  if(g.category==="completed")return 100;
  if(g.trackType==="runs")return d[g.id+"-runs"]>0?Math.min(Math.round((d[g.id+"-runs"]||0)/20*100),99):0;
  if(g.chapters){const ids=getAllChapterIds(g);const done=ids.filter(id=>d[id]).length;return ids.length>0?Math.round((done/ids.length)*100):0;}
  return d[g.id+"-pct"]||0;
}

function Card({game,data,onClick}){
  const p=getProgress(game,data);const done=game.category==="completed"||p===100;const[h,setH]=useState(false);
  return(<div onClick={onClick} style={{cursor:"pointer",borderRadius:12,overflow:"hidden",position:"relative",aspectRatio:"3/4",transition:"transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease",boxShadow:h?`0 8px 32px rgba(0,0,0,.6),0 0 20px ${game.accent}33`:"0 4px 20px rgba(0,0,0,.4)",transform:h?"scale(1.04)":"scale(1)"}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
    <div style={{position:"absolute",inset:0,background:game.gradient}}/>
    {done&&<div style={{position:"absolute",top:10,right:10,color:"rgba(255,255,255,.6)",fontSize:10,fontWeight:700,padding:"3px 0",zIndex:3,fontFamily:"'Outfit',sans-serif",letterSpacing:".5px"}}>COMPLETED</div>}
    <div style={{position:"absolute",top:10,left:10,background:PC_BG[game.platform]||PC[game.platform]||"#555",color:PC_BG[game.platform]?PC[game.platform]:"#fff",fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:20,zIndex:3,fontFamily:"'Outfit',sans-serif",opacity:.9}}>{game.platform}</div>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.9) 0%,rgba(0,0,0,.4) 35%,transparent 65%)",zIndex:1}}/>
    <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"16px 14px",zIndex:2}}>
      <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,color:"#fff",lineHeight:1.2,marginBottom:6,textShadow:"0 2px 8px rgba(0,0,0,.7)"}}>{game.title}</div>
      {game.totalHours!=="—"&&<div style={{fontSize:10,color:"rgba(255,255,255,.5)",fontFamily:"'Work Sans',sans-serif",marginBottom:8}}>{game.totalHours} hrs</div>}
      <div style={{height:3,background:"rgba(255,255,255,.15)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:game.accent,borderRadius:2,transition:"width .5s cubic-bezier(.22,1,.36,1)"}}/></div>
      <div style={{fontSize:9,color:"rgba(255,255,255,.4)",marginTop:4,fontFamily:"'Work Sans',sans-serif"}}>{p}%</div>
    </div>
  </div>);
}

function CollapseGroup({label,count,accent,defaultOpen,children}){
  const[open,setOpen]=useState(defaultOpen);
  return(<div style={{marginBottom:16}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"8px 0",marginBottom:open?8:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:10,color:"rgba(255,255,255,.3)",transform:open?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s ease"}}>▶</span>
        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:"1.5px",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"}}>{label}</span>
      </div>
      <span style={{fontSize:11,color:accent,fontFamily:"'Outfit',sans-serif",fontWeight:600,opacity:.7}}>{count}</span>
    </div>
    {open&&<div>{children}</div>}
  </div>);
}

function Detail({game,data,onToggle,onClose,onSetPct,onSetRuns,onComplete,onReassign}){
  const p=getProgress(game,data);const allDone=game.chapters?getAllChapterIds(game).every(id=>data[id]):false;
  const canComplete=game.category!=="completed"&&(allDone||(game.trackType==="runs"&&(data[game.id+"-runs"]||0)>=1)||(!game.chapters&&!game.trackType&&(data[game.id+"-pct"]||0)>=100));
  const[showCat,setShowCat]=useState(false);
  const parseHrs=(s)=>{if(!s||s==="—"||s==="∞"||s==="TBC"||s==="Casual"||s==="Pick-up")return null;const m=s.match(/(\d+)/g);if(!m)return null;if(m.length>=2)return(parseInt(m[0])+parseInt(m[1]))/2;return parseInt(m[0]);};
  const totalH=parseHrs(game.totalHours);const hrsIn=totalH?Math.round(totalH*(p/100)):null;const hrsLeft=totalH?Math.round(totalH-hrsIn):null;
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",justifyContent:"flex-end"}}>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)"}}/>
    <div style={{position:"relative",width:"min(440px,92vw)",height:"100%",background:"#0d0d12",borderLeft:"1px solid rgba(255,255,255,.06)",overflowY:"auto",animation:"slideIn .3s cubic-bezier(.22,1,.36,1)",boxShadow:"-12px 0 40px rgba(0,0,0,.5)"}}>
      <div style={{height:180,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:game.gradient,filter:"blur(6px) brightness(.7)"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,#0d0d12 0%,rgba(13,13,18,.5) 50%,transparent 100%)"}}/>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"rgba(0,0,0,.5)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        <div style={{position:"absolute",bottom:20,left:20,right:20,zIndex:2}}>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>{game.title}</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:PC[game.platform],fontFamily:"'Work Sans',sans-serif",fontWeight:600}}>{game.platform}</span>
            {game.totalHours!=="—"&&<><span style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>·</span><span style={{fontSize:11,color:"rgba(255,255,255,.4)",fontFamily:"'Work Sans',sans-serif"}}>{game.totalHours} hrs</span></>}
          </div>
        </div>
      </div>
      <div style={{padding:"0 20px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,marginTop:4}}>
          <div style={{flex:1,height:4,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${p}%`,background:game.accent,borderRadius:2,transition:"width .4s ease"}}/></div>
          <span style={{fontSize:13,color:game.accent,fontFamily:"'Outfit',sans-serif",fontWeight:700,minWidth:36,textAlign:"right"}}>{p}%</span>
        </div>
        {totalH&&p>0&&p<100&&<div style={{fontSize:11,color:"rgba(255,255,255,.3)",fontFamily:"'Work Sans',sans-serif",marginBottom:16}}>~{hrsIn} hrs in · ~{hrsLeft} hrs left</div>}
        {(!totalH||p===0||p===100)&&<div style={{marginBottom:16}}/>}
        {game.chapters&&game.chapters.map(group=>{const groupDone=group.sub.filter(ch=>data[ch.id]).length;const groupTotal=group.sub.length;return(<CollapseGroup key={group.id} label={group.label} count={`${groupDone}/${groupTotal}`} accent={game.accent} defaultOpen={groupDone<groupTotal}>
          {group.sub.map(ch=>{const done=!!data[ch.id];return(<div key={ch.id} onClick={()=>onToggle(ch.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,cursor:"pointer",background:done?"rgba(255,255,255,.04)":"transparent",marginBottom:2}}>
            <div style={{width:20,height:20,borderRadius:6,border:done?"none":"1.5px solid rgba(255,255,255,.15)",background:done?game.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done&&<span style={{color:"#000",fontSize:12,fontWeight:800}}>✓</span>}</div>
            <span style={{fontSize:13,fontFamily:"'Work Sans',sans-serif",color:done?"rgba(255,255,255,.35)":"rgba(255,255,255,.75)",textDecoration:done?"line-through":"none"}}>{ch.name}</span>
          </div>);})}
        </CollapseGroup>);})}
        {game.trackType==="runs"&&(<div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:"1.5px",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif",marginBottom:14}}>Exploration Runs</div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <button onClick={()=>onSetRuns(game.id+"-runs",Math.max(0,(data[game.id+"-runs"]||0)-1))} style={{width:36,height:36,borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"transparent",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <span style={{fontSize:28,fontFamily:"'Outfit',sans-serif",fontWeight:800,color:game.accent,minWidth:40,textAlign:"center"}}>{data[game.id+"-runs"]||0}</span>
            <button onClick={()=>onSetRuns(game.id+"-runs",(data[game.id+"-runs"]||0)+1)} style={{width:36,height:36,borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"transparent",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
        </div>)}
        {!game.chapters&&!game.trackType&&game.category!=="completed"&&(<div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.35)",letterSpacing:"1.5px",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif",marginBottom:14}}>Progress</div>
          <input type="range" min="0" max="100" value={data[game.id+"-pct"]||0} onChange={e=>onSetPct(game.id+"-pct",parseInt(e.target.value))} style={{width:"100%",accentColor:game.accent,cursor:"pointer"}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Work Sans',sans-serif"}}><span>Not started</span><span>Complete</span></div>
        </div>)}
        {canComplete&&<button onClick={()=>onComplete(game.id)} style={{marginTop:24,width:"100%",padding:"14px",borderRadius:10,border:"none",background:game.accent,color:"#000",fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif",cursor:"pointer",letterSpacing:".5px"}}>Mark as Completed</button>}
        {game.category!=="completed"&&<div style={{marginTop:32,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:16}}>
          <div onClick={()=>setShowCat(!showCat)} style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,.2)",fontFamily:"'Outfit',sans-serif",fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Move to different category</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,.2)",transform:showCat?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s ease"}}>▼</span>
          </div>
          {showCat&&<select value={game.category} onChange={e=>onReassign(game.id,e.target.value)} style={{marginTop:10,background:"rgba(255,255,255,.06)",color:"#fff",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,padding:"6px 10px",fontSize:11,fontFamily:"'Work Sans',sans-serif",cursor:"pointer",outline:"none",width:"100%"}}>
            {CATS.map(c=><option key={c.id} value={c.id} style={{background:"#1a1a1a"}}>{c.label}</option>)}
          </select>}
        </div>}
      </div>
    </div>
  </div>);
}

function LoginScreen() {
  return (
    <div style={{minHeight:"100vh",background:"#08080c",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Work Sans',sans-serif"}}>
      <div style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:10,fontWeight:600,letterSpacing:"2px",color:"rgba(255,255,255,.25)",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif",marginBottom:12}}>Backlog</div>
        <h1 style={{fontFamily:"'Outfit',sans-serif",fontSize:32,fontWeight:800,color:"#fff",letterSpacing:"-.5px",marginBottom:8}}>Gaming Library</h1>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:14,marginBottom:32}}>Sign in to sync your progress across devices</p>
        <button onClick={signInWithGitHub} style={{padding:"14px 32px",borderRadius:10,border:"none",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"'Outfit',sans-serif",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:10,transition:"background .2s ease"}}
          onMouseEnter={e=>e.target.style.background="rgba(255,255,255,.15)"}
          onMouseLeave={e=>e.target.style.background="rgba(255,255,255,.1)"}>
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}

export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[games,setGames]=useState(INIT_GAMES);const[tab,setTab]=useState("dashboard");const[libSub,setLibSub]=useState(null);const[sel,setSel]=useState(null);const[data,setData]=useState({});const[loaded,setLoaded]=useState(false);const[pf,setPf]=useState("All");const[search,setSearch]=useState("");
  const saveTimer=useRef(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user||null);
      setAuthLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user||null);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!user)return;
    (async()=>{
      const saved = await loadData(user.id);
      if(saved){
        setData(saved.data||{});
        if(saved.categories) setGames(prev=>prev.map(g=>({...g,category:saved.categories[g.id]||g.category})));
      }
      setLoaded(true);
    })();
  },[user]);

  const save=useCallback((d,g)=>{
    if(!user)return;
    const c={};g.forEach(x=>{c[x.id]=x.category});
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{ saveData(user.id,d,c); },500);
  },[user]);

  const toggle=useCallback(chId=>{setData(p=>{const n={...p,[chId]:!p[chId],[chId+"-ts"]:Date.now()};save(n,games);return n;});},[save,games]);
  const setPct=useCallback((k,v)=>{setData(p=>{const n={...p,[k]:v,[k+"-ts"]:Date.now()};save(n,games);return n;});},[save,games]);
  const setRuns=useCallback((k,v)=>{setData(p=>{const n={...p,[k]:v,[k+"-ts"]:Date.now()};save(n,games);return n;});},[save,games]);
  const reassign=useCallback((gId,cat)=>{setGames(prev=>{const ng=prev.map(g=>g.id===gId?{...g,category:cat}:g);save(data,ng);return ng;});},[save,data]);
  const complete=useCallback(gId=>{reassign(gId,"completed");setSel(null);},[reassign]);
  const recent=useCallback(()=>{const e=[];games.forEach(g=>{if(g.chapters)g.chapters.forEach(gr=>gr.sub.forEach(ch=>{if(data[ch.id]&&data[ch.id+"-ts"])e.push({game:g.title,ch:ch.name,ts:data[ch.id+"-ts"],accent:g.accent});}));});return e.sort((a,b)=>b.ts-a.ts).slice(0,5);},[games,data]);
  const filt=cat=>games.filter(g=>g.category===cat);const t1=filt("tier1");const cc=filt("completed").length;const allP=[...new Set(games.map(g=>g.platform))];

  if(authLoading)return(<div style={{minHeight:"100vh",background:"#08080c",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"rgba(255,255,255,.3)",fontFamily:"'Outfit',sans-serif"}}>Loading...</div></div>);
  if(!user)return <LoginScreen/>;
  if(!loaded)return(<div style={{minHeight:"100vh",background:"#08080c",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"rgba(255,255,255,.3)",fontFamily:"'Outfit',sans-serif"}}>Loading your backlog...</div></div>);

  const grid=list=>(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:16}}>{list.map(g=><Card key={g.id} game={g} data={data} onClick={()=>setSel(g)}/>)}</div>);
  const rc=recent();
  return(<div style={{minHeight:"100vh",background:"#08080c",color:"#fff",fontFamily:"'Work Sans',sans-serif"}}>
    <div style={{maxWidth:960,margin:"0 auto",padding:"32px 20px 60px"}}>
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <div style={{fontSize:10,fontWeight:600,letterSpacing:"2px",color:"rgba(255,255,255,.25)",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif"}}>Backlog</div>
          <button onClick={signOut} style={{fontSize:10,color:"rgba(255,255,255,.2)",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Work Sans',sans-serif",padding:"4px 8px",borderRadius:4}} onMouseEnter={e=>e.target.style.color="rgba(255,255,255,.5)"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,.2)"}>Sign out</button>
        </div>
        <h1 style={{fontFamily:"'Outfit',sans-serif",fontSize:28,fontWeight:800,letterSpacing:"-.5px",margin:0,lineHeight:1.1}}>Gaming Library</h1>
        <div style={{marginTop:8,fontSize:12,color:"rgba(255,255,255,.6)",display:"flex",alignItems:"center",justifyContent:"space-between"}}><span>{cc} of {games.length} completed</span>
          <button onClick={()=>{setSearch(search?"":"_open")}} style={{background:"transparent",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:16,padding:4}}>⌕</button>
        </div>
        {search!==""&&<div style={{marginTop:12,position:"relative"}}>
          <input autoFocus type="text" placeholder="Search games..." value={search==="_open"?"":search} onChange={e=>setSearch(e.target.value||"_open")} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,fontFamily:"'Work Sans',sans-serif",outline:"none"}}/>
          <button onClick={()=>setSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.5)",width:20,height:20,borderRadius:"50%",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>}
      </div>
      <div style={{display:"flex",gap:2,marginBottom:28,flexWrap:"wrap",alignItems:"center"}}>
        {[{id:"dashboard",l:"Dashboard"},{id:"tier1",l:"Tier 1"},{id:"tier2",l:"Tier 2"},{id:"pickup",l:"Pick Up and Play"}].map(t=>(<button key={t.id} onClick={()=>{setTab(t.id);setLibSub(null)}} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600,background:tab===t.id&&!libSub?"rgba(255,255,255,.12)":"transparent",color:tab===t.id&&!libSub?"#fff":"rgba(255,255,255,.35)"}}>{t.l}</button>))}
        <div style={{position:"relative",display:"flex",alignItems:"center"}}>
          <button onClick={()=>{if(libSub){setLibSub(null)}else{setLibSub("completed");setTab("library")}}} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600,background:tab==="library"?"rgba(255,255,255,.12)":"transparent",color:tab==="library"?"#fff":"rgba(255,255,255,.35)"}}>Library ▾</button>
          {tab==="library"&&<div style={{display:"flex",gap:2,marginLeft:4}}>{[{id:"completed",l:"Completed"},{id:"parked",l:"Parked"},{id:"other",l:"Other"}].map(s=>(<button key={s.id} onClick={()=>{setLibSub(s.id);setTab("library")}} style={{padding:"6px 10px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:11,fontWeight:500,background:libSub===s.id?"rgba(255,255,255,.08)":"transparent",color:libSub===s.id?"#fff":"rgba(255,255,255,.3)"}}>{s.l}</button>))}</div>}
        </div>
        <button onClick={()=>{setTab("fulllibrary");setLibSub(null)}} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:12,fontWeight:600,background:tab==="fulllibrary"?"rgba(255,255,255,.12)":"transparent",color:tab==="fulllibrary"?"#fff":"rgba(255,255,255,.35)"}}>Full Library</button>
      </div>
      {search&&search!=="_open"?<div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.6)",fontStyle:"italic",marginBottom:16}}>{games.filter(g=>g.title.toLowerCase().includes(search.toLowerCase())).length} results for "{search}"</div>
        {grid(games.filter(g=>g.title.toLowerCase().includes(search.toLowerCase())))}
      </div>:<>
      {tab==="dashboard"&&!libSub&&<div>
        {rc.length>0&&<div style={{marginBottom:32}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",letterSpacing:"1.5px",textTransform:"uppercase",fontFamily:"'Outfit',sans-serif",marginBottom:12}}>Recent Activity</div>
          {rc.map((r,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:r.accent,flexShrink:0}}/>
            <div><span style={{fontSize:12,color:"rgba(255,255,255,.85)"}}>{r.game}</span><span style={{fontSize:12,color:"rgba(255,255,255,.5)",margin:"0 6px"}}>→</span><span style={{fontSize:12,color:"rgba(255,255,255,.7)"}}>{r.ch}</span></div>
            <span style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,.45)"}}>{new Date(r.ts).toLocaleDateString()}</span>
          </div>))}
        </div>}
        <div style={{fontSize:11,color:"rgba(255,255,255,.6)",fontStyle:"italic",marginBottom:16}}>Active games · {t1.length} in focus</div>
        {grid(t1)}
      </div>}
      {tab==="tier1"&&!libSub&&grid(filt("tier1"))}
      {tab==="tier2"&&!libSub&&grid(filt("tier2"))}
      {tab==="pickup"&&!libSub&&grid(filt("pickup"))}
      {tab==="library"&&libSub&&grid(filt(libSub))}
      {tab==="fulllibrary"&&<div>
        <div style={{display:"flex",gap:4,marginBottom:20,flexWrap:"wrap"}}>{["All",...allP].map(p=>(<button key={p} onClick={()=>setPf(p)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",fontFamily:"'Work Sans',sans-serif",fontSize:11,background:pf===p?"rgba(255,255,255,.1)":"transparent",color:pf===p?"#fff":"rgba(255,255,255,.3)"}}>{p}</button>))}</div>
        {grid(games.filter(g=>pf==="All"||g.platform===pf))}
      </div>}
      </>}
    </div>
    {sel&&<Detail game={sel} data={data} onToggle={toggle} onSetPct={setPct} onSetRuns={setRuns} onClose={()=>setSel(null)} onComplete={complete} onReassign={reassign}/>}
  </div>);
}