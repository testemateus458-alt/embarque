import {createClient} from '@supabase/supabase-js';
export const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
 ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
 : null;
export type Shipment={id:string;number:string;nf:string;destination:string;carrier:string;driver:string;plate:string;vehicle:string;dock_id:number|null;scheduled_at:string;volumes:number;weight:number;responsible:string;notes:string;missing_item_notes:string;status:string;version:number;started_at?:string|null;shipped_at?:string|null;created_at?:string;updated_at?:string};
export type Profile={id:string;name:string;role:'visualizador'|'operador'|'admin';active:boolean};
export type Audit={id:number;shipment_id:string;shipment_number:string;action:string;actor_name:string;created_at:string;before_data:Shipment|null;after_data:Shipment|null};
export type Dock={id:number;name:string};
export const demoDocks:Array<Dock>=Array.from({length:6},(_,i)=>({id:i+1,name:'Doca 0'+(i+1)}));
export function demoLoads():Shipment[]{
 const places=['São Paulo, SP','Curitiba, PR','Campinas, SP','Belo Horizonte, MG','Joinville, SC','Rio de Janeiro, RJ','Santos, SP','Goiânia, GO','Sorocaba, SP','Londrina, PR','Vitória, ES','Ribeirão Preto, SP'];
 const statuses=['Pendente','Em processo','Falta item','Concluído'];
 return places.map((destination,i)=>({id:'demo-'+i,number:String(10706+i),nf:String(89301+i),destination,carrier:['PETROLÂNDIA','Unidade Norte','Linha Industrial'][i%3],driver:['Carlos Oliveira','Marcos Santos','Ana Ribeiro','Paulo Costa'][i%4],plate:['ABC1D23','FGR4H56','JKL7M89'][i%3],vehicle:i%2?'Truck':'Carreta',dock_id:null,scheduled_at:new Date(Date.now()+(i-3)*25*60000).toISOString(),volumes:21+i*3,weight:2800+i*600,responsible:['Juliana Lima','Rafael Souza'][i%2],notes:i===0?'Separar conforme romaneio 3201.':'',missing_item_notes:i%4===2?'Faltam 3 caixas do item 5087 — filme stretch 500 mm.':'',status:statuses[i%4],version:1,started_at:i%4!==0?new Date(Date.now()-(i+1)*600000).toISOString():null,shipped_at:i%4===3?new Date().toISOString():null}));
}
