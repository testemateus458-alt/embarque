import type { ImportedShipmentRow } from "./pdf-table";

export type ExistingImportShipment = { id: string; number: string; date: string; version: number };
export const lotKey = (number: string) => number.trim().toLocaleLowerCase("pt-BR");

export function planShipmentImport(rows: ImportedShipmentRow[], existing: ExistingImportShipment[]) {
  const newRows: ImportedShipmentRow[] = [];
  const dateUpdates: { id: string; version: number; previousDate: string; row: ImportedShipmentRow }[] = [];
  const unchanged: ImportedShipmentRow[] = [];
  const seen = new Map<string, ImportedShipmentRow>();
  for (const row of rows) {
    const key = lotKey(row.lot), previous = seen.get(key);
    if (previous) {
      if (previous.date !== row.date || previous.destination !== row.destination || previous.quantity !== row.quantity || previous.description !== row.description) throw new Error(`O lote ${row.lot} aparece mais de uma vez com dados diferentes no PDF. Confira o romaneio.`);
      continue;
    }
    seen.set(key, row);
    const matches = existing.filter(load => lotKey(load.number) === key);
    if (matches.length > 1) throw new Error(`Há mais de um cadastro para o lote ${row.lot}. Confira os cadastros antes de importar.`);
    const load = matches[0];
    if (!load) newRows.push(row);
    else if (load.date !== row.date) dateUpdates.push({ id: load.id, version: load.version, previousDate: load.date, row });
    else unchanged.push(row);
  }
  return { newRows, dateUpdates, unchanged };
}
