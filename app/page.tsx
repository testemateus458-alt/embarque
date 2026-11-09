"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"; import { createClient } from "@supabase/supabase-js";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, ClipboardCopy, Clock,
  History, Lock, Monitor, Package, Plus, Search,
  ShieldCheck, Upload, X
} from "lucide-react";
import {ShipmentWeek} from "@/components/shipment-week";
import {dayKey,weekStart,addDays,scheduledTimestamp,shipmentDay,shortDate,longDate} from "@/lib/shipment-calendar";
import previewDates from "@/lib/preview-dates.json";
import previewSnapshot from "@/lib/preview-snapshot.json";
import {PhotoViewer, PhotoGallery} from "@/components/gallery-viewer";
import {AnimatedNumber} from "@/components/animated-number";
import {DailySummary} from "@/components/daily-summary";
type Shipment={id:string;number:string;nf:string;destination:string;carrier:string;driver:string;plate:string;vehicle:string;dock_id:number|null;scheduled_at:string;volumes:number;weight:number;responsible:string;notes:string;missing_item_notes:string;status:string;version:number;started_at?:string|null;shipped_at?:string|null;created_at?:string;updated_at?:string;photo_url?:string|null};
type ShipmentPhoto={id:string;shipment_id:string;url:string;created_at:string};
type Audit={id:number;shipment_id:string;shipment_number:string;action:string;actor_name:string;created_at:string;before_data:Shipment|null;after_data:Shipment|null};
type Dock={id:number;name:string};
const localPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";
const supabase:any = !localPreview && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.replace(".supabase.com",".supabase.co"), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;
const demoDocks:Array<Dock>=Array.from({length:6},(_,i)=>({id:i+1,name:"Doca 0"+(i+1)}));
function demoLoads():Shipment[]{return previewSnapshot.loads as Shipment[];}
import { STAGES, assertDockAvailable, isLate, validateShipment } from "@/lib/domain.mjs";

import {OperationDashboard} from '@/components/operation-dashboard';
import {parseShipmentPdf, type ImportedShipmentRow} from '@/lib/pdf-import';
import {planShipmentImport, lotKey} from '@/lib/shipment-import';

type FormLoad = Omit<Shipment, "id" | "version"> & { id?: string; version?: number };
const emptyLoad = (): FormLoad => ({ number:"", nf:"", destination:"", carrier:"", driver:"", plate:"", vehicle:"Requisição", dock_id:null, scheduled_at:scheduledTimestamp(dayKey(new Date())), volumes:0, weight:0, responsible:"", notes:"", missing_item_notes:"", status:"Pendente" });
const actionLabel: Record<string,string> = { INSERT:"Cadastrou", UPDATE:"Atualizou", DELETE:"Excluiu" };
const EDIT_PASSWORD_KEY = "packem-edit-password";
const DEMO_PASSWORD = "162424";
const EDITOR_NAME = "Edição com senha";
const isWrongPassword = (error: unknown) => (error as { code?: string } | null)?.code === "28P01";

