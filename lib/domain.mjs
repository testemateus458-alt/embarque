export const STAGES=['Pendente','Em processo','Falta item','Concluído'];
export function isLate(load,now=Date.now()){return load.status!=='Concluído' && Date.parse(load.scheduled_at)<now;}
export function occupiesDock(){return false;}
export function validateShipment(load){
 if(!load.number?.trim() || load.number.length>50)throw Error('Informe um número de carga com até 50 caracteres.');
 if(!load.destination?.trim() || load.destination.length>200)throw Error('Informe o destino com até 200 caracteres.');
 if(!Number.isFinite(Date.parse(load.scheduled_at)))throw Error('Informe uma previsão válida.');
 if(!STAGES.includes(load.status))throw Error('Etapa inválida.');
 if(!Number.isInteger(load.volumes)||load.volumes<0)throw Error('Volumes deve ser um inteiro positivo ou zero.');
 if(!Number.isFinite(load.weight)||load.weight<0)throw Error('Peso deve ser positivo ou zero.');
 if(load.status==='Falta item'&&!load.missing_item_notes?.trim())throw Error('Descreva qual item está faltando.');
 if(load.dock_id!=null&&(!Number.isInteger(load.dock_id)||load.dock_id<1||load.dock_id>99))throw Error('Doca inválida.');
}
export function assertDockAvailable(load,all){
 if(occupiesDock(load)&&all.some(other=>other.id!==load.id&&other.dock_id===load.dock_id&&occupiesDock(other)))throw Error('Esta doca já está ocupada. Escolha uma doca livre.');
}
