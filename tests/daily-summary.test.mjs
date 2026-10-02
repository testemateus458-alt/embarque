import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailySummary,shipmentUnit} from '../lib/daily-summary.ts';
import {dayKey} from '../lib/shipment-calendar.ts';

test('plain WhatsApp report includes every scheduled unit, status and missing-item note',()=>{
  const base={carrier:'',destination:'',volumes:5000,missing_item_notes:'',scheduled_at:'2026-10-02T12:00:00-03:00'};
  const loads=[
    {...base,id:'a',number:'9.10/26',carrier:'Não informado',destination:'UBERABA',status:'Falta item',missing_item_notes:'Falta saia'},
    {...base,id:'b',number:'10.10/26',carrier:'PETROLÂNDIA',destination:'PETROLÂNDIA',status:'Concluído',shipped_at:'2026-10-02T17:00:00-03:00'},
    {...base,id:'c',number:'11.10/26',carrier:'Não informado',destination:'Não informado',status:'Pendente'},
    {...base,id:'d',number:'12.10/26',carrier:'ESTEIO',destination:'ESTEIO',status:'Em processo',scheduled_at:'2026-10-01T12:00:00-03:00'},
  ];
  const report=buildDailySummary(loads,'2026-10-02',dayKey);
  assert.equal(report.rows.length,4);
  assert.equal(report.quantity,20000);
  assert.equal(report.counts['Falta item'],1);
  assert.match(report.message,/UBERABA - 1 lote, 5\.000 peças/);
  assert.match(report.message,/PETROLÂNDIA - 1 lote, 5\.000 peças/);
  assert.match(report.message,/Unidade não informada - 1 lote, 5\.000 peças/);
  assert.match(report.message,/9\.10\/26 - 5\.000 peças - Falta item: Falta saia/);
  assert.match(report.message,/ESTEIO - 1 lote, 5\.000 peças/);
  assert.match(report.message,/12\.10\/26 - 5\.000 peças - Em processo - Previsto: 01\/10\/2026/);
  assert(!/[\p{Extended_Pictographic}*•]/u.test(report.message));
  assert.equal(shipmentUnit(loads[0]),'UBERABA');
});

test('open backlog carries forward while completed lots appear only on their completion day',()=>{
  const base={carrier:'AURORA',destination:'AURORA',volumes:1000,missing_item_notes:''};
  const loads=[
    {...base,id:'old-open',number:'1.10/26',status:'Pendente',scheduled_at:'2026-09-29T12:00:00-03:00'},
    {...base,id:'today-open',number:'2.10/26',status:'Falta item',scheduled_at:'2026-10-02T12:00:00-03:00',missing_item_notes:'Saia'},
    {...base,id:'future-open',number:'3.10/26',status:'Em processo',scheduled_at:'2026-10-03T12:00:00-03:00'},
    {...base,id:'done-today',number:'4.10/26',status:'Concluído',scheduled_at:'2026-09-28T12:00:00-03:00',shipped_at:'2026-10-03T02:00:00Z'},
    {...base,id:'done-earlier',number:'5.10/26',status:'Concluído',scheduled_at:'2026-09-28T12:00:00-03:00',shipped_at:'2026-10-01T09:00:00-03:00'},
    {...base,id:'done-no-date',number:'6.10/26',status:'Concluído',scheduled_at:'2026-10-02T12:00:00-03:00',shipped_at:null},
  ];
  const report=buildDailySummary(loads,'2026-10-02',dayKey);
  assert.deepEqual(report.rows.map(row=>row.id),['done-today','old-open','today-open']);
  assert.deepEqual([report.counts.Pendente,report.counts['Falta item'],report.counts.Concluído],[1,1,1]);
  assert.match(report.message,/1\.10\/26 - 1\.000 peças - Pendente - Previsto: 29\/09\/2026/);
  assert.match(report.message,/4\.10\/26 - 1\.000 peças - Concluído - Previsto: 28\/09\/2026/);
  assert(!report.message.includes('3.10/26'));
  assert(!report.message.includes('5.10/26'));
  assert(!report.message.includes('6.10/26'));
});
