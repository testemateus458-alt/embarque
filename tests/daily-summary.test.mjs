import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDailySummary,shipmentUnit} from '../lib/daily-summary.ts';
import {dayKey} from '../lib/shipment-calendar.ts';

test('WhatsApp report includes every scheduled unit, status and missing-item note',()=>{
  const base={carrier:'',destination:'',volumes:5000,missing_item_notes:'',scheduled_at:'2026-10-02T12:00:00-03:00'};
  const loads=[
    {...base,id:'a',number:'9.10/26',carrier:'Não informado',destination:'UBERABA',status:'Falta item',missing_item_notes:'Falta saia'},
    {...base,id:'b',number:'10.10/26',carrier:'PETROLÂNDIA',destination:'PETROLÂNDIA',status:'Concluído'},
    {...base,id:'c',number:'11.10/26',carrier:'Não informado',destination:'Não informado',status:'Pendente'},
    {...base,id:'d',number:'12.10/26',carrier:'ESTEIO',destination:'ESTEIO',status:'Em processo',scheduled_at:'2026-10-01T12:00:00-03:00'},
  ];
  const report=buildDailySummary(loads,'2026-10-02',dayKey);
  assert.equal(report.rows.length,3);
  assert.equal(report.quantity,15000);
  assert.equal(report.counts['Falta item'],1);
  assert.match(report.message,/\*UBERABA\* — 1 lote • 5\.000 peças/);
  assert.match(report.message,/\*PETROLÂNDIA\* — 1 lote • 5\.000 peças/);
  assert.match(report.message,/\*Unidade não informada\*/);
  assert.match(report.message,/Falta saia/);
  assert(!report.message.includes('ESTEIO'));
  assert.equal(shipmentUnit(loads[0]),'UBERABA');
});
