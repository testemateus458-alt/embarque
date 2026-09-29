import { extractTableLines, parseShipmentPdfPages, type PdfTextItem, type ShipmentPdfPage } from "./pdf-table";
export type { ImportedShipmentRow } from "./pdf-table";

export async function parseShipmentPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const document = await task.promise;
    const pages: ShipmentPdfPage[] = [];
    for (let n = 1; n <= document.numPages; n++) {
      const page = await document.getPage(n);
      const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      pages.push({
        items: content.items.filter(item => "str" in item && "transform" in item) as PdfTextItem[],
        lines: extractTableLines(operators, pdfjs.OPS),
      });
    }
    return parseShipmentPdfPages(pages);
  } finally {
    await task.destroy();
  }
}
