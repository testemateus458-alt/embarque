import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTableLines, parseShipmentPdfPages} from '../lib/pdf-table.ts';
import {planShipmentImport} from '../lib/shipment-import.ts';
import {dayKey, scheduledTimestamp, shipmentDay} from '../lib/shipment-calendar.ts';

const text = (str,x,y,width=16,height=5) => ({str,transform:[height,0,0,height,x,y],width,height});
const horizontal = (x1,x2,y) => ({x1,x2,y1:y,y2:y});
const vertical = (x,y1,y2) => ({x1:x,x2:x,y1,y2});

// Unequal merged cells with no gap between days reproduce the weekly report.
// The fixture contains synthetic lot and product data only.
function fixture(groups, {rotated=true, downward=false}={}) {
  const top=560, cols=[10,30,130,170,210,400,550];
  const items=[text('SEMANA 28/09/2026 À 02/10/2026',220,590,120)];
  const lines=cols.map(x=>vertical(x,20,top+20));
  ['DATA','DESTINO','LOTE','QUANTIDADE','DESCRIÇÃO','INF. ADICIONAIS'].forEach((str,i)=>items.push(text(str,(cols[i]+cols[i+1])/2-6,top+8,12,4)));
  lines.push(horizontal(cols[0],cols.at(-1),top));
  let y=top, number=1;
  groups.forEach(([date,count],group)=>{
    const bottom=y-count*12, center=(y+bottom)/2;
    const marker=rotated?text(`${date} dia de embarque`,18,center-2.5,48):text(date,14,center-2.5,12);
    if(rotated) { marker.transform=downward?[0,-5,5,0,18,center+24]:[0,5,-5,0,23,center-24]; }
    items.push(marker,text(`UNIDADE ${group+1}`,50,center-2.5,42));
    lines.push(horizontal(cols[0],cols.at(-1),bottom));
    for(let n=0;n<count;n++){
      const rowY=y-(n+.5)*12-2.5;
      items.push(text(`${number++}.09/26`,136,rowY,24),text(n===0?'1.000':'50',177,rowY,18));
      items.push(text('PRODUTO',220,rowY,35),text('- LINER INTERNO',256,rowY,60));
      items.push(text('ATUALIZADO 25/09/2026',410,rowY,110));
      if(n<count-1) lines.push(horizontal(cols[2],cols.at(-1),y-(n+1)*12));
    }
    y=bottom;
  });
  // PDF text extraction order is not guaranteed to match visual order.
  return {items:items.reverse(),lines};
}

test('weekly PDF assigns all 37 lots to their printed date, including boundary rows',()=>{
  const rows=parseShipmentPdfPages([fixture([['28/09/26',10],['29/09/26',8],['30/09/26',8],['01/10/26',5],['02/10/26',6]])]);
  const counts=Object.fromEntries(['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02'].map(date=>[date,rows.filter(r=>r.date===date).length]));
  assert.deepEqual(counts,{'2026-09-28':10,'2026-09-29':8,'2026-09-30':8,'2026-10-01':5,'2026-10-02':6});
  assert.equal(rows[25].date,'2026-09-30');
  assert.equal(rows[26].date,'2026-10-01');
  assert.equal(rows[0].quantity,1000);
  assert.equal(rows[1].quantity,50);
  assert.equal(rows[0].destination,'UNIDADE 1');
  assert.equal(rows[0].description,'PRODUTO - LINER INTERNO');
  for(const row of rows) assert.equal(dayKey(new Date(scheduledTimestamp(row.date)).toISOString()),row.date);
});

test('horizontal dates and clockwise vertical dates both identify merged cells',()=>{
  for(const options of [{rotated:false},{downward:true}]) {
    const rows=parseShipmentPdfPages([fixture([['31/12/2026',2],['02/01/2027',1]],options)]);
    assert.deepEqual(rows.map(r=>r.date),['2026-12-31','2026-12-31','2027-01-02']);
  }
});

test('separate pages use their own printed dates, including skipped days',()=>{
  const rows=parseShipmentPdfPages([fixture([['28/09/26',1]]),fixture([['02/10/26',2]])]);
  assert.deepEqual(rows.map(r=>r.date),['2026-09-28','2026-10-02','2026-10-02']);
});

test('unit split into multiple PDF text fragments stays attached to every lot in its merged cell',()=>{
  const page=fixture([['28/09/26',2]]);
  const original=page.items.find(item=>item.str==='UNIDADE 1');
  page.items=page.items.filter(item=>item!==original);
  page.items.push(text('AG',50,original.transform[5],9),text('TEXTIL',62,original.transform[5],25));
  assert.deepEqual(parseShipmentPdfPages([page]).map(row=>row.destination),['AG TEXTIL','AG TEXTIL']);
});

