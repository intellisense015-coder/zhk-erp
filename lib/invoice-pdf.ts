import { formatCurrency } from "./erp-data";
import type { InvoiceDocumentModel } from "./invoice-utils";

type PdfColor = [number, number, number];

function safeText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textCommand(value: string, x: number, y: number, size: number, bold = false, color: PdfColor = [23, 34, 56]) {
  const [red, green, blue] = color.map((channel) => channel / 255);
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${safeText(value)}) Tj ET`;
}

function lineCommand(x1: number, y1: number, x2: number, y2: number, color: PdfColor = [220, 227, 236], width = 0.7) {
  const [red, green, blue] = color.map((channel) => channel / 255);
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function rectCommand(x: number, y: number, width: number, height: number, color: PdfColor, fill = true) {
  const [red, green, blue] = color.map((channel) => channel / 255);
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg ${x} ${y} ${width} ${height} re ${fill ? "f" : "S"}`;
}

export function createInvoicePdf(model: InvoiceDocumentModel) {
  const commands: string[] = [];
  const pageWidth = 595;
  const right = pageWidth - 44;
  commands.push(rectCommand(0, 0, pageWidth, 842, [255, 255, 255]));
  commands.push(textCommand("ZHK", 44, 775, 26, true, [18, 159, 228]));
  commands.push(textCommand("MOBILES", 113, 775, 20, true, [17, 26, 45]));
  commands.push(textCommand("MOBILES  |  ACCESSORIES  |  GADGETS", 113, 758, 7, true, [98, 113, 139]));
  commands.push(textCommand("INVOICE", 426, 780, 28, true, [17, 26, 45]));
  commands.push(textCommand(model.invoiceNumber, 427, 758, 10, true, [27, 130, 220]));
  commands.push(textCommand(`Date: ${model.date}`, 427, 742, 9, false, [104, 118, 145]));
  commands.push(lineCommand(44, 720, right, 720, [214, 224, 235], 1));
  commands.push(lineCommand(44, 720, 112, 720, [20, 169, 232], 2));
  commands.push(lineCommand(112, 720, 180, 720, [239, 35, 60], 2));
  commands.push(textCommand(model.partyLabel, 44, 686, 8, true, [139, 151, 170]));
  commands.push(textCommand(model.party, 44, 670, 13, true));
  if (model.contact) commands.push(textCommand(model.contact, 44, 655, 8, false, [117, 130, 154]));

  let y = 618;
  commands.push(rectCommand(44, y - 12, right - 44, 24, [241, 245, 249]));
  const columns = [44, 292, 347, 419, 487, right];
  ["Item", "Qty", "Unit price", "Discount", "Amount"].forEach((label, index) => commands.push(textCommand(label, columns[index] + (index === 0 ? 8 : 0), y - 1, 8, true, [38, 52, 76])));
  y -= 37;
  model.lines.slice(0, 11).forEach((line) => {
    commands.push(textCommand(line.name.slice(0, 36), columns[0] + 8, y, 8, true));
    commands.push(textCommand(String(line.quantity), columns[1] + 8, y, 8));
    commands.push(textCommand(formatCurrency(line.unitPrice), columns[2] + 8, y, 8));
    commands.push(textCommand(formatCurrency(line.discount), columns[3] + 8, y, 8));
    commands.push(textCommand(formatCurrency(line.amount), columns[4] + 8, y, 8, true));
    if (line.detail) commands.push(textCommand(line.detail.slice(0, 42), columns[0] + 8, y - 11, 6, false, [130, 143, 162]));
    commands.push(lineCommand(44, y - 19, right, y - 19, [230, 235, 241], 0.6));
    y -= line.detail ? 34 : 27;
  });

  y -= 15;
  const summaryX = 350;
  model.adjustments.forEach((adjustment) => {
    commands.push(textCommand(adjustment.label, summaryX, y, 9, false, [100, 114, 138]));
    commands.push(textCommand(`${adjustment.negative ? "-" : ""}${formatCurrency(adjustment.amount)}`, 475, y, 9, true));
    y -= 18;
  });
  commands.push(lineCommand(summaryX, y + 7, right, y + 7, [214, 224, 235], 0.8));
  commands.push(textCommand("Total", summaryX, y - 13, 13, true));
  commands.push(textCommand(formatCurrency(model.total), 463, y - 13, 14, true, [18, 110, 210]));
  y -= 62;
  commands.push(lineCommand(44, y, right, y, [225, 231, 239], 0.8));
  commands.push(textCommand("Payment", 68, y - 24, 8, true, [133, 145, 164]));
  commands.push(textCommand(model.paymentSummary.slice(0, 78), 68, y - 39, 9, true));
  if (model.note) commands.push(textCommand(model.note.slice(0, 105), 44, y - 67, 7, false, [135, 146, 164]));
  commands.push(lineCommand(44, 57, right, 57, [214, 224, 235], 0.8));
  commands.push(textCommand("Solexa by Intellisense.cloud", 44, 39, 8, false, [101, 116, 140]));

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const encoder = new TextEncoder();
  const chunks = [encoder.encode("%PDF-1.4\n% Solexa invoice\n")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = encoder.encode(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(encoder.encode(xref));
  return new Blob(chunks, { type: "application/pdf" });
}
