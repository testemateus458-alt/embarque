export type ImportedShipmentRow = {
  date: string;
  destination: string;
  lot: string;
  quantity: number;
  description: string;
};

type TextItem = { str: string; transform: number[] };

const LOT_PATTERN = /^\d+\.\d{2}\/\d{2}$/;
const QUANTITY_PATTERN = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/;
const IGNORED_DESTINATIONS = new Set(["DATA", "DESTINO", "LOTE", "QUANTIDADE", "DESCRIÇÃO", "INF. ADICIONAIS"]);

function dateToIso(day: number, month: number, year: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function addDays(iso: string, amount: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function parseShipmentPdf(file: File): Promise<ImportedShipmentRow[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const result: ImportedShipmentRow[] = [];
  let lastDate = "";

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter(item => "str" in item && "transform" in item)
      .map(item => item as unknown as TextItem)
      .map(item => ({ text: cleanText(item.str), x: item.transform[4], y: item.transform[5] }))
      .filter(item => item.text);

    const allText = items.map(item => item.text).join(" ");
    const week = allText.match(/SEMANA\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    const firstDate = week ? dateToIso(Number(week[1]), Number(week[2]), Number(week[3])) : lastDate;
    if (!firstDate) throw new Error("Não encontrei a data inicial da semana no PDF.");

    const lotItems = items.filter(item => LOT_PATTERN.test(item.text)).sort((a, b) => b.y - a.y);
    const destinationItems = items.filter(item => {
      const upper = item.text.toLocaleUpperCase("pt-BR");
      return item.x > viewport.width * .065 && item.x < viewport.width * .17 && /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/i.test(item.text) && !IGNORED_DESTINATIONS.has(upper) && !upper.includes("FEIRA");
    });

    let dayOffset = 0;
    let previousY: number | null = null;
    for (const lotItem of lotItems) {
      if (previousY !== null && previousY - lotItem.y > viewport.height * .04) dayOffset++;
      previousY = lotItem.y;
      const sameRow = items.filter(item => Math.abs(item.y - lotItem.y) < 3.5).sort((a, b) => a.x - b.x);
      const quantityItem = sameRow.find(item => item.x > lotItem.x + 20 && item.x < lotItem.x + 105 && QUANTITY_PATTERN.test(item.text));
      const description = cleanText(sameRow.filter(item => item.x > lotItem.x + 80 && item.x < viewport.width * .64).map(item => item.text).join(" "));
      const destination = destinationItems.sort((a, b) => Math.abs(a.y - lotItem.y) - Math.abs(b.y - lotItem.y))[0]?.text || "Não informado";
      if (!quantityItem || !description) continue;
      result.push({
        date: addDays(firstDate, dayOffset),
        destination,
        lot: lotItem.text,
        quantity: Number(quantityItem.text.replace(/\./g, "").replace(",", ".")),
        description,
      });
      lastDate = addDays(firstDate, dayOffset);
    }
  }

  if (!result.length) throw new Error("Não encontrei lotes na tabela desse PDF.");
  return result;
}