test('missing dates reject import instead of assigning the heading week to every lot',()=>{
  const page=fixture([['28/09/26',2]]);
  page.items=page.items.filter(i=>!i.str.includes('dia de embarque'));
  assert.throws(()=>parseShipmentPdfPages([page]),/data do lote/);
});

test('invalid dates or unreadable quantities reject the entire import',()=>{
  assert.throws(()=>parseShipmentPdfPages([fixture([['31/09/26',1]])]),/Data inválida/);
  const page=fixture([['28/09/26',1]]);
  page.items=page.items.filter(i=>i.str!=='1.000');
  assert.throws(()=>parseShipmentPdfPages([page]),/quantidade ou a descrição/);
});

test('table borders honor PDF transforms and ignore colored cell backgrounds',()=>{
  const ops={save:1,restore:2,transform:3,constructPath:4,stroke:20,fill:23};
  const rectangle=(x,y,w,h)=>new Float32Array([0,x,y,1,x+w,y,1,x+w,y+h,1,x,y+h,4]);
  const list={fnArray:[3,1,3,4,2,4,4],argsArray:[
    [2,0,0,-2,10,100],null,[1,0,0,1,5,0],
    [23,[rectangle(0,10,100,.1)]],null,
    [23,[rectangle(0,20,100,.1)]],
    [23,[rectangle(0,30,100,10)]],
  ]};
  const lines=extractTableLines(list,ops);
  assert.equal(lines.length,4);
  assert.deepEqual(lines[0],{x1:20,y1:80,x2:220,y2:80});
  assert.deepEqual(lines[2],{x1:10,y1:60,x2:210,y2:60});
});

const row={date:'2026-09-30',destination:'UNIDADE 1',lot:'1.09/26',quantity:1000,description:'PRODUTO'};
test('reimport corrects the existing date and adds only new lot numbers',()=>{
  const existing=[{id:'saved',number:' 1.09/26 ',date:'2026-09-28',version:3,carrier:'UNIDADE 1',destination:'UNIDADE 1',status:'Em processo',photo_url:'photo',started_at:'start'}];
  const before=structuredClone(existing);
  const plan=planShipmentImport([row,{...row,lot:'2.09/26'}],existing);
  assert.deepEqual(plan.newRows.map(r=>r.lot),['2.09/26']);
  assert.deepEqual(plan.updates,[{id:'saved',version:3,previousDate:'2026-09-28',previousUnit:'UNIDADE 1',dateChanged:true,unitChanged:false,row}]);
  assert.deepEqual(existing,before);
  const updated={...existing[0],scheduled_at:scheduledTimestamp(plan.updates[0].row.date)};
  assert.equal(updated.status,'Em processo');
  assert.equal(updated.photo_url,'photo');
  assert.equal(updated.started_at,'start');
});

test('a repeated import is a no-op and completed lots retain their actual calendar date',()=>{
  const existing=[{id:'saved',number:row.lot,date:row.date,version:4,carrier:row.destination,destination:row.destination}];
  const plan=planShipmentImport([row,row],existing);
  assert.equal(plan.unchanged.length,1);
  assert.equal(plan.newRows.length,0);
  assert.equal(plan.updates.length,0);
  const completed={scheduled_at:scheduledTimestamp(row.date),status:'Concluído',shipped_at:'2026-10-01T10:00:00-03:00'};
  assert.equal(shipmentDay(completed),'2026-10-01');
});

test('reimport repairs missing or incorrect units without changing the lot status',()=>{
  const existing=[{id:'saved',number:row.lot,date:row.date,version:4,carrier:'Não informado',destination:'PETROLÂNDIA',status:'Falta item',missing_item_notes:'Saia',photo_url:'photo'}];
  const plan=planShipmentImport([row],existing);
  assert.equal(plan.newRows.length,0);
  assert.equal(plan.updates.length,1);
  assert.equal(plan.updates[0].unitChanged,true);
  assert.equal(plan.updates[0].dateChanged,false);
  assert.equal(plan.updates[0].row.destination,'UNIDADE 1');
  assert.equal(existing[0].status,'Falta item');
  assert.equal(existing[0].photo_url,'photo');
  assert.equal(planShipmentImport([row],[{...existing[0],carrier:'UNIDADE 1 ',destination:'UNIDADE 1 '}]).updates.length,1);
});

test('ambiguous duplicate lots reject changes instead of overwriting unrelated records',()=>{
  assert.throws(()=>planShipmentImport([row,{...row,date:'2026-10-01'}],[]),/dados diferentes/);
  assert.throws(()=>planShipmentImport([row],[{id:'a',number:row.lot,date:row.date,version:1,carrier:row.destination,destination:row.destination},{id:'b',number:row.lot,date:row.date,version:1,carrier:row.destination,destination:row.destination}]),/mais de um cadastro/);
});
