'use client';

import type { Transaction, Wallet } from './types';
import { formatDateShort, formatIDR, formatPeriod } from './format';

export interface ExportRow {
  Tanggal: string;
  Waktu: string;
  Jenis: string;
  Merchant: string;
  Kategori: string;
  Nominal: number;
  Dompet: string;
  'Metode Bayar': string;
  'No. Referensi': string;
  Catatan: string;
}

export function toExportRows(transactions: Transaction[], wallets: Wallet[]): ExportRow[] {
  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name || id || '';
  return transactions.map((t) => ({
    Tanggal: t.date,
    Waktu: t.time || '',
    Jenis: t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
    Merchant: t.merchant,
    Kategori: t.category,
    Nominal: t.amount,
    Dompet: t.type === 'transfer' ? `${walletName(t.wallet)} → ${walletName(t.to_wallet)}` : walletName(t.wallet),
    'Metode Bayar': String(t.payment_method || ''),
    'No. Referensi': t.reference_number || '',
    Catatan: t.notes || '',
  }));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV dengan pemisah titik koma + BOM agar langsung rapi di Excel berlokal Indonesia. */
export function exportCSV(rows: ExportRow[], filename: string) {
  if (!rows.length) throw new Error('Tidak ada transaksi untuk diekspor.');
  const headers = Object.keys(rows[0]) as Array<keyof ExportRow>;
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(';'),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(';')),
  ];
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

/** Excel .xlsx asli (bukan CSV yang di-rename) lewat ExcelJS. */
export async function exportExcel(rows: ExportRow[], filename: string, sheetName = 'Transaksi') {
  if (!rows.length) throw new Error('Tidak ada transaksi untuk diekspor.');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CATATIN';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  const headers = Object.keys(rows[0]) as Array<keyof ExportRow>;

  sheet.columns = headers.map((h) => ({
    header: String(h),
    key: String(h),
    width: h === 'Merchant' || h === 'Catatan' ? 28 : h === 'Nominal' ? 16 : 14,
  }));

  rows.forEach((r) => sheet.addRow(r));

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  sheet.getRow(1).height = 22;
  sheet.getColumn('Nominal').numFmt = '"Rp" #,##0';
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: headers.length } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Baris total di bawah data.
  const totalRow = sheet.addRow({
    Tanggal: 'TOTAL',
    Nominal: rows.reduce((a, r) => a + (r.Jenis === 'Pengeluaran' ? r.Nominal : 0), 0),
    Catatan: 'Total pengeluaran',
  } as Partial<ExportRow>);
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

export interface PdfSummary {
  period: string;
  income: number;
  expense: number;
  net: number;
  topCategories: Array<{ category: string; amount: number }>;
  userName: string;
  rangeLabel: string;
}

/** Laporan PDF ringkas + tabel transaksi. */
export async function exportPDF(rows: ExportRow[], summary: PdfSummary, filename: string) {
  const { default: JsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CATATIN', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(110);
  y += 18;
  doc.text('Laporan Keuangan Pribadi', marginX, y);
  y += 16;
  doc.text(`${summary.userName} · ${summary.rangeLabel}`, marginX, y);

  doc.setTextColor(20);
  y += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Ringkasan', marginX, y);

  autoTable(doc, {
    startY: y + 8,
    margin: { left: marginX, right: marginX },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ['Total pemasukan', formatIDR(summary.income)],
      ['Total pengeluaran', formatIDR(summary.expense)],
      ['Arus kas bersih', formatIDR(summary.net)],
      ['Jumlah transaksi', String(rows.length)],
    ],
    columnStyles: { 0: { cellWidth: 180, textColor: 110 }, 1: { fontStyle: 'bold' } },
  });

  type DocWithTable = typeof doc & { lastAutoTable?: { finalY: number } };
  let cursor = (doc as DocWithTable).lastAutoTable?.finalY ?? y + 60;

  if (summary.topCategories.length) {
    cursor += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Pengeluaran terbesar', marginX, cursor);
    autoTable(doc, {
      startY: cursor + 8,
      margin: { left: marginX, right: marginX },
      head: [['#', 'Kategori', 'Nominal']],
      body: summary.topCategories.map((c, i) => [String(i + 1), c.category, formatIDR(c.amount)]),
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      columnStyles: { 0: { cellWidth: 28 }, 2: { halign: 'right' } },
    });
    cursor = (doc as DocWithTable).lastAutoTable?.finalY ?? cursor;
  }

  if (rows.length) {
    cursor += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Rincian transaksi', marginX, cursor);
    autoTable(doc, {
      startY: cursor + 8,
      margin: { left: marginX, right: marginX },
      head: [['Tanggal', 'Merchant', 'Kategori', 'Dompet', 'Jenis', 'Nominal']],
      body: rows.map((r) => [
        formatDateShort(r.Tanggal),
        r.Merchant,
        r.Kategori,
        r.Dompet,
        r.Jenis,
        formatIDR(r.Nominal),
      ]),
      styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      columnStyles: { 5: { halign: 'right' } },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Dibuat dengan CATATIN · ${new Date().toLocaleDateString('id-ID')} · Halaman ${i}/${pages}`,
      marginX,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  doc.save(`${filename}.pdf`);
}

export function periodLabel(period: string): string {
  return formatPeriod(period);
}
