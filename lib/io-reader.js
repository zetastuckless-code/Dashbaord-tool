import { extractPdfLines } from "./pdf-text.js";
import { parseInsertionOrder } from "./io-parser.js";

/** Reads an insertion-order PDF in the browser. pdf.js loads on demand so the dashboard stays light until an IO is uploaded. */
export async function readIoPdf(file) {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/build/pdf.mjs"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return parseInsertionOrder(await extractPdfLines(pdfjs, await file.arrayBuffer()));
}