export default function Home() {
  const demo = !supabase;
  const [loads,setLoads] = useState<Shipment[]>(demo?demoLoads():[]);
  const [photos,setPhotos] = useState<ShipmentPhoto[]>(localPreview ? previewSnapshot.photos : []);
  const [docks,setDocks] = useState<Dock[]>(demo?demoDocks:[]);
  const [audits,setAudits] = useState<Audit[]>([]);
  const [view,setView] = useState<"board"|"dashboard"|"history">("board");
  const [tv,setTv] = useState(false); useEffect(()=>{const sync=()=>setTv(Boolean(document.fullscreenElement));document.addEventListener("fullscreenchange",sync);return()=>document.removeEventListener("fullscreenchange",sync)},[]);
  const [query,setQuery] = useState("");
  const [page,setPage] = useState(1);
  const [stageFilter,setStageFilter] = useState("Pendente");
  const [calendarWeek,setCalendarWeek]=useState(()=>weekStart(dayKey(new Date())));
  const [calendarDay,setCalendarDay]=useState("");
  const [allDates,setAllDates]=useState(false);
  function selectCalendar(week:string,day:string,all=false){setCalendarWeek(week);setCalendarDay(day);setAllDates(all);setPage(1)}
  function revealDate(value:string){const day=dayKey(value);if(day)selectCalendar(weekStart(day),day)}
  const scheduledLoads=useMemo(()=>loads.filter(load=>{const day=shipmentDay(load);return allDates|| (calendarDay?calendarDay==="undated"?!day:day===calendarDay:day>=calendarWeek&&day<addDays(calendarWeek,7))}),[loads,calendarWeek,calendarDay,allDates]);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const tabs=tabsRef.current;if(!tabs)return;
    const update=()=>{const active=tabs.querySelector<HTMLElement>('[aria-selected="true"]');if(!active)return;tabs.style.setProperty('--tab-x',`${active.offsetLeft}px`);tabs.style.setProperty('--tab-width',`${active.offsetWidth}px`);tabs.dataset.indicator='ready';if(tabs.scrollWidth>tabs.clientWidth)tabs.scrollTo({left:active.offsetLeft-(tabs.clientWidth-active.offsetWidth)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})};
    update();const observer=new ResizeObserver(update);observer.observe(tabs);return()=>observer.disconnect();
  },[stageFilter,view]);
  useEffect(()=>setPage(1),[query,stageFilter]);
  const [connection,setConnection] = useState(demo?'Teste local':'Conectando');
  const [showFilters,setShowFilters] = useState(false);
  const [modal,setModal] = useState<FormLoad|null>(null);
  const [details,setDetails] = useState<Shipment|null>(null);
  const [summaryDay,setSummaryDay] = useState<string|null>(null);
  const [photoViewer,setPhotoViewer] = useState<Shipment|null>(null);
  const [confirmDelete,setConfirmDelete] = useState<Shipment|null>(null);
  const [importRows,setImportRows] = useState<ImportedShipmentRow[]|null>(null);
  const [importing,setImporting] = useState(false);
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(!demo);
  const [now,setNow] = useState(0);
  const [demoReady,setDemoReady] = useState(false);
  // Senha de edição liberada neste navegador. A conferência real é feita no banco (funções edit_*).
  const [editPassword,setEditPassword] = useState("");
  const [unlockOpen,setUnlockOpen] = useState(false);
  const [unlocking,setUnlocking] = useState(false);
  const [demoPassword,setDemoPassword] = useState("");
  const [accessError,setAccessError] = useState("");
  const canWrite = Boolean(editPassword);
  useEffect(()=>{try{const saved=localStorage.getItem(EDIT_PASSWORD_KEY);if(saved)setEditPassword(saved)}catch{}},[]);
  function lockEditing(notice=""){setEditPassword("");try{localStorage.removeItem(EDIT_PASSWORD_KEY)}catch{}if(notice)setMessage(notice)}
  function handleWriteError(error:unknown,fallback:string){if(isWrongPassword(error)){lockEditing("Senha de edição inválida ou alterada. Digite a senha novamente.");setAccessError("");setUnlockOpen(true);return}setMessage((error as {message?:string}|null)?.message||fallback)}

  useEffect(()=>{ setNow(Date.now()); const timer=setInterval(()=>setNow(Date.now()),1000); return()=>clearInterval(timer); },[]);
  useEffect(()=>{if(!demo)return;try{const saved=localStorage.getItem("packem-original-refined-loads-v1");if(saved)setLoads((JSON.parse(saved) as Shipment[]).map(load=>localPreview&&load.scheduled_at==="2026-09-22T12:00:00.000Z"?{...load,scheduled_at:(previewDates as Record<string,string>)[load.number]?scheduledTimestamp((previewDates as Record<string,string>)[load.number]):""}:load))}catch{}finally{setDemoReady(true)}},[demo]);

  useEffect(()=>{if(demo&&demoReady){try{localStorage.setItem("packem-original-refined-loads-v1",JSON.stringify(loads))}catch{setMessage("Armazenamento local cheio. Alterações disponíveis nesta sessão.")}}},[demo,demoReady,loads]);
  useEffect(()=>{if(!demo)return;try{const stored=localStorage.getItem("packem-original-refined-photos-v1");if(stored)setPhotos(JSON.parse(stored))}catch{}},[demo]);
  useEffect(()=>{if(!demo||!demoReady)return;try{localStorage.setItem("packem-original-refined-photos-v1",JSON.stringify(photos))}catch{setMessage("Fotos disponíveis nesta sessão. O armazenamento local está cheio.")}},[photos,demo,demoReady]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(""),6500);return()=>clearTimeout(timer)},[message]);
  useEffect(()=>{
    if(!modal&&!details&&!photoViewer&&!confirmDelete&&!unlockOpen&&!importRows&&!summaryDay)return;
    const previous=document.activeElement as HTMLElement|null;
    const previousBodyOverflow=document.body.style.overflow;const previousHtmlOverflow=document.documentElement.style.overflow;document.body.style.overflow="hidden";document.documentElement.style.overflow="hidden";
    const focusTimer=setTimeout(()=>document.querySelector<HTMLElement>('.overlay input, .overlay button')?.focus(),0);
    const handle=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){if(event.target instanceof HTMLInputElement && event.target.type==="file")return;if(document.querySelector('.image-lightbox'))return;setModal(null);setDetails(null);setPhotoViewer(null);setConfirmDelete(null);setUnlockOpen(false);setImportRows(null);setSummaryDay(null)}
      if(event.key==="Tab"){
        const scope=document.querySelector('.image-lightbox')||document.querySelector('.overlay');
        const items=Array.from(scope?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]')||[]);
        if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1]?.focus()}
        else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0]?.focus()}
      }
    };
    document.addEventListener("keydown",handle);
    return()=>{clearTimeout(focusTimer);document.body.style.overflow=previousBodyOverflow;document.documentElement.style.overflow=previousHtmlOverflow;document.removeEventListener("keydown",handle);previous?.focus()};
  },[!!modal,!!details,!!photoViewer,!!confirmDelete,!!unlockOpen,!!importRows,!!summaryDay]);
  useEffect(()=>{
    if(!supabase) return;
    // Leitura pública: qualquer visitante carrega a programação e recebe as mudanças em tempo real.
    void reload();
    let pending:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{clearTimeout(pending);pending=setTimeout(()=>void reload(),250)};
    const channel=supabase.channel("nexo-operation")
      .on("postgres_changes",{event:"*",schema:"public",table:"shipments"},schedule)
      .on("postgres_changes",{event:"*",schema:"public",table:"shipment_photos"},schedule)
      .on("postgres_changes",{event:"*",schema:"public",table:"audit_log"},()=>void reloadAudit())
      .subscribe((status:string)=>{setConnection(status==='SUBSCRIBED'?'Conectado':'Reconectando');if(status==='SUBSCRIBED')void reload()});
    // Segurança extra caso o tempo real caia: atualiza a cada 30 s.
    const refresh=setInterval(()=>void reload(),30000);
    return()=>{clearTimeout(pending);clearInterval(refresh);void supabase!.removeChannel(channel)};
  },[]);

  async function reload(){
    if(!supabase)return;
    const [l,d,pics]=await Promise.all([
      supabase.from("shipments").select("*").order("scheduled_at"),
      supabase.from("docks").select("*").order("id"),
      supabase.from("shipment_photos").select("*").order("created_at",{ascending:false})
    ]);
    if(l.error||d.error){setMessage('Não foi possível atualizar os embarques. Verifique a conexão; tentaremos novamente.');setConnection('Reconectando');setLoading(false);return;}
    setLoads((l.data||[]) as Shipment[]);setDocks((d.data||[]) as Dock[]);if(!pics.error)setPhotos((pics.data||[]) as ShipmentPhoto[]);setLoading(false);
    void reloadAudit();
  }
  async function reloadAudit(){if(!supabase)return;const {data}=await supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200);setAudits((data||[]) as Audit[])}

  const filtered=useMemo(()=>scheduledLoads.filter(load=>{
    const hay=[load.number,load.carrier,load.notes,load.missing_item_notes,load.driver,load.plate].join(" ").toLowerCase();
    return (!query||hay.includes(query.toLowerCase())) && (Boolean(query)||load.status===stageFilter);
  }),[scheduledLoads,query,stageFilter]);
  const late=filtered.filter(l=>isLate(l,now));
  const pageCount=Math.max(1,Math.ceil(filtered.length/12));
  const currentPage=Math.min(page,pageCount);
  const queue=[...filtered].filter(l=>l.status!=="Concluído").sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)).slice(0,5);

  async function saveLoad(event:FormEvent<HTMLFormElement>,stagedPhotos:File[]=[]){
    event.preventDefault(); if(!modal||!canWrite)return;if(!dayKey(modal.scheduled_at)){setMessage("Informe a data do embarque.");return;}
    const previous=modal.id?loads.find(load=>load.id===modal.id):undefined;
    const candidate={...modal,destination:modal.carrier,volumes:Number(modal.volumes)||0,weight:0,dock_id:null,scheduled_at:new Date(modal.scheduled_at).toISOString(),shipped_at:modal.status==="Concluído"?(modal.shipped_at||new Date().toISOString()):null} as Shipment;
    if(loads.some(x=>x.id!==candidate.id&&x.number.trim().toLowerCase()===candidate.number.trim().toLowerCase())){setMessage('Já existe uma requisição com este lote. Edite o registro existente.');return;}
    try{validateShipment(candidate);assertDockAvailable(candidate,loads)}catch(error){setMessage((error as Error).message);return}
    if(demo){
      let saved:Shipment;
      if(candidate.id){
        saved={...candidate,version:(previous?.version||candidate.version||0)+1,updated_at:new Date().toISOString()};
        setLoads(v=>v.map(x=>x.id===candidate.id?{...x,...saved}:x));
        setAudits(v=>[{id:Date.now(),shipment_id:candidate.id!,shipment_number:candidate.number,action:"UPDATE",actor_name:EDITOR_NAME,created_at:new Date().toISOString(),before_data:previous||null,after_data:saved},...v]);
      }else{
        saved={...candidate,id:crypto.randomUUID(),version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        setLoads(v=>[...v,saved]);
        setAudits(v=>[{id:Date.now(),shipment_id:saved.id,shipment_number:saved.number,action:"INSERT",actor_name:EDITOR_NAME,created_at:new Date().toISOString(),before_data:null,after_data:saved},...v]);
      }
      if(stagedPhotos.length)await Promise.all(stagedPhotos.map(photo=>uploadLoadPhoto(saved,photo)));
      revealDate(shipmentDay(saved));setStageFilter(candidate.status);setDetails(null);setModal(null);setMessage(`Lote ${candidate.number}: ${candidate.status}.`);return;
    }
    const payload:Record<string,unknown>={...candidate};delete payload.photo_url;delete payload.created_at;delete payload.updated_at;delete payload.started_at;
    if(!candidate.id){delete payload.id;delete payload.version;}
    const result=await supabase!.rpc("edit_save_shipment",{p_password:editPassword,p_data:payload});
    if(result.error){if(result.error.code==="23505")setMessage("Número ou doca já está em uso.");else handleWriteError(result.error,"Não foi possível salvar o lote.");return}
    if(!result.data?.id){setMessage("A carga foi alterada por outra pessoa. Atualizamos os dados; revise antes de salvar novamente.");await reload();return}
    if(stagedPhotos.length&&result.data)await Promise.all(stagedPhotos.map(photo=>uploadLoadPhoto(result.data as Shipment,photo)));
    revealDate(shipmentDay((result.data||candidate) as Shipment));setStageFilter(candidate.status);setDetails(null);setModal(null);setMessage(`Lote ${candidate.number}: ${candidate.status}.`);await reload();
  }
  async function uploadLoadPhoto(load:Shipment,file?:File){
    if(!file||!canWrite)return;
    if(!file.type.startsWith("image/")){setMessage("Escolha uma imagem JPG, PNG ou WEBP.");return;}
    if(file.size>5*1024*1024){setMessage("A foto deve ter no máximo 5 MB.");return;}
    try{
      if(demo){const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não foi possível ler a foto."));reader.readAsDataURL(file)});const photo={id:crypto.randomUUID(),shipment_id:load.id,url,created_at:new Date().toISOString()};setPhotos(current=>[photo,...current]);setLoads(current=>current.map(item=>item.id===load.id?{...item,photo_url:url,updated_at:new Date().toISOString()}:item));setMessage(`Foto adicionada ao lote ${load.number}.`);return;}
      const extension=(file.name.split(".").pop()||"jpg").toLowerCase();
      // O banco confere a senha e libera o envio de um arquivo neste caminho por alguns minutos.
      const ticket=await supabase!.rpc("edit_photo_upload_ticket",{p_password:editPassword,p_shipment_id:load.id,p_extension:extension});
      if(ticket.error)throw ticket.error;
      const path=ticket.data as string;
      const {error:uploadError}=await supabase!.storage.from("carga-fotos").upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError)throw uploadError;
      const {data:urlData}=supabase!.storage.from("carga-fotos").getPublicUrl(path);
      const {error:saveError}=await supabase!.rpc("edit_add_photo",{p_password:editPassword,p_shipment_id:load.id,p_url:urlData.publicUrl});
      if(saveError)throw saveError;
      setMessage(`Foto adicionada ao lote ${load.number}.`);await reload();
    }catch(error){handleWriteError(error,"Não foi possível enviar a foto.");}
  }

  async function removeLoadPhoto(photo:ShipmentPhoto){
    if(!canWrite)return;
    if(demo){setPhotos(current=>current.filter(item=>item.id!==photo.id));return;}
    const {data:storagePath,error}=await supabase!.rpc("edit_delete_photo",{p_password:editPassword,p_photo_id:photo.id});
    if(error){handleWriteError(error,"A foto não foi removida. Tente novamente.");return;}
    setPhotos(current=>current.filter(item=>item.id!==photo.id));
    if(storagePath)await supabase!.storage.from("carga-fotos").remove([storagePath as string]);
    await reload();
    setMessage("Foto removida da carga.");
  }

  async function move(load:Shipment,direction:number){const status=direction===1?(load.status==='Pendente'?'Em processo':load.status==='Falta item'?'Em processo':'Concluído'):'Falta item';if(!canWrite)return;setModal({...load,status,shipped_at:status==='Concluído'?(load.shipped_at||scheduledTimestamp(dayKey(new Date()))):null})}
  function openStage(stage:string){setQuery("");setStageFilter(stage);setPage(1);window.setTimeout(()=>document.querySelector('.operation-grid')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}
  async function removeLoad(){if(!confirmDelete||!canWrite)return;if(demo){setLoads(v=>v.filter(x=>x.id!==confirmDelete.id));setConfirmDelete(null);return}const {error}=await supabase!.rpc("edit_delete_shipment",{p_password:editPassword,p_id:confirmDelete.id});if(error){setConfirmDelete(null);handleWriteError(error,"Não foi possível excluir o lote.")}else{setConfirmDelete(null);await reload()}}
  async function unlockEditing(event:FormEvent){
    event.preventDefault();if(unlocking)return;
    const password=demoPassword.trim();if(!password){setAccessError("Digite a senha.");return}
    setUnlocking(true);setAccessError("");
    try{
      if(demo){if(password!==DEMO_PASSWORD){setAccessError("Senha inválida. Tente novamente.");return}}
      else{const {error}=await supabase!.rpc("edit_check_password",{p_password:password});if(error){setAccessError(isWrongPassword(error)?"Senha inválida. Tente novamente.":"Não foi possível conferir a senha agora. Tente novamente.");return}}
      setEditPassword(password);try{localStorage.setItem(EDIT_PASSWORD_KEY,password)}catch{}
      setDemoPassword("");setUnlockOpen(false);setMessage("Edição liberada neste navegador.");
    }finally{setUnlocking(false)}
  }
  async function readPdf(file?:File){if(!file)return;setImporting(true);setMessage("");try{const rows=await parseShipmentPdf(file);planShipmentImport(rows,loads.map(load=>({id:load.id,number:load.number,date:dayKey(load.scheduled_at),version:load.version,carrier:load.carrier,destination:load.destination})));setImportRows(rows)}catch(error){setMessage((error as Error).message)}finally{setImporting(false)}}
  async function confirmPdfImport() {
    if (!importRows || !canWrite || importing) return;
    setImporting(true);
    let created = 0, corrected = 0;
    try {
      const plan = planShipmentImport(importRows, loads.map(load => ({ id: load.id, number: load.number, date: dayKey(load.scheduled_at), version: load.version, carrier: load.carrier, destination: load.destination })));
      const fresh = plan.newRows.map(row => ({
        id: crypto.randomUUID(), number: row.lot, nf: "", destination: row.destination, carrier: row.destination,
        driver: "", plate: "", vehicle: "Kit", dock_id: null, scheduled_at: scheduledTimestamp(row.date),
        volumes: row.quantity, weight: 0, responsible: "", notes: row.description,
        missing_item_notes: "", status: "Pendente", version: 1,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } satisfies Shipment));
      if (!fresh.length && !plan.updates.length) {
        setMessage("Todos os lotes desse PDF já estão cadastrados com data e unidade corretas.");
        setImportRows(null);
        return;
      }
      if (demo) {
        const updates = new Map(plan.updates.map(change => [change.id, change]));
        setLoads(current => [...fresh, ...current.map(load => {
          const change = updates.get(load.id);
          return change ? { ...load, ...(change.dateChanged ? { scheduled_at: scheduledTimestamp(change.row.date) } : {}), ...(change.unitChanged ? { carrier: change.row.destination, destination: change.row.destination } : {}), version: load.version + 1, updated_at: new Date().toISOString() } : load;
        })]);
        created = fresh.length; corrected = plan.updates.length;
      } else {
        const payload = fresh.map(({ id, version, created_at, updated_at, ...row }) => row);
        const updates = plan.updates.map(change => ({ id: change.id, version: change.version, number: change.row.lot, ...(change.dateChanged ? { scheduled_at: scheduledTimestamp(change.row.date) } : {}), ...(change.unitChanged ? { carrier: change.row.destination, destination: change.row.destination } : {}) }));
        // Tudo ou nada: o banco confere a senha e grava os lotes numa única operação.
        const { data, error } = await supabase!.rpc("edit_import_shipments", { p_password: editPassword, p_new: payload, p_updates: updates });
        if (error) { if (isWrongPassword(error)) { setImportRows(null); handleWriteError(error, ""); return; } throw error; }
        created = Number(data?.created) || 0; corrected = Number(data?.corrected) || 0;
        await reload();
      }
      setImportRows(null);
      selectCalendar(weekStart(importRows[0].date), "");
      setStageFilter("Pendente");
      setMessage(`${created} lotes novos · ${corrected} lotes com data ou unidade corrigida.`);
    } catch (error) {
      if (!demo) { try { await reload(); } catch {} }
      const reason = error instanceof Error ? error.message : (error as { message?: string })?.message || "Falha de conexão ao salvar os lotes.";
      setMessage(`${reason}${created || corrected ? ` Já foram salvos: ${created} lotes novos e ${corrected} lotes corrigidos. Reenvie o PDF para concluir.` : ""}`);
    } finally {
      setImporting(false);
    }
  }

  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,opts?:unknown)=>void}}).modelContext;
    if(!context?.registerTool)return; const abort=new AbortController();
    try{context.registerTool({name:"list_shipments",title:"Listar cargas",description:"Lista as cargas visíveis no painel de embarques.",inputSchema:{type:"object",properties:{status:{type:"string"}},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:{status?:string})=>loads.filter(l=>!input.status||l.status===input.status).map(({id,number,destination,status,scheduled_at,dock_id})=>({id,number,destination,status,scheduled_at,dock_id}))},{signal:abort.signal})}catch{}
    return()=>abort.abort();
  },[loads]);


  if(loading)return <div className="loading"><Activity className="spin"/> Sincronizando operação…</div>;
  return <main className={`shell original-polish ${tv?"tv":""}`}>
    <div className="ambient-grid" aria-hidden="true"><i/><i/><i/></div>
    <header><button className="brand" onClick={()=>setView("board")}><img src="/packem-mark.png" alt=""/><span>PACKEM<small>OPERAÇÕES</small></span></button><span className="live"><i/> {connection.toUpperCase()}</span><nav><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}><Activity size={16}/> Dashboard</button><button className={view==="board"?"active":""} onClick={()=>setView("board")}>Operação</button></nav>{canWrite?<button className="unlock-button unlocked" title="Edição liberada neste navegador" onClick={()=>lockEditing("Edição bloqueada neste navegador.")}><Lock size={16}/> Bloquear edição</button>:<button className="unlock-button" onClick={()=>{setAccessError("");setDemoPassword("");setUnlockOpen(true)}}><ShieldCheck size={16}/> Liberar edição</button>}<button onClick={async()=>{if(tv){await document.exitFullscreen?.();setTv(false);}else{try{await document.documentElement.requestFullscreen?.();setTv(true);}catch{setTv(false);}}}}><Monitor size={16}/> {tv?"Sair da TV":"Modo TV"}</button></header>
    {demo&&<div className="notice"><ShieldCheck size={16}/> Prévia local do site original · alterações de teste ficam neste navegador</div>}
    {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage("")}><X size={16}/></button></div>}
    {unlockOpen&&<DemoUnlock password={demoPassword} setPassword={setDemoPassword} submit={event=>void unlockEditing(event)} busy={unlocking} onClose={()=>setUnlockOpen(false)} error={accessError}/>}
    {view==="board"&&<>
      <section className="command-hero">
      <section className="heading"><div><p>PACKEM / CENTRAL DE EXPEDIÇÃO</p><h1>Controle de expedição<span>.</span></h1><p><i className="pulse-dot"/> Programação e acompanhamento dos lotes</p></div><div className="ops-live"><span><i/> {localPreview?"PRÉVIA DA OPERAÇÃO":"OPERAÇÃO AO VIVO"}</span><b>{now?new Date(now).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"--:--:--"}</b><small>{now?new Date(now).toLocaleDateString("pt-BR"):"Sincronizando"}</small></div><div className="heading-actions"><button type="button" onClick={()=>setSummaryDay(calendarDay&&calendarDay!=="undated"?calendarDay:dayKey(new Date()))}><ClipboardCopy size={18}/> Resumo diário</button>{canWrite&&<><label className={`pdf-upload ${importing?"disabled":""}`}><Upload size={18}/>{importing?"Lendo PDF…":"Carregar romaneio"}<input type="file" accept="application/pdf,.pdf" disabled={importing} onChange={event=>{void readPdf(event.target.files?.[0]);event.currentTarget.value=""}}/></label><button className="primary" onClick={()=>setModal({...emptyLoad(),scheduled_at:scheduledTimestamp((calendarDay&&calendarDay!=="undated"?calendarDay:!allDates&&calendarWeek!==weekStart(dayKey(new Date()))?calendarWeek:dayKey(new Date())))})}><Plus size={18}/> Adicionar lote</button></>}</div></section>
      <section className="kpis">{[["Pendentes","Pendente",scheduledLoads.filter(x=>x.status==="Pendente").length,Clock],["Em processo","Em processo",scheduledLoads.filter(x=>x.status==="Em processo").length,Activity],["Falta item","Falta item",scheduledLoads.filter(x=>x.status==="Falta item").length,AlertTriangle],["Concluídos","Concluído",scheduledLoads.filter(x=>x.status==="Concluído").length,ArrowUpRight]].map(([label,stage,value,Icon]:any)=><button type="button" className={`kpi-action ${stageFilter===stage?"is-selected":""}`} key={label} onClick={()=>openStage(stage)} aria-label={'Abrir lotes: '+label}><div>{label}<Icon size={19}/></div><strong><AnimatedNumber value={value} pad={2}/></strong><small>{label==="Falta item"?"Necessitam regularização":"Lotes nesta situação"}</small></button>)}</section>
      </section>
      <section className="lot-search"><Search size={20}/><input aria-label="Pesquisar lote, unidade ou descrição" placeholder="Buscar lote, unidade ou descrição..." value={query} onChange={e=>{setQuery(e.target.value);}}/>{query&&<button aria-label="Limpar pesquisa" onClick={()=>setQuery("")}><X size={18}/></button>}<span>{query?'Buscando lotes em todas as situações':'Consulta rápida da operação'}</span></section>
      <ShipmentWeek loads={loads} week={calendarWeek} selected={calendarDay} all={allDates} onSelect={selectCalendar}/>
      <div className="request-tabs" ref={tabsRef} role="tablist" aria-label="Situação das requisições">{STAGES.map((stage,i)=><button role="tab" aria-selected={!query&&stageFilter===stage} className={`${!query&&stageFilter===stage?"active":""} tab-${i}`} key={stage} onClick={()=>{setQuery("");setStageFilter(stage)}}><span>{stage}</span></button>)}</div>
      <div className="operation-grid"><section className="board-wrap"><div className="section-title"><div><small>PROGRAMAÇÃO DE LOTES</small><h2>{query?"Resultados da busca":stageFilter}</h2></div><span>{calendarDay==="undated"?"Sem data · ":calendarDay?`${shortDate(calendarDay)} · `:allDates?"Todas as datas · ":"Nesta semana · "}{filtered.length} registros</span></div>{filtered.length?<><div className="shipment-table-head" aria-hidden="true"><span>Lote / unidade</span><span>Data</span><span>Quantidade</span><span>Descrição</span><span>Situação</span><span>Ações</span></div><div className="request-grid" key={`${calendarWeek}-${calendarDay}-${stageFilter}-${currentPage}`}>{filtered.slice((currentPage-1)*12,currentPage*12).map(load=><LoadCard key={load.id} load={load} canWrite={!!canWrite} isAdmin={!!canWrite} onOpen={()=>setDetails(load)} onEdit={()=>setModal({...load,scheduled_at:load.scheduled_at})} onMove={move} onDelete={()=>setConfirmDelete(load)} onPhotoView={()=>setPhotoViewer(load)} photos={photos.filter(photo=>photo.shipment_id===load.id)}/>)}</div></>:<div className="empty-state"><Package/><h3>Nenhuma requisição nesta aba</h3><p>Escolha outro dia, outra situação ou adicione um lote nesta programação.</p></div>}</section><aside className="queue"><div className="section-title"><h2><Clock size={19}/> Prioridades</h2><span>fila</span></div>{queue.length?queue.map((load,i)=><button key={load.id} onClick={()=>setDetails(load)}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{load.number} · {load.carrier}</strong><small>{load.status}</small></span></button>):<p className="empty">Nenhuma requisição na fila.</p>}</aside></div>
    </>}
    {view==="board"&&pageCount>1&&<div className="pager"><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Anterior</button><span>{currentPage} / {pageCount}</span><button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>Próxima</button></div>}
    {view==="dashboard"&&<OperationDashboard loads={loads} onExplore={(unit,status)=>{setAllDates(true);setCalendarDay("");setQuery(unit);setStageFilter(status);setView("board");setPage(1);}}/>}
    {view==="history"&&<HistoryView audits={audits} loads={loads}/>}
    {summaryDay&&<DailySummary loads={loads} initialDay={summaryDay} onClose={()=>setSummaryDay(null)}/>}
    {modal&&<LoadModal value={modal} photos={photos.filter(photo=>photo.shipment_id===modal.id)} onChange={setModal} onClose={()=>setModal(null)} onDeletePhoto={removeLoadPhoto} onSubmit={saveLoad}/>}
    {details&&<Details load={details} late={isLate(details,now)} photos={photos.filter(photo=>photo.shipment_id===details.id)} audits={audits.filter(audit=>audit.shipment_id===details.id)} onClose={()=>setDetails(null)} onEdit={canWrite?()=>{setModal({...details,scheduled_at:details.scheduled_at});setDetails(null)}:undefined}/>}
    {photoViewer&&<PhotoViewer load={photoViewer} photos={photos.filter(photo=>photo.shipment_id===photoViewer.id)} onClose={()=>setPhotoViewer(null)}/>}
    {confirmDelete&&<Confirm number={confirmDelete.number} onClose={()=>setConfirmDelete(null)} onConfirm={removeLoad}/>}
    {importRows&&<PdfImportPreview rows={importRows} existing={loads} busy={importing} onClose={()=>{if(!importing)setImportRows(null)}} onConfirm={confirmPdfImport}/>}
  </main>;
}

