import ExcelJS from 'exceljs';
import { DATASET_FIELDS, AUDIO_SLOTS, AUDIO_NOTE_KEY, AnnotationValues } from './schema';

export const MAIN_SHEET_NAME = 'Субъекты Р и С - НОВЫЕ';
const FILES_SHEET_NAME = 'Аудиофайлы';
const HEADER_FONT = { name: 'Arial', bold: true, size: 10 };
const BODY_FONT = { name: 'Arial', size: 10 };
// Сколько пустых строк ниже данных получают выпадающие списки — чтобы файл
// можно было дальше дозаполнять руками, как исходный шаблон.
const VALIDATION_SPARE_ROWS = 200;

export interface ExportAudio {
  key: string;
  recordingType: string;
  duration: number | null;
  sizeBytes: number;
  uploadedAt: string | null;
}

export interface ExportRow {
  patientId: string;
  values: AnnotationValues;
  audio: ExportAudio[];
}

function columnIndex(letters: string): number {
  return letters.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

/** Привести сохранённую строку к типу ячейки: числа — числом, дата — датой. */
function cellValue(key: string, raw: string | undefined): ExcelJS.CellValue {
  if (raw === undefined || raw === '') return null;
  const field = DATASET_FIELDS.find((f) => f.key === key);
  if (field?.type === 'number' && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (field?.type === 'date') {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return raw;
}

/** Номер аудиозаписи по правилу из «РАЗЪЯСНЕНИЙ»: 001АБВ(1)310123-1. */
export function datasetAudioName(values: AnnotationValues, slot: number | null): string {
  const subject = values.A || '?';
  const rec = values.B || '1';
  const date = values.C ? values.C.split('-').reverse().map((p, i) => (i === 2 ? p.slice(2) : p)).join('') : '';
  return `${subject}(${rec})${date}${slot ? `-${slot}` : ''}`;
}

function slotFor(recordingType: string): number | null {
  return AUDIO_SLOTS.find((s) => s.taskTypes.includes(recordingType))?.slot ?? null;
}

export async function buildDatasetWorkbook(rows: ExportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BrainPhone';
  wb.created = new Date();

  // ── Основной лист — та же раскладка колонок, что в шаблоне ───────────────
  const ws = wb.addWorksheet(MAIN_SHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }],
  });

  const header = ws.getRow(1);
  header.height = 77.25;
  for (const f of DATASET_FIELDS) {
    const col = columnIndex(f.key);
    ws.getColumn(col).width = f.width ?? 13;
    const cell = header.getCell(col);
    cell.value = f.header;
    cell.font = HEADER_FONT;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (f.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f.fill } };
  }
  // BX/BY в шаблоне без заголовка, оставляем пустыми для совпадения раскладки.
  ws.getColumn(columnIndex('BX')).width = 13;
  ws.getColumn(columnIndex('BY')).width = 13;

  const audioFirst = columnIndex(AUDIO_SLOTS[0].key);
  const audioLast = columnIndex(AUDIO_NOTE_KEY);
  ws.mergeCells(1, audioFirst, 1, audioLast);
  const audioHeader = header.getCell(audioFirst);
  audioHeader.value = 'АУДИОЗАПИСИ';
  audioHeader.font = HEADER_FONT;
  audioHeader.alignment = { wrapText: true, vertical: 'top' };
  for (const s of AUDIO_SLOTS) ws.getColumn(columnIndex(s.key)).width = 9;
  ws.getColumn(audioLast).width = 14.5;

  rows.forEach((r, i) => {
    const row = ws.getRow(i + 2);
    for (const f of DATASET_FIELDS) {
      const cell = row.getCell(columnIndex(f.key));
      cell.value = cellValue(f.key, r.values[f.key]);
      cell.font = BODY_FONT;
      if (f.type === 'date') cell.numFmt = 'dd.mm.yyyy';
      if (f.type === 'textarea') cell.alignment = { wrapText: true, vertical: 'top' };
    }
    const present = new Set(r.audio.map((a) => slotFor(a.recordingType)).filter(Boolean));
    for (const s of AUDIO_SLOTS) {
      const cell = row.getCell(columnIndex(s.key));
      cell.value = present.has(s.slot) ? 'да' : null;
      cell.font = BODY_FONT;
    }
    const note = row.getCell(audioLast);
    note.value = r.values[AUDIO_NOTE_KEY] || null;
    note.font = BODY_FONT;
  });

  // Выпадающие списки как в шаблоне.
  const lastRow = rows.length + 1 + VALIDATION_SPARE_ROWS;
  // В типах exceljs нет диапазонных валидаций, но в рантайме API есть (4.x).
  const validations = (ws as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations;
  for (const f of DATASET_FIELDS) {
    if (f.type !== 'select' || !f.options) continue;
    validations.add(`${f.key}2:${f.key}${lastRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${f.options.join(',')}"`],
      showErrorMessage: false,
    });
  }

  // ── Лист с файлами: какие записи из S3 попали в выгрузку ─────────────────
  const fs = wb.addWorksheet(FILES_SHEET_NAME, { views: [{ state: 'frozen', ySplit: 1 }] });
  fs.columns = [
    { header: 'НОМЕР СУБЪЕКТА', width: 14 },
    { header: '# ЗАПИСИ СУБЪЕКТА', width: 10 },
    { header: 'НОМЕР АУДИОЗАПИСИ', width: 24 },
    { header: 'ЗАДАНИЕ', width: 34 },
    { header: 'ДЛИТЕЛЬНОСТЬ, С', width: 12 },
    { header: 'РАЗМЕР, БАЙТ', width: 12 },
    { header: 'ЗАГРУЖЕНО', width: 18 },
    { header: 'КЕЙС (ID)', width: 30 },
    { header: 'ОБЪЕКТ S3', width: 60 },
  ];
  fs.getRow(1).font = HEADER_FONT;
  fs.getRow(1).alignment = { wrapText: true, vertical: 'top' };
  for (const r of rows) {
    for (const a of r.audio) {
      const slot = slotFor(a.recordingType);
      fs.addRow([
        r.values.A ?? null,
        r.values.B ? Number(r.values.B) : null,
        datasetAudioName(r.values, slot),
        AUDIO_SLOTS.find((s) => s.slot === slot)?.label ?? a.recordingType,
        a.duration !== null ? Math.round(a.duration * 10) / 10 : null,
        a.sizeBytes,
        a.uploadedAt ? new Date(a.uploadedAt) : null,
        r.patientId,
        a.key,
      ]).font = BODY_FONT;
    }
  }
  fs.getColumn(7).numFmt = 'dd.mm.yyyy hh:mm';

  return Buffer.from(await wb.xlsx.writeBuffer());
}
