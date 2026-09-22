export function dayKey(value: string | Date): string {
  if(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d=new Date(value);if(Number.isNaN(d.getTime()))return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");
}
export function addDays(day:string,n:number):string {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function weekStart(day:string):string {const d=new Date(day+"T12:00:00Z");return addDays(day,-((d.getUTCDay()+6)%7))}
export function scheduledTimestamp(day:string):string {return `${day}T12:00:00-03:00`}
export function shortDate(day:string):string {return day?`${day.slice(8,10)}/${day.slice(5,7)}`:"Sem data"}
export function longDate(day:string):string {return day?new Date(day+"T12:00:00Z").toLocaleDateString("pt-BR",{timeZone:"UTC",weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"}):"Sem data"}
