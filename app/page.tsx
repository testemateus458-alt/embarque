"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"; import { createClient } from "@supabase/supabase-js";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Clock,
  History, LogOut, Monitor, Package, Plus, Search, Settings2,
  ShieldCheck, Trash2, Truck, Upload, Users, X
} from "lucide-react";
type Shipment={id:string;number:string;nf:string;destination:string;carrier:string;driver:string;plate:string;vehicle:string;dock_id:number|null;scheduled_at:string;volumes:number;weight:number;responsible:string;notes:string;missing_item_notes:string;status:string;version:number;started_at?:string|null;shipped_at?:string|null;created_at?:string;updated_at?:string;photo_url?:string|null};
type ShipmentPhoto={id:string;shipment_id:string;url:string;created_at:string};
type Profile={id:string;name:string;role:"visualizador"|"operador"|"admin";active:boolean};
type Audit={id:number;shipment_id:string;shipment_number:string;action:string;actor_name:string;created_at:string;before_data:Shipment|null;after_data:Shipment|null};
type Dock={id:number;name:string};
const supabase:any = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.replace(".supabase.com",".supabase.co"), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;
const demoDocks:Array<Dock>=Array.from({length:6},(_,i)=>({id:i+1,name:"Doca 0"+(i+1)}));
function demoLoads():Shipment[]{const places=["São Paulo, SP","Curitiba, PR","Campinas, SP","Belo Horizonte, MG","Joinville, SC","Rio de Janeiro, RJ","Santos, SP","Goiânia, GO","Sorocaba, SP","Londrina, PR","Vitória, ES","Ribeirão Preto, SP"];const statuses=["Pendente","Em processo","Falta item","Concluído"];return places.map((destination,i)=>({id:"demo-"+i,number:String(10706+i),nf:String(89301+i),destination,carrier:["PETROLÂNDIA","Unidade Norte","Linha Industrial"][i%3],driver:["Carlos Oliveira","Marcos Santos","Ana Ribeiro","Paulo Costa"][i%4],plate:["ABC1D23","FGR4H56","JKL7M89"][i%3],vehicle:i%2?"Truck":"Carreta",dock_id:null,scheduled_at:new Date(Date.now()+(i-3)*25*60000).toISOString(),volumes:21+i*3,weight:2800+i*600,responsible:["Juliana Lima","Rafael Souza"][i%2],notes:i===0?"Separar conforme romaneio 3201.":"",missing_item_notes:i%4===2?"Faltam 3 caixas do item 5087 — filme stretch 500 mm.":"",status:statuses[i%4],version:1,started_at:i%4!==0?new Date(Date.now()-(i+1)*600000).toISOString():null,shipped_at:i%4===3?new Date().toISOString():null}));}import { STAGES, assertDockAvailable, isLate, validateShipment } from "@/lib/domain.mjs";

import {OperationDashboard} from '@/components/operation-dashboard';
import {parseShipmentPdf, type ImportedShipmentRow} from '@/lib/pdf-import';

type Role = "visualizador" | "operador" | "admin";
type FormLoad = Omit<Shipment, "id" | "version"> & { id?: string; version?: number };
const emptyLoad = (): FormLoad => ({ number:"", nf:"", destination:"", carrier:"", driver:"", plate:"", vehicle:"Requisição", dock_id:null, scheduled_at:new Date(Date.now()+86400000).toISOString().slice(0,16), volumes:0, weight:0, responsible:"", notes:"", missing_item_notes:"", status:"Pendente" });
const actionLabel: Record<string,string> = { INSERT:"Cadastrou", UPDATE:"Atualizou", DELETE:"Excluiu" };
const DEMO_PASSWORD = "Packem2026";

