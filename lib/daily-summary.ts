export type SummaryShipment = {
  id:string;
  number:string;
  carrier:string;
  destination:string;
  volumes:number;
  status:string;
  scheduled_at:string;
  shipped_at?:string|null;
  missing_item_notes:string;
};

export const summaryStages=["Pendente","Em processo","Falta item","Concluído"];
export const formatSummaryNumber=(value:number)=>value.toLocaleString("pt-BR");
export const formatSummaryDate=(date:string)=>date?`${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`:"sem data";
const clean=(value:string|undefined)=>String(value||"").replace(/\s+/g," ").trim();
const meaningful=(value:string)=>value && !/^(?:n[aã]o informado|n[aã]o informada|—|-)$/i.test(value);
export function shipmentUnit(load:SummaryShipment){
  const carrier=clean(load.carrier), destination=clean(load.destination);
  return meaningful(carrier)?carrier:meaningful(destination)?destination:"Unidade não informada";
}

export function buildDailySummary(loads:SummaryShipment[],date:string,dayKey:(value:string)=>string){
  const rows=loads.filter(load=>{
    if(!date)return false;
    if(load.status==="Concluído")return !!load.shipped_at&&dayKey(load.shipped_at)===date;
    const planned=dayKey(load.scheduled_at);
    return ["Pendente","Em processo","Falta item"].includes(load.status)&&!!planned&&planned<=date;
  }).sort((a,b)=>shipmentUnit(a).localeCompare(shipmentUnit(b),"pt-BR")||dayKey(a.scheduled_at).localeCompare(dayKey(b.scheduled_at))||a.number.localeCompare(b.number,"pt-BR",{numeric:true}));
  const counts=Object.fromEntries(summaryStages.map(stage=>[stage,rows.filter(load=>load.status===stage).length])) as Record<string,number>;
  const quantity=rows.reduce((sum,load)=>sum+(Number(load.volumes)||0),0);
  const message=[
    `RESUMO DE EMBARQUES - ${formatSummaryDate(date)}`,
    `Total: ${rows.length} ${rows.length===1?"lote":"lotes"}, ${formatSummaryNumber(quantity)} peças`,
    `Concluídos: ${counts.Concluído} | Em processo: ${counts["Em processo"]} | Falta item: ${counts["Falta item"]} | Pendentes: ${counts.Pendente}`,
    "Em aberto até a data; concluídos no dia.",
  ];
  if(!rows.length) message.push("","Nenhuma pendência até esta data nem conclusão neste dia.");
  else {
    const groups=new Map<string,SummaryShipment[]>();
    for(const load of rows){const unit=shipmentUnit(load);groups.set(unit,[...(groups.get(unit)||[]),load]);}
    for(const [unit,group] of groups){
      const unitQuantity=group.reduce((sum,load)=>sum+(Number(load.volumes)||0),0);
      message.push("",`${unit} - ${group.length} ${group.length===1?"lote":"lotes"}, ${formatSummaryNumber(unitQuantity)} peças`);
      for(const load of group){
        const planned=dayKey(load.scheduled_at);
        const plannedNote=planned&&planned!==date?` - Previsto: ${formatSummaryDate(planned)}`:"";
        const missing=load.status==="Falta item"?`: ${clean(load.missing_item_notes)||"item não informado"}`:"";
        message.push(`${clean(load.number)} - ${formatSummaryNumber(Number(load.volumes)||0)} peças - ${clean(load.status)||"Situação não informada"}${plannedNote}${missing}`);
      }
    }
  }
  return {rows,counts,quantity,message:message.join("\n")};
}
