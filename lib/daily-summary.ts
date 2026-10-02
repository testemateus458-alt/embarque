export type SummaryShipment = {
  id:string;
  number:string;
  carrier:string;
  destination:string;
  volumes:number;
  status:string;
  scheduled_at:string;
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
  const rows=loads.filter(load=>dayKey(load.scheduled_at)===date).sort((a,b)=>shipmentUnit(a).localeCompare(shipmentUnit(b),"pt-BR")||a.number.localeCompare(b.number,"pt-BR",{numeric:true}));
  const counts=Object.fromEntries(summaryStages.map(stage=>[stage,rows.filter(load=>load.status===stage).length])) as Record<string,number>;
  const quantity=rows.reduce((sum,load)=>sum+(Number(load.volumes)||0),0);
  const message=[
    `*EMBARQUES | ${formatSummaryDate(date)}*`,
    `*${rows.length} ${rows.length===1?"lote":"lotes"} • ${formatSummaryNumber(quantity)} peças*`,
    `✅ Concluídos: ${counts.Concluído} | 🔄 Em processo: ${counts["Em processo"]}`,
    `⚠️ Falta item: ${counts["Falta item"]} | ⏳ Pendentes: ${counts.Pendente}`,
  ];
  const missing=rows.filter(load=>load.status==="Falta item");
  if(missing.length){
    message.push("","*⚠️ FALTAS DE ITEM*");
    for(const load of missing) message.push(`• *${clean(load.number)} — ${shipmentUnit(load)}*: ${clean(load.missing_item_notes)||"item não informado"}`);
  }
  if(!rows.length) message.push("","Nenhum lote programado para esta data.");
  else {
    message.push("","*LOTES POR UNIDADE*");
    const groups=new Map<string,SummaryShipment[]>();
    for(const load of rows){const unit=shipmentUnit(load);groups.set(unit,[...(groups.get(unit)||[]),load]);}
    for(const [unit,group] of groups){
      const unitQuantity=group.reduce((sum,load)=>sum+(Number(load.volumes)||0),0);
      message.push("",`*${unit}* — ${group.length} ${group.length===1?"lote":"lotes"} • ${formatSummaryNumber(unitQuantity)} peças`);
      for(const load of group){
        const icon=load.status==="Concluído"?"✅":load.status==="Falta item"?"⚠️":load.status==="Em processo"?"🔄":"⏳";
        message.push(`• ${icon} ${clean(load.number)} — ${formatSummaryNumber(Number(load.volumes)||0)} peças — ${clean(load.status)||"Situação não informada"}`);
        if(load.status==="Falta item")message.push(`  Falta: ${clean(load.missing_item_notes)||"item não informado"}`);
      }
    }
  }
  return {rows,counts,quantity,message:message.join("\n")};
}
