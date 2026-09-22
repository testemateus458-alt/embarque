import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,weekStart,addDays,scheduledTimestamp,shipmentDay} from '../lib/shipment-calendar.ts';
test('week follows Monday across months and years',()=>{assert.equal(weekStart('2026-10-02'),'2026-09-28');assert.equal(weekStart('2027-01-01'),'2026-12-28');assert.equal(addDays('2026-12-28',7),'2027-01-04')});
test('shipment date uses Sao Paulo and survives saving as UTC',()=>{assert.equal(dayKey('2026-09-22T01:00:00Z'),'2026-09-21');for(const day of ['2026-09-21','2026-09-25','2026-12-31'])assert.equal(dayKey(new Date(scheduledTimestamp(day)).toISOString()),day)});
test('unknown date is not attributed to a calendar day',()=>{assert.equal(dayKey(''),'');assert.equal(dayKey('invalid'),'')});
test('completed shipment moves to its actual completion day',()=>{
  const load={scheduled_at:'2026-09-21T12:00:00-03:00',status:'Concluído',shipped_at:'2026-09-22T14:30:00-03:00'};
  assert.equal(shipmentDay(load),'2026-09-22');
  assert.equal(shipmentDay({...load,status:'Em processo'}),'2026-09-21');
});
