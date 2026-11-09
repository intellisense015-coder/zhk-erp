import { formatCurrency } from "./erp-data";
import { formatInvoiceDate, type InvoiceDocumentModel } from "./invoice-utils";

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

function filledPathCommand(path: string, color: PdfColor) {
  const [red, green, blue] = color.map((channel) => channel / 255);
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg ${path} f`;
}

function circleCommand(centerX: number, centerY: number, radius: number, color: PdfColor) {
  const k = radius * 0.5522848;
  return filledPathCommand(`${centerX + radius} ${centerY} m ${centerX + radius} ${centerY + k} ${centerX + k} ${centerY + radius} ${centerX} ${centerY + radius} c ${centerX - k} ${centerY + radius} ${centerX - radius} ${centerY + k} ${centerX - radius} ${centerY} c ${centerX - radius} ${centerY - k} ${centerX - k} ${centerY - radius} ${centerX} ${centerY - radius} c ${centerX + k} ${centerY - radius} ${centerX + radius} ${centerY - k} ${centerX + radius} ${centerY} c`, color);
}

function pathCommand(path: string, color: PdfColor, width = 3) {
  const [red, green, blue] = color.map((channel) => channel / 255);
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} RG ${width} w ${path} S`;
}

function brandMarkCommands(offsetX = 0) {
  return [
    pathCommand(`${58 + offsetX} 761 m ${43 + offsetX} 772 ${45 + offsetX} 793 ${66 + offsetX} 797 c ${87 + offsetX} 801 ${104 + offsetX} 790 ${102 + offsetX} 773 c`, [17, 168, 236], 3),
    pathCommand(`${52 + offsetX} 796 m ${74 + offsetX} 804 ${99 + offsetX} 793 ${104 + offsetX} 776 c`, [239, 35, 60], 3),
    textCommand("ZHK", 54 + offsetX, 776, 21, true, [18, 159, 228]),
  ];
}

function dashedLineCommand(x1: number, x2: number, y: number) {
  return `0.722 0.745 0.780 RG 1.2 w [3 4] 0 d ${x1} ${y} m ${x2} ${y} l S [] 0 d`;
}

export function createInvoicePdf(model: InvoiceDocumentModel) {
  const commands: string[] = [];
  const pageWidth = 595;
  const ticketX = 96;
  const ticketWidth = 403;
  const ticketRight = ticketX + ticketWidth;
  commands.push(rectCommand(0, 0, pageWidth, 842, [246, 248, 251]));
  commands.push(rectCommand(ticketX, 40, ticketWidth, 762, [255, 255, 255]));
  for (let centerX = ticketX + 42; centerX < ticketRight; centerX += 64) commands.push(circleCommand(centerX, 40, 16, [246, 248, 251]));
  commands.push(...brandMarkCommands(85));
  commands.push(textCommand("MOBILES", 202, 775, 18, true, [17, 26, 45]));
  commands.push(textCommand("mobiles  |  accessories  |  gadgets", 202, 758, 7, true, [0, 0, 0]));
  commands.push(textCommand("INVOICE", 407, 780, 19, true, [17, 26, 45]));
  commands.push(textCommand(model.invoiceNumber, 407, 758, 8, true, [27, 130, 220]));
  commands.push(textCommand("Thank you!", 243, 722, 20, true, [17, 17, 17]));
  commands.push(textCommand("Your purchase has been recorded", 210, 704, 9, false, [125, 132, 144]));
  commands.push(textCommand("successfully", 267, 691, 9, false, [125, 132, 144]));
  commands.push(dashedLineCommand(128, 483, 637));
  commands.push(textCommand("INVOICE ID", 128, 610, 7, false, [125, 132, 144]));
  commands.push(textCommand(model.invoiceNumber, 128, 596, 10, true, [17, 17, 17]));
  commands.push(textCommand(formatInvoiceDate(model.date), 128, 580, 8, false, [125, 132, 144]));
  commands.push(textCommand("AMOUNT", 416, 610, 7, false, [125, 132, 144]));
  commands.push(textCommand(formatCurrency(model.total), 416, 596, 10, true, [17, 17, 17]));
  commands.push(rectCommand(128, 520, 355, 42, [246, 248, 251]));
  commands.push(textCommand(model.partyLabel, 142, 547, 7, false, [125, 132, 144]));
  commands.push(textCommand(model.party.slice(0, 34), 142, 533, 11, true, [23, 34, 56]));
  if (model.contact) commands.push(textCommand(model.contact, 142, 520, 8, false, [125, 132, 144]));

  let y = 488;
  commands.push(rectCommand(128, y - 10, 355, 22, [241, 245, 249]));
  const columns = [128, 365, 438];
  ["Item", "Qty", "Amount"].forEach((label, index) => commands.push(textCommand(label, columns[index] + (index === 0 ? 7 : 0), y - 1, 7, true, [38, 52, 76])));
  y -= 34;
  model.lines.slice(0, 7).forEach((line) => {
    commands.push(textCommand(line.name.slice(0, 30), columns[0] + 7, y, 8, true));
    commands.push(textCommand(String(line.quantity), columns[1] + 5, y, 8));
    commands.push(textCommand(formatCurrency(line.amount), columns[2] + 5, y, 8, true));
    if (line.detail) commands.push(textCommand(line.detail.slice(0, 28), columns[0] + 7, y - 11, 6, false, [130, 143, 162]));
    commands.push(lineCommand(128, y - 19, 483, y - 19, [230, 235, 241], 0.6));
    y -= line.detail ? 33 : 25;
  });

  y -= 10;
  const summaryX = 330;
  model.adjustments.forEach((adjustment) => {
    commands.push(textCommand(adjustment.label, summaryX, y, 8, false, [100, 114, 138]));
    commands.push(textCommand(`${adjustment.negative ? "-" : ""}${formatCurrency(adjustment.amount)}`, 416, y, 8, true));
    y -= 16;
  });
  commands.push(lineCommand(summaryX, y + 6, 483, y + 6, [214, 224, 235], 0.8));
  commands.push(textCommand("Total", summaryX, y - 10, 12, true));
  commands.push(textCommand(formatCurrency(model.total), 403, y - 10, 12, true, [18, 110, 210]));
  if (model.note) commands.push(textCommand(model.note.slice(0, 55), 128, y - 42, 7, false, [135, 146, 164]));
  commands.push(textCommand("Solexa by Intellisense.cloud", 252, 52, 7, false, [0, 0, 0]));

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
