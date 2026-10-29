import { sanitizeForFilename, startBlobDownload } from "../file/utils.mjs";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 50;
const TABLE_WIDTH = PAGE_WIDTH - LEFT_MARGIN * 2;
const FONT_SIZE = 8;
const LINE_HEIGHT = 10;

export default class KmaxReportExportManager {
  static export(instance, modelName) {
    const splitJoins = instance.evaluation?.splitJoins || [];
    const violatingSplitJoins = splitJoins.filter((splitJoin) => !splitJoin.pass);
    const rows = violatingSplitJoins.map(
      (splitJoin) => `L${splitJoin.level}, ${splitJoin.pair || "Unidentified pair"}`,
    );
    const pdf = this.#createPdf(rows);
    const filename =
      `${sanitizeForFilename(modelName || "model")}_kmax-ensuring.pdf`;
    startBlobDownload(filename, pdf, "application/pdf");
  }

  static #createPdf(rows) {
    const pages = [];
    let page;
    let y;

    const addText = (content, text, x, baseline, size, bold = false) => {
      content.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${baseline} Td ` +
        `(${this.#escapePdfText(text)}) Tj ET`,
      );
    };

    const drawRow = (content, text, top, header = false) => {
      const wrappedLines = this.#wrapCell(text, TABLE_WIDTH - 8, FONT_SIZE);
      const lineCount = wrappedLines.length;
      const height = Math.max(24, lineCount * LINE_HEIGHT + 8);
      const bottom = top - height;
      content.push(`${LEFT_MARGIN} ${bottom} ${TABLE_WIDTH} ${height} re S`);

      for (let lineIndex = 0; lineIndex < wrappedLines.length; lineIndex++) {
        addText(
          content,
          wrappedLines[lineIndex],
          LEFT_MARGIN + 4,
          top - 13 - lineIndex * LINE_HEIGHT,
          FONT_SIZE,
          header,
        );
      }

      return top - height;
    };

    const startPage = () => {
      page = [];
      pages.push(page);
      y = drawRow(page, "Violating Split-Join Pairs", PAGE_HEIGHT - 50, true);
    };

    startPage();
    for (const row of rows) {
      const rowHeight = Math.max(
        24,
        this.#wrapCell(row, TABLE_WIDTH - 8, FONT_SIZE).length * LINE_HEIGHT + 8,
      );

      if (y - rowHeight < 60) {
        startPage();
      }
      y = drawRow(page, row, y);
    }

    return this.#serializePdf(pages);
  }

  static #wrapCell(value, width, fontSize) {
    const maxCharacters = Math.max(1, Math.floor(width / (fontSize * 0.55)));
    const words = this.#toAscii(value).split(/\s+/);
    const lines = [];
    let line = "";

    for (const word of words) {
      if (line && line.length + word.length + 1 > maxCharacters) {
        lines.push(line);
        line = "";
      }
      if (word.length > maxCharacters) {
        if (line) lines.push(line);
        for (let index = 0; index < word.length; index += maxCharacters) {
          const part = word.slice(index, index + maxCharacters);
          if (index + maxCharacters < word.length) lines.push(part);
          else line = part;
        }
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }

    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  }

  static #toAscii(value) {
    return String(value)
      .replace(/[–—]/g, "-")
      .replace(/→/g, "->")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  static #escapePdfText(text) {
    return this.#toAscii(text).replace(/[\\()]/g, "\\$&");
  }

  static #serializePdf(pages) {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${pages
        .map((_, index) => `${6 + index * 2} 0 R`)
        .join(" ")}] /Count ${pages.length} >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ];

    pages.forEach((content, index) => {
      const stream = content.join("\n");
      const contentObjectId = 5 + index * 2;
      objects.push(
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      );
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${contentObjectId} 0 R >>`,
      );
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (const offset of offsets.slice(1)) {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }
}