function PdfImportPreview({ rows, existing, busy, onClose, onConfirm }: { rows: ImportedShipmentRow[]; existing: Shipment[]; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  let plan: ReturnType<typeof planShipmentImport> = { newRows: [], updates: [], unchanged: [] };
  let error = "";
  try {
    plan = planShipmentImport(rows, existing.map(load => ({ id: load.id, number: load.number, date: dayKey(load.scheduled_at), version: load.version, carrier: load.carrier, destination: load.destination })));
  } catch (reason) { error = (reason as Error).message; }
  const updates = new Map(plan.updates.map(change => [lotKey(change.row.lot), change]));
  const unchanged = new Set(plan.unchanged.map(row => lotKey(row.lot)));
  const count = plan.newRows.length + plan.updates.length;
  return <div className="overlay" onMouseDown={event => !busy && event.target === event.currentTarget && onClose()}>
    <section className="modal pdf-preview">
      <div className="modal-title"><div><small>IMPORTAÇÃO DO PDF</small><h2>Conferir {rows.length} lotes encontrados</h2></div><button disabled={busy} aria-label="Fechar janela" onClick={onClose}><X/></button></div>
      <p>Ao reenviar um romaneio, as datas e unidades dos lotes existentes serão corrigidas. Situação, fotos e data de finalização serão preservadas.</p>
      {error && <div className="access-error">{error}</div>}
      <div className="pdf-table-wrap"><table>
        <thead><tr><th>Data prevista</th><th>Destino</th><th>Lote</th><th>Quantidade</th><th>Descrição</th></tr></thead>
        <tbody>{rows.map((row, index) => {
          const update = updates.get(lotKey(row.lot)), same = unchanged.has(lotKey(row.lot));
          return <tr key={`${row.lot}-${index}`} className={same ? "duplicate" : ""}>
            <td>{longDate(row.date)}{update?.dateChanged && <small>Antes: {update.previousDate ? shortDate(update.previousDate) : "sem data"}</small>}</td>
            <td>{row.destination}{update?.unitChanged && <small>Antes: {update.previousUnit || "não informada"}</small>}</td><td><b>{row.lot}</b><small>{update ? [update.dateChanged ? "Corrigir data" : "",update.unitChanged ? "Corrigir unidade" : ""].filter(Boolean).join(" e ") : same ? "Já cadastrado · data e unidade corretas" : "Novo lote"}</small></td>
            <td>{row.quantity.toLocaleString("pt-BR")}</td><td>{row.description}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <footer><span>{plan.newRows.length} novos · {plan.updates.filter(change=>change.dateChanged).length} datas · {plan.updates.filter(change=>change.unitChanged).length} unidades a corrigir · {plan.unchanged.length} já corretos</span><button disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || !count || !!error} onClick={onConfirm}>{busy ? "Salvando…" : `Confirmar ${count} lotes`}</button></footer>
    </section>
  </div>;
}

function LoadCard({load,canWrite,isAdmin,onOpen,onEdit,onMove,onDelete,onPhotoView,photos}:{load:Shipment;canWrite:boolean;isAdmin:boolean;onOpen:()=>void;onEdit:()=>void;onMove:(l:Shipment,d:number)=>void;onDelete:()=>void;onPhotoView:()=>void;photos:ShipmentPhoto[]}){
 const done=load.status==='Concluído';
 return <article className={'load status-'+STAGES.indexOf(load.status)} onPointerMove={event=>{if(event.pointerType!=="mouse")return;const rect=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty("--pointer-x",`${event.clientX-rect.left}px`);event.currentTarget.style.setProperty("--pointer-y",`${event.clientY-rect.top}px`)}}>
 <button className="card-main" aria-label={`Abrir lote ${load.number}`} onClick={onOpen}><div><span className="lot-label"><i/> LOTE</span></div><b className="lot-number">{load.number}</b><h4>{load.carrier&&load.carrier!=='Não informado'?load.carrier:(load.notes||'Carga programada')}</h4></button>
 <div className="load-import-data"><span><small>Quantidade</small>{Number(load.volumes).toLocaleString('pt-BR')}<small className="shipment-schedule">{shipmentDay(load)?`${shortDate(shipmentDay(load))} · ${new Date(load.status==='Concluído'&&load.shipped_at?load.shipped_at:load.scheduled_at).toLocaleDateString("pt-BR",{weekday:"short",timeZone:"America/Sao_Paulo"})}`:"Data a definir"}</small></span><span className="cargo-progress"><small>Situação da carga</small><b>{load.status==='Concluído'?'Expedição finalizada':load.status==='Em processo'?'Carga em preparação':load.status==='Falta item'?'Aguardando itens':'Aguardando início'}</b>{photos[0]&&<button className="status-photo" title="Ver fotos da carga" aria-label={`Ver ${photos.length} fotos do lote ${load.number}`} onClick={onPhotoView}><img src={photos[0].url} alt={`Foto da carga do lote ${load.number}`}/><i>{photos.length}</i></button>}</span>{load.status==="Falta item"&&<p className="missing-item-alert"><small>Item faltante</small><b>{load.missing_item_notes?.trim()||"Item não informado"}</b></p>}</div>
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
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form role="dialog" aria-modal="true" aria-label={value.id?`Editar lote ${value.number}`:"Adicionar lote"} className="modal load-form simple-form" onSubmit={event=>onSubmit(event,selectedPhotos)}><div className="modal-title"><div><small>REQUISIÇÃO</small><h2>{value.id?`Editar lote ${value.number}`:"Nova requisição"}</h2></div><button type="button" aria-label="Fechar janela" onClick={onClose}><X/></button></div><div className="form-grid"><label>Data do embarque<input type="date" required value={dayKey(value.scheduled_at)} onChange={e=>field("scheduled_at",e.target.value?scheduledTimestamp(e.target.value):"")}/></label><label>Lote<input autoFocus required placeholder="Ex.: 107.06" value={value.number} onChange={e=>field("number",e.target.value)}/></label>{value.status==="Concluído"&&<label>Data da finalização<input type="date" required value={dayKey(value.shipped_at||"")} onChange={e=>field("shipped_at",e.target.value?scheduledTimestamp(e.target.value):null)}/></label>}<label>Qual unidade?<input required placeholder="Ex.: Petrolândia" value={value.carrier} onChange={e=>field("carrier",e.target.value)}/></label><label>Responsável<input placeholder="Nome do responsável" value={value.responsible} onChange={e=>field("responsible",e.target.value)}/></label><label>Motorista<input placeholder="Nome do motorista" value={value.driver} onChange={e=>field("driver",e.target.value)}/></label><label>Quantidade<input type="number" min="0" value={value.volumes} onChange={e=>field("volumes",Number(e.target.value))}/></label><label>Placa<input placeholder="ABC1D23" value={value.plate} onChange={e=>field("plate",e.target.value)}/></label><label className="wide">Observações<textarea rows={3} placeholder="Informações da carga" value={value.notes} onChange={e=>field("notes",e.target.value)}/></label>{photos.length>0&&<section className="wide saved-photos"><b>Fotos já adicionadas</b><div>{photos.map(photo=><figure key={photo.id}><img src={photo.url} alt={`Foto da carga do lote ${value.number}`}/><button type="button" onClick={()=>onDeletePhoto(photo)} aria-label="Excluir esta foto" title="Excluir foto"><X size={14}/></button></figure>)}</div><small>Clique no X de uma foto para excluí-la.</small></section>}<label className="wide photo-input">Adicionar fotos da carga<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={choosePhotos}/>{previews.length>0&&<section className="photo-drafts"><b>{previews.length} {previews.length===1?"foto selecionada":"fotos selecionadas"}</b><div>{previews.map((preview,index)=><figure key={`${selectedPhotos[index]?.name}-${index}`}><img src={preview} alt={`Prévia ${index+1} da foto da carga`}/><figcaption>{selectedPhotos[index]?.name}</figcaption></figure>)}</div><small>As fotos serão enviadas ao clicar em Salvar requisição.</small></section>}</label><label className="wide">Situação<select value={value.status} onChange={e=>onChange({...value,status:e.target.value,shipped_at:e.target.value==="Concluído"?(value.shipped_at||scheduledTimestamp(dayKey(new Date()))):null})}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label>{value.status==="Falta item"&&<label className="wide missing-field">Observação do item que falta *<textarea required rows={4} placeholder="Informe o nome, código e quantidade do item faltante" value={value.missing_item_notes} onChange={e=>field("missing_item_notes",e.target.value)}/></label>}</div><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Salvar requisição</button></footer></form></div>
}

function Details({load,onClose,onEdit,photos,audits}:{load:Shipment;late:boolean;onClose:()=>void;onEdit?:()=>void;photos:ShipmentPhoto[];audits:Audit[]}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section role="dialog" aria-modal="true" aria-label={`Detalhes do lote ${load.number}`} className="modal details simple-details"><div className="modal-title"><div><small>LOTE</small><h2>{load.number}</h2></div><button aria-label="Fechar janela" onClick={onClose}><X/></button></div><dl><div className="wide"><dt>Data do embarque</dt><dd>{longDate(dayKey(load.scheduled_at))}</dd></div>{load.status==="Concluído"&&load.shipped_at&&<div className="wide"><dt>Data da finalização</dt><dd>{longDate(dayKey(load.shipped_at))}</dd></div>}<div><dt>Unidade</dt><dd>{load.carrier==="Não informado"?"—":load.carrier||"—"}</dd></div><div><dt>Situação</dt><dd>{load.status}</dd></div><div><dt>Responsável</dt><dd>{load.responsible||"—"}</dd></div><div><dt>Motorista</dt><dd>{load.driver||"—"}</dd></div><div><dt>Placa</dt><dd>{load.plate||"—"}</dd></div><div><dt>Quantidade</dt><dd>{Number(load.volumes).toLocaleString("pt-BR")}</dd></div>{load.status==="Falta item"&&<div className="wide missing-detail"><dt>Item faltante</dt><dd>{load.missing_item_notes?.trim()||"Item não informado"}</dd></div>}{load.notes&&<div className="wide"><dt>Observações</dt><dd>{load.notes}</dd></div>}</dl>{photos.length>0&&<section className="photo-gallery"><h3>Fotos da carga</h3><PhotoGallery photos={photos} number={load.number}/></section>}<section className="lot-history"><h3>Movimentações</h3>{audits.length?audits.slice(0,6).map(item=><p key={item.id}><b>{item.action==="INSERT"?"Criado":"Atualizado"}</b> · {new Date(item.created_at).toLocaleString("pt-BR")}</p>):<p>Nenhuma movimentação registrada.</p>}</section><footer>{onEdit&&<button className="primary" onClick={onEdit}>Editar requisição</button>}</footer></section></div>}

function HistoryView({audits,loads}:{audits:Audit[];loads:Shipment[]}){const fallback=loads.slice(0,6).map((l,i)=>({id:i,shipment_id:l.id,shipment_number:l.number,action:i%3===0?"INSERT":"UPDATE",actor_name:["Marina Costa","Rafael Souza"][i%2],created_at:new Date(Date.now()-i*1800000).toISOString(),before_data:null,after_data:l})) as Audit[];const data=audits.length?audits:fallback;return <section className="page-view"><div className="heading"><div><p>RASTREABILIDADE</p><h1>Histórico e auditoria<span>.</span></h1><p>Registro protegido das alterações na operação.</p></div></div><div className="timeline">{data.map(a=><article key={a.id}><span><History/></span><div><strong>{a.actor_name||"Sistema"} · {actionLabel[a.action]||a.action} a carga #{a.shipment_number}</strong><p>{a.after_data?.status&&`Status: ${a.after_data.status}`}</p><small>{new Date(a.created_at).toLocaleString("pt-BR")}</small></div></article>)}</div></section>}

function Confirm({number,onClose,onConfirm}:{number:string;onClose:()=>void;onConfirm:()=>void}){return <div className="overlay"><section className="modal confirm"><AlertTriangle/><h2>Excluir carga #{number}?</h2><p>Esta ação será registrada na auditoria e não poderá ser desfeita.</p><footer><button onClick={onClose}>Cancelar</button><button className="danger" onClick={onConfirm}>Excluir definitivamente</button></footer></section></div>}

function DemoUnlock({password,setPassword,submit,onClose,error,busy}:{password:string;setPassword:(value:string)=>void;submit:(event:FormEvent)=>void;onClose:()=>void;error:string;busy:boolean}){return <div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><form className="modal unlock-modal" onSubmit={submit}><div className="modal-title"><div><small>CONTROLE DE ALTERAÇÕES</small><h2>Digite a senha para editar</h2></div><button type="button" aria-label="Fechar janela" onClick={onClose}><X/></button></div><p>Todos podem acompanhar os embarques. Para adicionar, editar, excluir, mover lotes, enviar fotos ou importar romaneio, informe a senha. A edição fica liberada neste navegador até você clicar em Bloquear edição.</p>{error&&<div className="access-error">{error}</div>}<label>Senha<input autoFocus type="password" inputMode="numeric" autoComplete="off" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Digite a senha" required/></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy?"Conferindo…":"Liberar edição"}</button></footer></form></div>}
