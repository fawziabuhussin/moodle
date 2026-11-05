import ExcelJS from "exceljs";
import type { SheetColumn, SheetRow } from "@/lib/sheet-types";

export type { SheetColumn, SheetRow };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value && value.text) return String(value.text);
  if (typeof value === "object" && "result" in value && value.result != null) return cellText(value.result as ExcelJS.CellValue);
  return "";
}

export function toCsv(columns: SheetColumn[], rows: SheetRow[]) {
  const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
  const lines = [
    columns.map((column) => escape(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column.key] ?? "")).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export async function toXlsx(columns: SheetColumn[], rows: SheetRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("انطلاقة");
  sheet.views = [{ rightToLeft: true }];
  sheet.addRow(columns.map((column) => column.label));
  for (const row of rows) sheet.addRow(columns.map((column) => row[column.key] ?? ""));
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function fromCsv(text: string, columns: SheetColumn[]): { columns: SheetColumn[]; rows: SheetRow[] } {
  const grid = parseCsv(text.replace(/^\uFEFF/, ""));
  if (grid.length === 0) return { columns, rows: [] };
  return gridToSheet(grid, columns);
}

export async function fromXlsx(buffer: Buffer, columns: SheetColumn[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { columns, rows: [] as SheetRow[] };
  const grid: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[];
    const line: string[] = [];
    for (let index = 1; index < values.length; index += 1) line.push(cellText(values[index]));
    grid.push(line);
  });
  return gridToSheet(grid, columns);
}

function gridToSheet(grid: string[][], existing: SheetColumn[]) {
  const header = grid[0] ?? [];
  const columns: SheetColumn[] = header.map((label, index) => {
    const known = existing.find((column) => column.label === label || column.key === label);
    if (known) return known;
    const key = `col_${index + 1}`;
    return { key, label: label || key };
  });
  const rows = grid.slice(1).filter((line) => line.some((cell) => cell.trim())).map((line) => {
    const row: SheetRow = {};
    columns.forEach((column, index) => {
      row[column.key] = line[index] ?? "";
    });
    return row;
  });
  return { columns: columns.length > 0 ? columns : existing, rows };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((line) => line.some((value) => value.trim()));
}
