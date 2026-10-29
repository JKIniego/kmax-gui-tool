import { sanitizeForFilename, startBlobDownload } from "../file/utils.mjs";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 50;
const TABLE_WIDTH = 495;
const COLUMN_WIDTHS = [100, 45, 75, 65, 75, 65, 70];
const HEADER = [
  "Pair",
  "E-split",
  "Calculated Jm",
  "Counted Jm",
  "Calculated Js",
  "Counted Js",
  "Status",
];
const FONT_SIZE = 8;
const LINE_HEIGHT = 10;

export default class KmaxReportExportManager {
  static export(instance, modelName) {
    const splitJoins = instance.evaluation?.splitJoins;
    if (!Array.isArray(splitJoins) || splitJoins.length === 0) {
      throw new Error("Cannot export a kmax-ensuring report without split/join results.");
    }

    const rows = splitJoins.map((splitJoin) => [
      `L${splitJoin.level}, ${splitJoin.pair || "Unidentified pair"}`,
      this.#value(splitJoin.esplits),
      this.#value(splitJoin.expectedMergingJoins),
      this.#value(splitJoin.mergingJoins),
      this.#value(splitJoin.maxSeparatingJoins),
      this.#value(splitJoin.separatingJoins),
      splitJoin.reason || (splitJoin.pass ? "Satisfied" : "Not satisfied"),
    ]);
    const pdf = this.#createPdf(rows, modelName || "Untitled Model");
    const filename =
      `${sanitizeForFilename(modelName || "model")}_kmax-ensuring.pdf`;
    startBlobDownload(filename, pdf, "application/pdf");
  }

  static #value(value) {
    return Number.isFinite(value) ? String(value) : "-";
  }

  static #createPdf(rows, modelName) {
    const pages = [];
    let page;
    let y;

    const addText = (content, text, x, baseline, size, bold = false) => {
      content.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${baseline} Td ` +
        `(${this.#escapePdfText(text)}) Tj ET`,
      );
    };

    const drawRow = (content, cells, top, header = false) => {
      const wrappedCells = cells.map((cell, index) =>
        this.#wrapCell(cell, COLUMN_WIDTHS[index] - 8, FONT_SIZE),
      );
      const lineCount = Math.max(...wrappedCells.map((lines) => lines.length));
      const height = Math.max(24, lineCount * LINE_HEIGHT + 8);
      let x = LEFT_MARGIN;

      for (let index = 0; index < COLUMN_WIDTHS.length; index++) {
        const width = COLUMN_WIDTHS[index];
        const bottom = top - height;
        content.push(`${x} ${bottom} ${width} ${height} re S`);

        const lines = wrappedCells[index];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          addText(
            content,
            lines[lineIndex],
            x + 4,
            top - 13 - lineIndex * LINE_HEIGHT,
            FONT_SIZE,
            header,
          );
        }
        x += width;
      }

      return top - height;
    };

    const startPage = () => {
      page = [];
      pages.push(page);
      addText(page, "kmax-Ensuring Analysis", LEFT_MARGIN, PAGE_HEIGHT - 48, 16, true);
      addText(page, `Model: ${modelName}`, LEFT_MARGIN, PAGE_HEIGHT - 66, 9);
      y = drawRow(page, HEADER, PAGE_HEIGHT - 82, true);
    };

    startPage();
    for (const row of rows) {
      const rowHeight = Math.max(
        24,
        Math.max(
          ...row.map((cell, index) =>
            this.#wrapCell(cell, COLUMN_WIDTHS[index] - 8, FONT_SIZE).length,
          ),
        ) * LINE_HEIGHT + 8,
      );

      if (y - rowHeight < 60) {
        startPage();
      }
      y = drawRow(page, row, y);
    }

    pages.forEach((content, index) => {
      addText(
        content,
        `Page ${index + 1} of ${pages.length}`,
        PAGE_WIDTH - 100,
        30,
        8,
      );
    });

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
