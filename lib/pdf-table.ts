export type ImportedShipmentRow = { date: string; destination: string; lot: string; quantity: number; description: string };
export type PdfTextItem = { str: string; transform: number[]; width: number; height: number };
export type TableLine = { x1: number; y1: number; x2: number; y2: number };
export type ShipmentPdfPage = { items: PdfTextItem[]; lines: TableLine[] };
type PositionedText = { text: string; x: number; y: number; cx: number; cy: number; height: number; vertical: boolean };
type OperatorList = { fnArray: number[]; argsArray: unknown[][] };
type Matrix = number[];

const LOT_PATTERN = /^\d+\.\d{2}\/\d{2}$/;
const QUANTITY_PATTERN = /^\d+(?:\.\d{3})*(?:,\d+)?$/;
const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();
const headerKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const point = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}

// PDF.js 6 paths contain move/line/curve/close commands. Borders may be
// strokes or thin filled rectangles; large background fills are ignored.
export function extractTableLines(operators: OperatorList, ops: Record<string, number>): TableLine[] {
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [], lines: TableLine[] = [];
  for (let i = 0; i < operators.fnArray.length; i++) {
    const op = operators.fnArray[i], args = operators.argsArray[i];
    if (op === ops.save) stack.push([...matrix]);
    else if (op === ops.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === ops.transform) matrix = multiply(matrix, args as number[]);
    else if (op === ops.constructPath && Array.isArray(args?.[1])) {
      for (const data of args[1] as ArrayLike<number>[]) {
        let vertices: number[][] = [], curved = false;
        const flush = () => {
          if (!curved && vertices.length > 1) {
            const xs = vertices.map(v => v[0]), ys = vertices.map(v => v[1]);
            const thin = Math.max(...xs) - Math.min(...xs) <= 1 || Math.max(...ys) - Math.min(...ys) <= 1;
            const stroked = [ops.stroke, ops.closeStroke, ops.fillStroke, ops.eoFillStroke].includes(args[0] as number);
            if (thin || stroked) for (let n = 1; n < vertices.length; n++) {
              const [x1, y1] = vertices[n-1], [x2, y2] = vertices[n];
              if ((Math.abs(y2-y1) < .5 && Math.abs(x2-x1) > 2) || (Math.abs(x2-x1) < .5 && Math.abs(y2-y1) > 2)) lines.push({ x1, y1, x2, y2 });
            }
          }
          vertices = []; curved = false;
        };
        for (let n = 0; n < data.length;) {
          const command = data[n++];
          if (command === 0) { flush(); vertices.push(point(matrix, data[n++], data[n++])); }
          else if (command === 1) vertices.push(point(matrix, data[n++], data[n++]));
          else if (command === 2) { curved = true; n += 6; }
          else if (command === 3) { curved = true; n += 4; }
          else if (command === 4) { if (vertices.length) vertices.push(vertices[0]); flush(); }
          else break;
        }
        flush();
      }
    }
  }
  return lines;
}

function position(item: PdfTextItem): PositionedText {
  const [a, b, , , x, y] = item.transform;
  const length = Math.hypot(a, b) || 1, ux = a / length, uy = b / length;
  return { text: cleanText(item.str), x, y, cx: x + ux * item.width / 2 - uy * item.height / 2, cy: y + uy * item.width / 2 + ux * item.height / 2, height: item.height, vertical: Math.abs(uy) > .5 };
}

function columnBounds(header: PositionedText, lines: TableLine[]) {
  const xs = lines.filter(l => Math.abs(l.x1-l.x2) < .5 && Math.min(l.y1,l.y2) <= header.cy && Math.max(l.y1,l.y2) >= header.cy).map(l => (l.x1+l.x2)/2);
  const left = Math.max(...xs.filter(x => x < header.cx)), right = Math.min(...xs.filter(x => x > header.cx));
  if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("Não consegui identificar as colunas da tabela do PDF. Exporte o romaneio com as bordas da tabela.");
  return { left, right };
}

function cellBounds(item: PositionedText, lines: TableLine[]) {
  const ys = lines.filter(l => Math.abs(l.y1-l.y2) < .5 && Math.min(l.x1,l.x2) < item.cx && Math.max(l.x1,l.x2) > item.cx).map(l => (l.y1+l.y2)/2);
  return { bottom: Math.max(...ys.filter(y => y < item.cy)), top: Math.min(...ys.filter(y => y > item.cy)) };
}

function printedDate(text: string): string {
  const match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})(?=\s|$)/);
  if (!match) return "";
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
  const date = new Date(Date.UTC(year, month-1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) throw new Error(`Data inválida na coluna DATA: ${match[0]}.`);
  return date.toISOString().slice(0, 10);
}

export function parseShipmentPdfPages(pages: ShipmentPdfPage[]): ImportedShipmentRow[] {
  const result: ImportedShipmentRow[] = [];
  for (const page of pages) {
    const items = page.items.map(position).filter(item => item.text);
    const lots = items.filter(item => LOT_PATTERN.test(item.text)).sort((a,b) => b.y-a.y);
    if (!lots.length) continue;
    const headers = ["DATA", "DESTINO", "LOTE", "QUANTIDADE", "DESCRICAO"].map(name => {
      const header = items.find(item => headerKey(item.text) === name && !item.vertical);
      if (!header) throw new Error(`Não encontrei a coluna ${name} na tabela do PDF.`);
      return { ...header, ...columnBounds(header, page.lines) };
    });
    const [dateColumn, destinationColumn, lotColumn, quantityColumn, descriptionColumn] = headers;
    const inside = (item: PositionedText, col: { left: number; right: number }) => item.cx > col.left && item.cx < col.right;
    const dateCells = items.filter(item => inside(item, dateColumn)).flatMap(item => {
      const date = printedDate(item.text);
      return date ? [{ date, ...cellBounds(item, page.lines) }] : [];
    });
    const destinations = items.filter(item => inside(item, destinationColumn) && item.cy < destinationColumn.y && /\p{L}/u.test(item.text)).map(item => ({ text: item.text, ...cellBounds(item, page.lines) }));
    for (const lot of lots.filter(item => inside(item, lotColumn) && item.cy < lotColumn.y)) {
      const dateCell = dateCells.find(cell => lot.cy > cell.bottom && lot.cy < cell.top);
      if (!dateCell || !Number.isFinite(dateCell.bottom) || !Number.isFinite(dateCell.top)) throw new Error(`Não consegui identificar a data do lote ${lot.text} na coluna DATA. Confira as datas e as bordas do romaneio.`);
      const row = items.filter(item => !item.vertical && Math.abs(item.y-lot.y) < Math.max(1, lot.height * .6)).sort((a,b) => a.x-b.x);
      const quantity = row.find(item => inside(item, quantityColumn) && QUANTITY_PATTERN.test(item.text));
      const description = cleanText(row.filter(item => inside(item, descriptionColumn)).map(item => item.text).join(" "));
      if (!quantity || !description) throw new Error(`Não consegui ler a quantidade ou a descrição do lote ${lot.text}.`);
      const destination = destinations.find(cell => lot.cy > cell.bottom && lot.cy < cell.top)?.text;
      if (!destination) throw new Error(`Não consegui identificar o destino do lote ${lot.text}.`);
      result.push({ date: dateCell.date, destination, lot: lot.text, quantity: Number(quantity.text.replace(/\./g, "").replace(",", ".")), description });
    }
  }
  if (!result.length) throw new Error("Não encontrei lotes na tabela desse PDF.");
  return result;
}
