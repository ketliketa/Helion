import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from "docx";
import type { Report } from "../modules/reports.ts";
function plain(value: unknown) {
  return String(value).replace(/[\u0000-\u001f]/g, " ");
}
export async function pdfReport(report: Report) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(
    readFileSync(new URL("../../public/fonts/DejaVuSans.ttf", import.meta.url)),
    { subset: true },
  );
  const bold = await doc.embedFont(
    readFileSync(
      new URL("../../public/fonts/DejaVuSans-Bold.ttf", import.meta.url),
    ),
    { subset: true },
  );
  let page = doc.addPage([842, 595]),
    y = 555;
  const margin = 34,
    width = 774,
    colWidth = width / report.columns.length;
  function line(value: string, size = 11, strong = false) {
    page.drawText(plain(value), {
      x: margin,
      y,
      size,
      font: strong ? bold : regular,
      color: rgb(0.12, 0.18, 0.16),
    });
    y -= size + 9;
  }
  function header(first = false) {
    line(report.title, 21, true);
    line(`${report.from} deri ${report.to} | HotelFlow`, 10);
    if (first) {
      let current = "";
      for (const word of plain(report.description).split(/\s+/)) {
        const candidate = current ? current + " " + word : word;
        if (regular.widthOfTextAtSize(candidate, 9) > width && current) {
          line(current, 9);
          current = word;
        } else current = candidate;
      }
      if (current) line(current, 9);
      if (report.summary.length)
        line(
          report.summary.map((s) => s.label + ": " + s.value).join("   |   "),
          10,
          true,
        );
    }
    y -= 5;
    page.drawRectangle({
      x: margin,
      y: y - 8,
      width,
      height: 24,
      color: rgb(0.92, 0.95, 0.91),
    });
    report.columns.forEach((c, i) =>
      page.drawText(plain(c).slice(0, Math.floor(colWidth / 5.5)), {
        x: margin + i * colWidth + 5,
        y,
        size: 9,
        font: bold,
      }),
    );
    y -= 17;
  }
  function wrap(value: string) {
    const words = plain(value).split(/\s+/),
      out: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (regular.widthOfTextAtSize(candidate, 9) > colWidth - 12 && line) {
        out.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) out.push(line);
    return out.flatMap((s) => {
      const max = Math.max(6, Math.floor((colWidth - 12) / 5));
      return s.length > max * 2
        ? s.match(new RegExp(`.{1,${max}}`, "g")) || [s]
        : [s];
    });
  }
  header(true);
  for (const row of report.rows) {
    const cells = row.map((v) => wrap(String(v))),
      height = Math.max(1, ...cells.map((c) => c.length)) * 13 + 12;
    if (y - height < 45) {
      page = doc.addPage([842, 595]);
      y = 555;
      header();
    }
    cells.forEach((lines, i) =>
      lines.forEach((s, j) =>
        page.drawText(s, {
          x: margin + i * colWidth + 5,
          y: y - j * 13,
          size: 9,
          font: regular,
        }),
      ),
    );
    y -= height;
    page.drawLine({
      start: { x: margin, y: y + 7 },
      end: { x: 808, y: y + 7 },
      color: rgb(0.88, 0.91, 0.89),
      thickness: 0.5,
    });
  }
  if (!report.rows.length) line("Nuk ka te dhena per kete periudhe.");
  for (const [i, p] of doc.getPages().entries())
    p.drawText(`HotelFlow | ${i + 1} / ${doc.getPageCount()}`, {
      x: margin,
      y: 20,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.5, 0.47),
    });
  return Buffer.from(await doc.save());
}
export async function wordReport(report: Report) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
  const cell = (value: unknown, head = false) =>
    new TableCell({
      width: { size: 100 / report.columns.length, type: WidthType.PERCENTAGE },
      shading: head ? { fill: "EAF1EC" } : undefined,
      borders: { top: border, bottom: border, left: border, right: border },
      margins: { top: 110, bottom: 110, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: String(value),
              bold: head,
              size: 20,
              color: "000000",
            }),
          ],
        }),
      ],
    });
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "000000" },
          paragraph: { spacing: { after: 140 } },
        },
      },
      Title: { name: "Title", run: { color: "000000", size: 38, bold: true } },
    } as any,
    sections: [
      {
        properties: {
          page: {
            size: { width: 15840, height: 12240 },
            margin: { top: 850, bottom: 850, left: 750, right: 750 },
          },
        },
        children: [
          new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Periudha ${report.from} deri ${report.to}` }),
          new Paragraph({ text: report.description }),
          ...report.summary.map(
            (s) =>
              new Paragraph({
                children: [
                  new TextRun({ text: s.label + ": ", bold: true }),
                  new TextRun(s.value),
                ],
              }),
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: report.columns.map((c) => cell(c, true)),
              }),
              ...report.rows.map(
                (r) => new TableRow({ children: r.map((c) => cell(c)) }),
              ),
            ],
          }),
          new Paragraph({
            text: "Gjeneruar nga HotelFlow. Raporti nuk përbën faturë fiskale.",
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
export function csvReport(report: Report) {
  return (
    "\uFEFF" +
    [report.columns, ...report.rows]
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@\-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
