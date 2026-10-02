"use client";

import {useMemo, useState} from "react";
import {ClipboardCopy, ExternalLink, X} from "lucide-react";
import {buildDailySummary, formatSummaryNumber, shipmentUnit, summaryStages, type SummaryShipment} from "@/lib/daily-summary";
import {dayKey} from "@/lib/shipment-calendar";

export function DailySummary({loads,initialDay,onClose}:{loads:SummaryShipment[];initialDay:string;onClose:()=>void}){
  const [date,setDate]=useState(initialDay);
  const [copyMessage,setCopyMessage]=useState("");
  const {rows,counts,quantity,message:summary}=useMemo(()=>buildDailySummary(loads,date,dayKey),[loads,date]);

  async function copy(){
    try{
      await navigator.clipboard.writeText(summary);
      setCopyMessage("Resumo copiado. Cole na conversa do WhatsApp.");
    }catch{
      const field=document.querySelector<HTMLTextAreaElement>(".daily-summary-preview");
      field?.select();
      setCopyMessage("Selecione o texto e pressione Ctrl+C para copiar.");
    }
  }

  return <div className="overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <section className="modal daily-summary" role="dialog" aria-modal="true" aria-label="Resumo diário de embarques">
      <div className="modal-title"><div><small>ACOMPANHAMENTO DIÁRIO</small><h2>Resumo para WhatsApp</h2></div><button type="button" aria-label="Fechar resumo" onClick={onClose}><X/></button></div>
      <div className="daily-summary-controls"><label>Data programada<input type="date" value={date} onChange={event=>{setDate(event.target.value);setCopyMessage("")}}/></label><p>Mostra a situação atual de todos os lotes programados para o dia, inclusive os concluídos.</p></div>
      <div className="daily-summary-stats"><strong>{rows.length} lotes</strong><strong>{formatSummaryNumber(quantity)} peças</strong>{summaryStages.map(stage=><span key={stage}>{stage}: <b>{counts[stage]}</b></span>)}</div>
      <div className="daily-summary-table-wrap"><table><thead><tr><th>Lote</th><th>Unidade</th><th>Qtd.</th><th>Situação</th><th>Item faltante</th></tr></thead><tbody>{rows.length?rows.map(load=><tr key={load.id}><td><b>{load.number}</b></td><td>{shipmentUnit(load)}</td><td>{formatSummaryNumber(Number(load.volumes)||0)}</td><td>{load.status}</td><td className={load.status==="Falta item"?"daily-summary-missing":""}>{load.status==="Falta item"?load.missing_item_notes?.trim()||"Não informado":"—"}</td></tr>):<tr><td colSpan={5}>Nenhum lote programado para esta data.</td></tr>}</tbody></table></div>
      <label className="daily-summary-text-label">Mensagem pronta<textarea className="daily-summary-preview" readOnly value={summary}/></label>
      {copyMessage&&<p className="daily-summary-feedback" role="status">{copyMessage}</p>}
      <footer><button type="button" onClick={()=>void copy()}><ClipboardCopy size={16}/> Copiar mensagem</button><a className="daily-summary-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Abrir WhatsApp</a></footer>
    </section>
  </div>;
}