export default function Home() {
  const demo = !supabase;
  const [loads,setLoads] = useState<Shipment[]>(demoLoads());
  const [photos,setPhotos] = useState<ShipmentPhoto[]>([]);
  const [docks,setDocks] = useState<Dock[]>(demoDocks);
  const [profile,setProfile] = useState<Profile | null>(demo?{id:"demo",name:"Marina Costa",role:"admin",active:true}:null);
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [audits,setAudits] = useState<Audit[]>([]);
  const [view,setView] = useState<"board"|"dashboard"|"history"|"team">("board");
  const [tv,setTv] = useState(false); useEffect(()=>{const sync=()=>setTv(Boolean(document.fullscreenElement));document.addEventListener("fullscreenchange",sync);return()=>document.removeEventListener("fullscreenchange",sync)},[]);
  const [query,setQuery] = useState("");
  const [page,setPage] = useState(1);
  const [stageFilter,setStageFilter] = useState("Todos");
  useEffect(()=>setPage(1),[query,stageFilter]);
  const [connection,setConnection] = useState(demo?'Demonstração':'Conectando');
  const [showFilters,setShowFilters] = useState(false);
  const [modal,setModal] = useState<FormLoad|null>(null);
  const [details,setDetails] = useState<Shipment|null>(null);
  const [photoViewer,setPhotoViewer] = useState<Shipment|null>(null);
  const [confirmDelete,setConfirmDelete] = useState<Shipment|null>(null);
  const [importRows,setImportRows] = useState<ImportedShipmentRow[]|null>(null);
  const [importing,setImporting] = useState(false);
  const [login,setLogin] = useState({email:"",password:""});
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(!demo);
  const [now,setNow] = useState(0);
  const [demoReady,setDemoReady] = useState(false);
  const [demoUnlocked,setDemoUnlocked] = useState(false);
  const [unlockOpen,setUnlockOpen] = useState(false);
  const [demoPassword,setDemoPassword] = useState("");
  const [accessError,setAccessError] = useState("");
  const canWrite = (profile?.role === "operador" || profile?.role === "admin") && demoUnlocked;

  useEffect(()=>{ setNow(Date.now()); const timer=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(timer); },[]);
  useEffect(()=>{if(!demo)return;try{const saved=localStorage.getItem("packem-shipments");if(saved)setLoads(JSON.parse(saved) as Shipment[])}catch{}finally{setDemoReady(true)}},[demo]);

  useEffect(()=>{if(demo&&demoReady)localStorage.setItem("packem-shipments",JSON.stringify(loads))},[demo,demoReady,loads]);useEffect(()=>{if(!demo&&profile?.id==="public")void reload()},[demo,profile]);
  useEffect(()=>{
    if(!supabase) return;
    let active=true;
    async function bootstrap(){
      const {data:{session}}=await supabase!.auth.getSession();
      if(!session){if(active){setProfile({id:"public",name:"Operação",role:"admin",active:true});setLoading(false);}return;}
      await reload();
    }
    bootstrap();
    const {data:auth}=supabase.auth.onAuthStateChange((_event: unknown,session: any)=>{ if(!session){setProfile({id:"public",name:"Operação",role:"admin",active:true});setLoading(false);} else void reload(); });
    const channel=supabase.channel("nexo-operation")
      .on("postgres_changes",{event:"*",schema:"public",table:"shipments"},()=>void reload())
      .on("postgres_changes",{event:"*",schema:"public",table:"audit_log"},()=>void reloadAudit())
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>void reload()).subscribe(status=>setConnection(status==='SUBSCRIBED'?'Conectado': 'Reconectando'));
    const refresh=setInterval(()=>void reload(),2000);
    return()=>{active=false;clearInterval(refresh);auth.subscription.unsubscribe();void supabase!.removeChannel(channel)};
  },[]);

  async function reload(){
    if(!supabase)return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){const [l,d,pics]=await Promise.all([supabase.from("shipments").select("*").order("scheduled_at"),supabase.from("docks").select("*").order("id"),supabase.from("shipment_photos").select("*").order("created_at",{ascending:false})]);setLoads((l.data||[]) as Shipment[]);setDocks((d.data||[]) as Dock[]);setPhotos((pics.data||[]) as ShipmentPhoto[]);setConnection("Conectado");setLoading(false);return;}
    const [p,l,d,pics]=await Promise.all([
      supabase.from("profiles").select("*").eq("id",user.id).single(),
      supabase.from("shipments").select("*").order("scheduled_at"),
      supabase.from("docks").select("*").order("id"),
      supabase.from("shipment_photos").select("*").order("created_at",{ascending:false})
    ]);
    if(p.error||l.error||d.error){setMessage('Não foi possível atualizar os dados. Tente novamente.');setLoading(false);return;}
    setProfile(p.data as Profile);setLoads((l.data||[]) as Shipment[]);setDocks((d.data||[]) as Dock[]);setPhotos((pics.data||[]) as ShipmentPhoto[]);setLoading(false);
    void reloadAudit(); if(p.data.role==="admin")void reloadProfiles();
  }
  async function reloadAudit(){if(!supabase)return;const {data}=await supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200);setAudits((data||[]) as Audit[])}
  async function reloadProfiles(){if(!supabase)return;const {data}=await supabase.from("profiles").select("*").order("name");setProfiles((data||[]) as Profile[])}

  const filtered=useMemo(()=>loads.filter(load=>{
    const hay=[load.number,load.carrier].join(" ").toLowerCase();
    return (!query||hay.includes(query.toLowerCase())) && (stageFilter==="Todos"||load.status===stageFilter);
  }),[loads,query,stageFilter]);
  const late=filtered.filter(l=>isLate(l,now));
  const pageCount=Math.max(1,Math.ceil(filtered.length/12));
  const currentPage=Math.min(page,pageCount);
  const queue=[...filtered].filter(l=>l.status!=="Concluído").sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)).slice(0,5);

  async function saveLoad(event:FormEvent<HTMLFormElement>,stagedPhotos:File[]=[]){
    event.preventDefault(); if(!modal||!canWrite)return;
    const candidate={...modal,destination:modal.carrier,volumes:0,weight:0,dock_id:null,scheduled_at:new Date(modal.scheduled_at).toISOString()} as Shipment;
    if(loads.some(x=>x.id!==candidate.id&&x.number.trim().toLowerCase()===candidate.number.trim().toLowerCase())){setMessage('Já existe uma requisição com este lote. Edite o registro existente.');return;}
    try{validateShipment(candidate);assertDockAvailable(candidate,loads)}catch(error){setMessage((error as Error).message);return}
    if(demo){
      let saved:Shipment;
      if(candidate.id){
        const previous=loads.find(x=>x.id===candidate.id);
        saved={...candidate,version:(previous?.version||candidate.version||0)+1,updated_at:new Date().toISOString()};
        setLoads(v=>v.map(x=>x.id===candidate.id?{...x,...saved}:x));
        setAudits(v=>[{id:Date.now(),shipment_id:candidate.id!,shipment_number:candidate.number,action:"UPDATE",actor_name:profile!.name,created_at:new Date().toISOString(),before_data:previous||null,after_data:saved},...v]);
      }else{
        saved={...candidate,id:crypto.randomUUID(),version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        setLoads(v=>[...v,saved]);
        setAudits(v=>[{id:Date.now(),shipment_id:saved.id,shipment_number:saved.number,action:"INSERT",actor_name:profile!.name,created_at:new Date().toISOString(),before_data:null,after_data:saved},...v]);
      }
      if(stagedPhotos.length)await Promise.all(stagedPhotos.map(photo=>uploadLoadPhoto(saved,photo)));
      setStageFilter(candidate.status);setDetails(null);setModal(null);setMessage(`Lote ${candidate.number}: ${candidate.status}.`);return;
    }
    const payload={...candidate};delete (payload as Partial<Shipment>).id;delete (payload as Partial<Shipment>).version;
    const result=candidate.id
      ? await supabase!.from("shipments").update(payload).eq("id",candidate.id).eq("version",candidate.version!).select().single()
      : await supabase!.from("shipments").insert(payload).select().single();
    if(result.error){setMessage(result.error.code==="23505"?"Número ou doca já está em uso.":result.error.message);return}
    if(candidate.id&&!result.data){setMessage("A carga foi alterada por outra pessoa. Atualizamos os dados; revise antes de salvar novamente.");await reload();return}
    if(stagedPhotos.length&&result.data)await Promise.all(stagedPhotos.map(photo=>uploadLoadPhoto(result.data as Shipment,photo)));
    setStageFilter(candidate.status);setDetails(null);setModal(null);setMessage(`Lote ${candidate.number}: ${candidate.status}.`);await reload();
  }
  async function uploadLoadPhoto(load:Shipment,file?:File){
    if(!file||!canWrite)return;
    if(!file.type.startsWith("image/")){setMessage("Escolha uma imagem JPG, PNG ou WEBP.");return;}
    if(file.size>5*1024*1024){setMessage("A foto deve ter no máximo 5 MB.");return;}
    try{
      if(demo){const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler a foto."));reader.readAsDataURL(file)});const photo={id:crypto.randomUUID(),shipment_id:load.id,url,created_at:new Date().toISOString()};setPhotos(current=>[photo,...current]);setLoads(current=>current.map(item=>item.id===load.id?{...item,photo_url:url,updated_at:new Date().toISOString()}:item));setMessage(`Foto adicionada ao lote ${load.number}.`);return;}
      const extension=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${load.id}/${Date.now()}.${extension}`;
      const {error:uploadError}=await supabase!.storage.from("carga-fotos").upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError)throw uploadError;
      const {data:urlData}=supabase!.storage.from("carga-fotos").getPublicUrl(path);
      const {error:saveError}=await supabase!.from("shipment_photos").insert({shipment_id:load.id,url:urlData.publicUrl});
      if(saveError)throw saveError;
      setMessage(`Foto adicionada ao lote ${load.number}.`);await reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível enviar a foto.");}
  }

  async function removeLoadPhoto(photo:ShipmentPhoto){
    if(!canWrite)return;
    if(demo){setPhotos(current=>current.filter(item=>item.id!==photo.id));return;}
    const {data,error}=await supabase!.from("shipment_photos").delete().eq("id",photo.id).select("id");
    if(error||!data?.length){setMessage(error?.message||"A foto não foi removida. Libere as alterações e tente novamente.");return;}
    setPhotos(current=>current.filter(item=>item.id!==photo.id));
    await reload();
    setMessage("Foto removida da carga.");
  }

  async function move(load:Shipment,direction:number){const status=direction===1?(load.status==='Pendente'?'Em processo':load.status==='Falta item'?'Em processo':'Concluído'):'Falta item';if(!canWrite)return;setModal({...load,status})}
  function openStage(stage:string){setQuery("");setStageFilter(stage);setPage(1);window.setTimeout(()=>document.querySelector('.operation-grid')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}
  async function removeLoad(){if(!confirmDelete||profile?.role!=="admin")return;if(demo){setLoads(v=>v.filter(x=>x.id!==confirmDelete.id));setConfirmDelete(null);return}const {error}=await supabase!.from("shipments").delete().eq("id",confirmDelete.id);if(error)setMessage(error.message);else{setConfirmDelete(null);await reload()}}
  async function signIn(e:FormEvent){e.preventDefault();setLoading(true);const {error}=await supabase!.auth.signInWithPassword(login);setMessage(error?"E-mail ou senha inválidos.":"");setLoading(false)}
  function unlockDemo(event:FormEvent){event.preventDefault();if(demoPassword!==DEMO_PASSWORD){setAccessError("Senha inválida. Tente novamente.");return}setAccessError("");setDemoUnlocked(true)}
  async function setUserRole(user:Profile,role:Role){if(demo){setProfiles(v=>v.map(p=>p.id===user.id?{...p,role}:p));return}const {error}=await supabase!.from("profiles").update({role}).eq("id",user.id);if(error)setMessage(error.message);else await reloadProfiles()}
  async function toggleUser(user:Profile){if(!supabase)return;const {error}=await supabase.from("profiles").update({active:!user.active}).eq("id",user.id);if(error)setMessage(error.message);else await reloadProfiles()}
  async function readPdf(file?:File){if(!file)return;setImporting(true);setMessage("");try{setImportRows(await parseShipmentPdf(file))}catch(error){setMessage((error as Error).message)}finally{setImporting(false)}}
  async function confirmPdfImport(){if(!importRows||!canWrite)return;const existing=new Set(loads.map(load=>load.number.trim().toLocaleLowerCase("pt-BR")));const fresh=importRows.filter(row=>!existing.has(row.lot.trim().toLocaleLowerCase("pt-BR"))).map(row=>({id:crypto.randomUUID(),number:row.lot,nf:"",destination:row.destination,carrier:row.destination,driver:"",plate:"",vehicle:"Kit",dock_id:null,scheduled_at:`${row.date.split("/").reverse().join("-")}T08:00:00.000`,volumes:row.quantity,weight:0,responsible:profile?.name||"",notes:row.description,missing_item_notes:"",status:"Pendente",version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()} satisfies Shipment));if(!fresh.length){setMessage("Todos os lotes desse PDF já estão cadastrados.");setImportRows(null);return}if(demo){setLoads(current=>[...fresh,...current]);setImportRows(null);setStageFilter("Todos");setMessage(`${fresh.length} lotes importados do PDF.`);return}const payload=fresh.map(({id,version,created_at,updated_at,...row})=>row);let error:any=null;for(let i=0;i<payload.length;i+=5){try{const result=await supabase!.from("shipments").insert(payload.slice(i,i+5));error=result.error;if(error)break}catch{error={message:"Falha de conexão ao salvar os lotes. Tente novamente."};break}}if(error)setMessage(error.message);else{setImportRows(null);setStageFilter("Todos");setMessage(`${fresh.length} lotes importados do PDF.`);await reload()}}

  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,opts?:unknown)=>void}}).modelContext;
    if(!context?.registerTool)return; const abort=new AbortController();
    try{context.registerTool({name:"list_shipments",title:"Listar cargas",description:"Lista as cargas visíveis no painel de embarques.",inputSchema:{type:"object",properties:{status:{type:"string"}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:{status?:string})=>loads.filter(l=>!input.status||l.status===input.status).map(({id,number,destination,status,scheduled_at,dock_id})=>({id,number,destination,status,scheduled_at,dock_id}))},{signal:abort.signal})}catch{}
    return()=>abort.abort();
  },[loads]);


  if(loading)return <div className="loading"><Activity className="spin"/> Sincronizando operação…</div>;
  return <main className={`shell ${tv?"tv":""}`}>
    <div className="ambient-grid" aria-hidden="true"><i/><i/><i/></div>
    <header><button className="brand" onClick={()=>setView("board")}><img src="/packem-mark.png" alt=""/><span>PACKEM<small>OPERAÇÕES</small></span></button><span className="live"><i/> {connection.toUpperCase()}</span><nav><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}><Activity size={16}/> Dashboard</button><button className={view==="board"?"active":""} onClick={()=>setView("board")}>Operação</button></nav>{!demoUnlocked&&<button className="unlock-button" onClick={()=>{setAccessError("");setUnlockOpen(true)}}>Liberar alterações</button>}<button onClick={async()=>{if(tv){await document.exitFullscreen?.();setTv(false);}else{try{await document.documentElement.requestFullscreen?.();setTv(true);}catch{setTv(false);}}}}><Monitor size={16}/> {tv?"Sair da TV":"Modo TV"}</button></header>
    {demo&&<div className="notice"><ShieldCheck size={16}/> Demonstração segura · dados ilustrativos · configure o Supabase para salvar e compartilhar</div>}
    {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage("")}><X size={16}/></button></div>}
    {unlockOpen&&<DemoUnlock password={demoPassword} setPassword={setDemoPassword} submit={event=>{unlockDemo(event);if(demoPassword===DEMO_PASSWORD)setUnlockOpen(false)}} onClose={()=>setUnlockOpen(false)} error={accessError}/>}
    {view==="board"&&<>
      <section className="command-hero">
      <section className="heading"><div><p>PACKEM / CENTRAL DE EXPEDIÇÃO</p><h1>Controle de expedição<span>.</span></h1><p><i className="pulse-dot"/> Programação e acompanhamento dos lotes</p></div><div className="ops-live"><span><i/> OPERAÇÃO AO VIVO</span><b>{now?new Date(now).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"--:--:--"}</b><small>{now?new Date(now).toLocaleDateString("pt-BR"):"Sincronizando"}</small></div><div className="heading-actions">{canWrite&&<><label className={`pdf-upload ${importing?"disabled":""}`}><Upload size={18}/>{importing?"Lendo PDF…":"Carregar romaneio"}<input type="file" accept="application/pdf,.pdf" disabled={importing} onChange={event=>{void readPdf(event.target.files?.[0]);event.currentTarget.value=""}}/></label><button className="primary" onClick={()=>setModal(emptyLoad())}><Plus size={18}/> Adicionar lote</button></>}</div></section>
      <section className="kpis">{[["Pendentes","Pendente",loads.filter(x=>x.status==="Pendente").length,Clock],["Em processo","Em processo",loads.filter(x=>x.status==="Em processo").length,Activity],["Falta item","Falta item",loads.filter(x=>x.status==="Falta item").length,AlertTriangle],["Concluídos","Concluído",loads.filter(x=>x.status==="Concluído").length,ArrowUpRight]].map(([label,stage,value,Icon]:any)=><button type="button" className="kpi-action" key={label} onClick={()=>openStage(stage)} aria-label={'Abrir lotes: '+label}><div>{label}<Icon size={19}/></div><strong>{String(value).padStart(2,"0")}</strong><small>{label==="Falta item"?"Necessitam regularização":"Lotes nesta situação"}</small></button>)}</section>
      </section>
      <section className="lot-search"><Search size={20}/><input aria-label="Pesquisar lote, unidade ou descrição" placeholder="Buscar lote, unidade ou descrição..." value={query} onChange={e=>{setQuery(e.target.value);setStageFilter("Todos");}}/>{query&&<button aria-label="Limpar pesquisa" onClick={()=>setQuery("")}><X size={18}/></button>}<span>{query?'Buscando em todas as situações':'Consulta rápida da operação'}</span></section>
      <div className="request-tabs" role="tablist" aria-label="Situação das requisições">{["Todos",...STAGES].map((stage,i)=><button role="tab" aria-selected={stageFilter===stage} className={`${stageFilter===stage?"active":""} tab-${i}`} key={stage} onClick={()=>setStageFilter(stage)}><span>{stage}</span></button>)}</div>
      <div className="operation-grid"><section className="board-wrap"><div className="section-title"><div><small>PROGRAMAÇÃO DE LOTES</small><h2>{stageFilter==="Todos"?"Todas as requisições":stageFilter}</h2></div><span>{filtered.length} registros</span></div>{filtered.length?<><div className="shipment-table-head" aria-hidden="true"><span>Lote / unidade</span><span>Data</span><span>Quantidade</span><span>Descrição</span><span>Situação</span><span>Ações</span></div><div className="request-grid">{filtered.slice((currentPage-1)*12,currentPage*12).map(load=><LoadCard key={load.id} load={load} canWrite={!!canWrite} isAdmin={!!canWrite&&profile?.role==="admin"} onOpen={()=>setDetails(load)} onEdit={()=>setModal({...load,scheduled_at:load.scheduled_at.slice(0,16)})} onMove={move} onDelete={()=>setConfirmDelete(load)} onPhotoView={()=>setPhotoViewer(load)} photos={photos.filter(photo=>photo.shipment_id===load.id)}/>)}</div></>:<div className="empty-state"><Package/><h3>Nenhuma requisição nesta aba</h3><p>Use outra aba ou cadastre uma nova requisição.</p></div>}</section><aside className="queue"><div className="section-title"><h2><Clock size={19}/> Prioridades</h2><span>fila</span></div>{queue.length?queue.map((load,i)=><button key={load.id} onClick={()=>setDetails(load)}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{load.number} · {load.carrier}</strong><small>{load.status}</small></span></button>):<p className="empty">Nenhuma requisição na fila.</p>}</aside></div>
    </>}
    {view==="board"&&pageCount>1&&<div className="pager"><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Próxima</button></div>}
    {view==="dashboard"&&<OperationDashboard loads={loads} onExplore={(unit,status)=>{setQuery(unit);setStageFilter(status);setView("board");setPage(1);}}/>}
    {view==="history"&&<HistoryView audits={audits} loads={loads}/>}
    {view==="team"&&profile?.role==="admin"&&<TeamView profiles={profiles} current={profile} onRole={setUserRole} onToggle={toggleUser} demo={demo}/>}
    {modal&&<LoadModal value={modal} photos={photos.filter(photo=>photo.shipment_id===modal.id)} onChange={setModal} onClose={()=>setModal(null)} onDeletePhoto={removeLoadPhoto} onSubmit={saveLoad}/>}
    {details&&<Details load={details} late={isLate(details,now)} photos={photos.filter(photo=>photo.shipment_id===details.id)} audits={audits.filter(audit=>audit.shipment_id===details.id)} onClose={()=>setDetails(null)} onEdit={canWrite?()=>{setModal({...details,scheduled_at:details.scheduled_at.slice(0,16)});setDetails(null)}:undefined}/>}
    {photoViewer&&<PhotoViewer load={photoViewer} photos={photos.filter(photo=>photo.shipment_id===photoViewer.id)} onClose={()=>setPhotoViewer(null)}/>}
    {confirmDelete&&<Confirm number={confirmDelete.number} onClose={()=>setConfirmDelete(null)} onConfirm={removeLoad}/>}
    {importRows&&<PdfImportPreview rows={importRows} existing={new Set(loads.map(load=>load.number.trim().toLocaleLowerCase("pt-BR")))} onClose={()=>setImportRows(null)} onConfirm={confirmPdfImport}/>}
  </main>;
}

function PdfImportPreview({rows,existing,onClose,onConfirm}:{rows:ImportedShipmentRow[];existing:Set<string>;onClose:()=>void;onConfirm:()=>void}){const newCount=rows.filter(row=>!existing.has(row.lot.trim().toLocaleLowerCase("pt-BR"))).length;return <div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="modal pdf-preview"><div className="modal-title"><div><small>IMPORTAÇÃO DO PDF</small><h2>Conferir {rows.length} lotes encontrados</h2></div><button onClick={onClose}><X/></button></div><div className="pdf-table-wrap"><table><thead><tr><th>Data</th><th>Destino</th><th>Lote</th><th>Quantidade</th><th>Descrição</th></tr></thead><tbody>{rows.map((row,index)=>{const duplicate=existing.has(row.lot.trim().toLocaleLowerCase("pt-BR"));return <tr key={`${row.lot}-${index}`} className={duplicate?"duplicate":""}><td>{new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{row.destination}</td><td><b>{row.lot}</b>{duplicate&&<small>Já cadastrado</small>}</td><td>{row.quantity.toLocaleString("pt-BR")}</td><td>{row.description}</td></tr>})}</tbody></table></div><footer><span>{newCount} novos · {rows.length-newCount} duplicados</span><button onClick={onClose}>Cancelar</button><button className="primary" disabled={!newCount} onClick={onConfirm}>Importar {newCount} lotes</button></footer></section></div>}

function LoadCard({load,canWrite,isAdmin,onOpen,onEdit,onMove,onDelete,onPhotoView,photos}:{load:Shipment;canWrite:boolean;isAdmin:boolean;onOpen:()=>void;onEdit:()=>void;onMove:(l:Shipment,d:number)=>void;onDelete:()=>void;onPhotoView:()=>void;photos:ShipmentPhoto[]}){
 const done=load.status==='Concluído';
 return <article className={'load status-'+STAGES.indexOf(load.status)}>
 <button className="card-main" onClick={onOpen}><div><span className="lot-label"><i/> LOTE</span></div><b className="lot-number">{load.number}</b><h4>{load.carrier&&load.carrier!=='Não informado'?load.carrier:(load.notes||'Carga programada')}</h4></button>
 <div className="load-import-data"><span><small>Prazo</small>{new Date(load.scheduled_at).toLocaleDateString('pt-BR')}</span><span><small>Quantidade</small>{Number(load.volumes).toLocaleString('pt-BR')}</span><span className={new Date(load.scheduled_at).getTime()<Date.now()&&load.status!=='Concluído'?'due-alert':''}><small>Status do prazo</small><b>{new Date(load.scheduled_at).getTime()<Date.now()&&load.status!=='Concluído'?'Atenção: vencido':'Dentro do prazo'}</b>{photos[0]&&<button className="status-photo" title="Ver fotos da carga" onClick={onPhotoView}><img src={photos[0].url} alt={`Foto da carga do lote ${load.number}`}/><i>{photos.length}</i></button>}</span></div>
 <span className="row-status"><span className="status-chip">{load.status}</span></span>
 {canWrite&&<div className="card-actions">{canWrite&&!done&&<button className="primary action-main" onClick={()=>onMove(load,1)}>{load.status==='Pendente'?'Iniciar':load.status==='Falta item'?'Retomar':'Concluir'}</button>}{canWrite&&load.status==='Em processo'&&<button className="primary" onClick={()=>onMove(load,-1)}>Falta item</button>}{canWrite&&<button className="primary" onClick={onEdit}>Editar</button>}{isAdmin&&<button className="primary danger-action" onClick={onDelete}>Excluir</button>}</div>}
 </article>
}

function LoadModal({value,photos,onChange,onClose,onDeletePhoto,onSubmit}:{value:FormLoad;photos:ShipmentPhoto[];onChange:(v:FormLoad)=>void;onClose:()=>void;onDeletePhoto:(photo:ShipmentPhoto)=>void;onSubmit:(e:FormEvent<HTMLFormElement>,photos?:File[])=>void}){
  const [selectedPhotos,setSelectedPhotos]=useState<File[]>([]);
  const [previews,setPreviews]=useState<string[]>([]);
  const field=(key:keyof FormLoad,val:unknown)=>onChange({...value,[key]:val});
  function choosePhotos(event:ChangeEvent<HTMLInputElement>){
    const files=Array.from(event.target.files||[]);
    setSelectedPhotos(files);
    Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(new Error("Não foi possível ler a foto."));reader.readAsDataURL(file)}))).then(setPreviews).catch(()=>setPreviews([]));
  }
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal load-form simple-form" onSubmit={event=>onSubmit(event,selectedPhotos)}><div className="modal-title"><div><small>REQUISIÇÃO</small><h2>{value.id?`Editar lote ${value.number}`:"Nova requisição"}</h2></div><button type="button" onClick={onClose}><X/></button></div><div className="form-grid"><label>Lote<input autoFocus required placeholder="Ex.: 107.06" value={value.number} onChange={e=>field("number",e.target.value)}/></label><label>Qual unidade?<input required placeholder="Ex.: Petrolândia" value={value.carrier} onChange={e=>field("carrier",e.target.value)}/></label><label>Responsável<input placeholder="Nome do responsável" value={value.responsible} onChange={e=>field("responsible",e.target.value)}/></label><label>Motorista<input placeholder="Nome do motorista" value={value.driver} onChange={e=>field("driver",e.target.value)}/></label><label>Placa<input placeholder="ABC1D23" value={value.plate} onChange={e=>field("plate",e.target.value)}/></label><label className="wide">Observações<textarea rows={3} placeholder="Informações da carga" value={value.notes} onChange={e=>field("notes",e.target.value)}/></label>{photos.length>0&&<section className="wide saved-photos"><b>Fotos já adicionadas</b><div>{photos.map(photo=><figure key={photo.id}><img src={photo.url} alt={`Foto da carga do lote ${value.number}`}/><button type="button" onClick={()=>onDeletePhoto(photo)} aria-label="Excluir esta foto" title="Excluir foto"><X size={14}/></button></figure>)}</div><small>Clique no X de uma foto para excluí-la.</small></section>}<label className="wide photo-input">Adicionar fotos da carga<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={choosePhotos}/>{previews.length>0&&<section className="photo-drafts"><b>{previews.length} {previews.length===1?"foto selecionada":"fotos selecionadas"}</b><div>{previews.map((preview,index)=><figure key={`${selectedPhotos[index]?.name}-${index}`}><img src={preview} alt={`Prévia ${index+1} da foto da carga`}/><figcaption>{selectedPhotos[index]?.name}</figcaption></figure>)}</div><small>As fotos serão enviadas ao clicar em Salvar requisição.</small></section>}</label><label className="wide">Situação<select value={value.status} onChange={e=>field("status",e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label>{value.status==="Falta item"&&<label className="wide missing-field">Observação do item que falta *<textarea required rows={4} placeholder="Informe o nome, código e quantidade do item faltante" value={value.missing_item_notes} onChange={e=>field("missing_item_notes",e.target.value)}/></label>}</div><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Salvar requisição</button></footer></form></div>
}

function Details({load,onClose,onEdit,photos,audits}:{load:Shipment;late:boolean;onClose:()=>void;onEdit?:()=>void;photos:ShipmentPhoto[];audits:Audit[]}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal details simple-details"><div className="modal-title"><div><small>LOTE</small><h2>{load.number}</h2></div><button onClick={onClose}><X/></button></div><dl><div><dt>Unidade</dt><dd>{load.carrier==="Não informado"?"—":load.carrier||"—"}</dd></div><div><dt>Situação</dt><dd>{load.status}</dd></div><div><dt>Responsável</dt><dd>{load.responsible||"—"}</dd></div><div><dt>Motorista</dt><dd>{load.driver||"—"}</dd></div><div><dt>Placa</dt><dd>{load.plate||"—"}</dd></div><div><dt>Prazo</dt><dd>{new Date(load.scheduled_at).toLocaleString("pt-BR")}</dd></div>{load.notes&&<div className="wide"><dt>Observações</dt><dd>{load.notes}</dd></div>}</dl>{photos.length>0&&<section className="photo-gallery"><h3>Fotos da carga</h3><div>{photos.map(photo=><figure key={photo.id}><img src={photo.url} alt={`Foto da carga do lote ${load.number}`}/><figcaption>{new Date(photo.created_at).toLocaleString("pt-BR")}</figcaption></figure>)}</div></section>}<section className="lot-history"><h3>Movimentações</h3>{audits.length?audits.slice(0,6).map(item=><p key={item.id}><b>{item.action==="INSERT"?"Criado":"Atualizado"}</b> · {new Date(item.created_at).toLocaleString("pt-BR")}</p>):<p>Nenhuma movimentação registrada.</p>}</section><footer>{onEdit&&<button className="primary" onClick={onEdit}>Editar requisição</button>}</footer></section></div>}

function HistoryView({audits,loads}:{audits:Audit[];loads:Shipment[]}){const fallback=loads.slice(0,6).map((l,i)=>({id:i,shipment_id:l.id,shipment_number:l.number,action:i%3===0?"INSERT":"UPDATE",actor_name:["Marina Costa","Rafael Souza"][i%2],created_at:new Date(Date.now()-i*1800000).toISOString(),before_data:null,after_data:l})) as Audit[];const data=audits.length?audits:fallback;return <section className="page-view"><div className="heading"><div><p>RASTREABILIDADE</p><h1>Histórico e auditoria<span>.</span></h1><p>Registro protegido das alterações na operação.</p></div></div><div className="timeline">{data.map(a=><article key={a.id}><span><History/></span><div><strong>{a.actor_name||"Sistema"} · {actionLabel[a.action]||a.action} a carga #{a.shipment_number}</strong><p>{a.after_data?.status&&`Status: ${a.after_data.status}`}</p><small>{new Date(a.created_at).toLocaleString("pt-BR")}</small></div></article>)}</div></section>}

function TeamView({profiles,current,onRole,onToggle,demo}:{profiles:Profile[];current:Profile;onRole:(p:Profile,r:Role)=>void;onToggle:(p:Profile)=>void;demo:boolean}){const data:Profile[]=profiles.length?profiles:[current,{id:"operator",name:"Rafael Souza",role:"operador",active:true},{id:"viewer",name:"Lucas Martins",role:"visualizador",active:true}];return <section className="page-view"><div className="heading"><div><p>ADMINISTRAÇÃO</p><h1>Equipe e acessos<span>.</span></h1><p>Defina quem pode visualizar, operar e administrar.</p></div></div><div className="team-table"><div className="table-head"><span>Usuário</span><span>Perfil</span><span>Status</span></div>{data.map(p=><article key={p.id}><div><span className="avatar">{p.name.slice(0,2).toUpperCase()}</span><strong>{p.name}</strong>{p.id===current.id&&<small>Você</small>}</div><select aria-label={`Perfil de ${p.name}`} value={p.role} disabled={p.id===current.id} onChange={e=>onRole(p,e.target.value as Role)}><option value="visualizador">Visualizador</option><option value="operador">Operador</option><option value="admin">Admin</option></select><button disabled={demo||p.id===current.id} onClick={()=>onToggle(p)} className={p.active?"status-active":"status-off"}>{p.active?"Ativo":"Inativo"}</button></article>)}</div><div className="role-help"><h3>Permissões</h3><p><b>Visualizador</b> acompanha o painel e o histórico. <b>Operador</b> cadastra, edita e movimenta cargas. <b>Admin</b> também exclui cargas e gerencia a equipe.</p></div></section>}

function Confirm({number,onClose,onConfirm}:{number:string;onClose:()=>void;onConfirm:()=>void}){return <div className="overlay"><section className="modal confirm"><AlertTriangle/><h2>Excluir carga #{number}?</h2><p>Esta ação será registrada na auditoria e não poderá ser desfeita.</p><footer><button onClick={onClose}>Cancelar</button><button className="danger" onClick={onConfirm}>Excluir definitivamente</button></footer></section></div>}

function DemoAccess({password,setPassword,submit,error}:{password:string;setPassword:(value:string)=>void;submit:(event:FormEvent)=>void;error:string}){return <main className="access-page"><form className="access-card" onSubmit={submit}><div className="access-brand"><img src="/packem-mark.png" alt=""/><span>PACKEM<small>OPERAÇÕES</small></span></div><p className="access-eyebrow">CENTRAL DE EXPEDIÇÃO</p><h1>Acesso ao painel</h1><p className="access-copy">Informe a senha da operação para continuar.</p>{error&&<div className="access-error">{error}</div>}<label>Senha<input autoFocus type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Digite a senha" required/></label><button className="primary" type="submit">Entrar</button><small className="access-footer">Ambiente demonstrativo protegido</small></form></main>}

function DemoUnlock({password,setPassword,submit,onClose,error}:{password:string;setPassword:(value:string)=>void;submit:(event:FormEvent)=>void;onClose:()=>void;error:string}){return <div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><form className="modal unlock-modal" onSubmit={submit}><div className="modal-title"><div><small>CONTROLE DE ALTERAÇÕES</small><h2>Liberar operação</h2></div><button type="button" onClick={onClose}><X/></button></div><p>Digite a senha para movimentar os lotes e registrar falta de item.</p>{error&&<div className="access-error">{error}</div>}<label>Senha<input autoFocus type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Digite a senha" required/></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Liberar alterações</button></footer></form></div>}

function Login({login,setLogin,submit,message}:{login:{email:string;password:string};setLogin:(v:{email:string;password:string})=>void;submit:(e:FormEvent)=>void;message:string}){return <main className="login-page"><section className="login-art"><div className="brand"><img src="/packem-mark.png" alt=""/><span>PACKEM<small>OPERAÇÕES</small></span></div><div><p>CENTRAL LOGÍSTICA</p><h1>Operação visível.<br/><span>Decisões mais rápidas.</span></h1><p>Acompanhe cargas, docas e atrasos em tempo real.</p></div></section><form className="login-card" onSubmit={submit}><small>ACESSO À OPERAÇÃO</small><h2>Bem-vindo de volta</h2><p>Entre com seu usuário autorizado.</p>{message&&<div className="warning">{message}</div>}<label>E-mail<input type="email" required value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/></label><label>Senha<input type="password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label><button className="primary" type="submit">Entrar no painel</button><p className="login-note"><ShieldCheck size={15}/> Acesso controlado por perfil</p></form></main>}






function PhotoViewer({load,photos,onClose}:{load:Shipment;photos:ShipmentPhoto[];onClose:()=>void}){
 const [selected,setSelected]=useState<ShipmentPhoto|null>(null);
 return <div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="modal photo-viewer"><div className="modal-title"><div><small>FOTOS DA CARGA</small><h2>Lote {load.number}</h2></div><button onClick={onClose}><X/></button></div><div className="photo-gallery">{photos.length?<div>{photos.map(photo=><button className="gallery-photo" key={photo.id} onClick={()=>setSelected(photo)} title="Abrir foto em tamanho grande"><img src={photo.url} alt={`Foto da carga do lote ${load.number}`}/><small>{new Date(photo.created_at).toLocaleString("pt-BR")}</small></button>)}</div>:<p>Nenhuma foto cadastrada.</p>}</div>{selected&&<div className="image-lightbox" onMouseDown={event=>event.target===event.currentTarget&&setSelected(null)}><button className="image-close" onClick={()=>setSelected(null)} aria-label="Fechar foto"><X/></button><img src={selected.url} alt={`Foto ampliada da carga do lote ${load.number}`}/><p>{new Date(selected.created_at).toLocaleString("pt-BR")}</p></div>}</section></div>
}