import {
  IndividualProjectReportResponseDto,
  ProjectProfitabilityRowDto,
  ReportPeriodMetaDto,
  ReportsPortfolioSummaryDto,
} from '../types';

const inrNumberFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatFixedAmount(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return '0.00';
  }
  return num.toFixed(2);
}

function formatPdfCurrency(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 'INR 0.00';
  }
  if (num < 0) {
    return `-INR ${inrNumberFormatter.format(Math.abs(num))}`;
  }
  return `INR ${inrNumberFormatter.format(num)}`;
}

function formatPeriodText(period: ReportPeriodMetaDto): string {
  if (!period.isDateFiltered) {
    return 'All-Time (Lifetime Recorded Project Data)';
  }
  if (period.fromDate && period.toDate) {
    return `Transaction Period: ${period.fromDate} to ${period.toDate}`;
  }
  if (period.fromDate) {
    return `Transactions From: ${period.fromDate}`;
  }
  return `Transactions Through: ${period.toDate}`;
}

function formatShortDate(raw: Date | string | undefined | null): string {
  if (!raw) {
    return '—';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toISOString().slice(0, 10);
}

function escapeCsvCell(raw: unknown, isNumeric = false): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (isNumeric) {
    return String(raw);
  }
  let str = String(raw).replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildProjectSummariesCsv(params: {
  period: ReportPeriodMetaDto;
  summary: ReportsPortfolioSummaryDto;
  rows: ProjectProfitabilityRowDto[];
}): string {
  const periodLabel = formatPeriodText(params.period);
  const generatedIso = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const lines: string[] = [];

  lines.push(
    [
      escapeCsvCell('Soft Touch Sofas — Project Cost & Profitability Report'),
      escapeCsvCell('Estimated Figures Based on Recorded Project Data (Unaudited)'),
    ].join(','),
  );
  lines.push(
    [
      escapeCsvCell('Reporting Period'),
      escapeCsvCell(periodLabel),
      escapeCsvCell('Generated At'),
      escapeCsvCell(generatedIso),
    ].join(','),
  );
  if (params.period.isDateFiltered) {
    lines.push(
      [
        escapeCsvCell('Note'),
        escapeCsvCell(
          'Purchase and Other Expense columns reflect active transactions dated within the selected period. Lifetime totals are included in separate columns.',
        ),
      ].join(','),
    );
  }
  lines.push('');

  const headers = [
    'Project ID',
    'Project Name',
    'Client Name',
     'Project Status',
    'Reporting Period',
    'Contract Value (INR)',
    'Material Purchase Costs (INR)',
    'Other Project Expenses (INR)',
    'Total Project Costs (INR)',
    params.period.isDateFiltered
      ? 'Contract Minus Period Costs (INR)'
      : 'Estimated Profit (INR)',
    params.period.isDateFiltered
      ? 'Net Margin vs Contract (%)'
      : 'Profit Margin (%)',
    'Lifetime Total Costs (INR)',
    'Lifetime Estimated Profit (INR)',
    'Lifetime Profit Margin (%)',
  ];

  lines.push(headers.map((h) => escapeCsvCell(h)).join(','));

  for (const row of params.rows) {
    lines.push(
      [
        escapeCsvCell(row.projectId),
        escapeCsvCell(row.name),
        escapeCsvCell(row.clientName),
escapeCsvCell(row.status),
        escapeCsvCell(periodLabel),
        escapeCsvCell(formatFixedAmount(row.contractValue), true),
        escapeCsvCell(formatFixedAmount(row.materialPurchaseCosts), true),
        escapeCsvCell(formatFixedAmount(row.otherProjectExpenses), true),
        escapeCsvCell(formatFixedAmount(row.totalProjectCosts), true),
        escapeCsvCell(formatFixedAmount(row.estimatedProfit), true),
        escapeCsvCell(
          row.marginApplicable && row.profitMargin !== null
            ? row.profitMargin.toFixed(2)
            : 'N/A',
        ),
        escapeCsvCell(formatFixedAmount(row.lifetimeTotalProjectCosts), true),
        escapeCsvCell(formatFixedAmount(row.lifetimeEstimatedProfit), true),
        escapeCsvCell(
          row.marginApplicable && row.lifetimeProfitMargin !== null
            ? row.lifetimeProfitMargin.toFixed(2)
            : 'N/A',
        ),
      ].join(','),
    );
  }

  lines.push('');
  lines.push(
    [
      escapeCsvCell('SUMMARY TOTALS'),
      escapeCsvCell(`${params.summary.projectCount} projects`),
      '',
      '',
      '',
      escapeCsvCell(periodLabel),
      escapeCsvCell(formatFixedAmount(params.summary.contractValue), true),
      escapeCsvCell(
        formatFixedAmount(params.summary.materialPurchaseCosts),
        true,
      ),
      escapeCsvCell(
        formatFixedAmount(params.summary.otherProjectExpenses),
        true,
      ),
      escapeCsvCell(formatFixedAmount(params.summary.totalProjectCosts), true),
      escapeCsvCell(formatFixedAmount(params.summary.estimatedProfit), true),
      escapeCsvCell(
        params.summary.marginApplicable && params.summary.profitMargin !== null
          ? params.summary.profitMargin.toFixed(2)
          : 'N/A',
      ),
      escapeCsvCell(
        formatFixedAmount(params.summary.lifetimeTotalProjectCosts),
        true,
      ),
      escapeCsvCell(
        formatFixedAmount(params.summary.lifetimeEstimatedProfit),
        true,
      ),
      escapeCsvCell(
        params.summary.marginApplicable &&
          params.summary.lifetimeProfitMargin !== null
          ? params.summary.lifetimeProfitMargin.toFixed(2)
          : 'N/A',
      ),
    ].join(','),
  );

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function sanitizePdfText(raw: string): string {
  return String(raw || '')
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function truncateText(text: string, maxChars: number): string {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (clean.length <= maxChars) {
    return clean;
  }
  return `${clean.slice(0, Math.max(1, maxChars - 3))}...`;
}

interface PdfPageBuilder {
  commands: string[];
  cursorY: number;
}

export function buildIndividualProjectReportPdf(
  report: IndividualProjectReportResponseDto,
): Buffer {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 42;
  const topY = pageHeight - 46;
  const bottomLimitY = 52;

  const pages: PdfPageBuilder[] = [];

  const startNewPage = (): PdfPageBuilder => {
    const page: PdfPageBuilder = { commands: [], cursorY: topY };
    pages.push(page);
    return page;
  };

  let currentPage = startNewPage();

  const ensureSpace = (neededHeight: number): void => {
    if (currentPage.cursorY - neededHeight < bottomLimitY) {
      currentPage = startNewPage();
    }
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    options: { bold?: boolean; size?: number; gray?: number } = {},
  ): void => {
    const fontKey = options.bold ? '/F2' : '/F1';
    const size = options.size ?? 10;
    const gray = options.gray ?? 0.14;
    currentPage.commands.push(
      `BT ${gray.toFixed(2)} g ${fontKey} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${sanitizePdfText(text)}) Tj ET`,
    );
  };

  const drawRule = (y: number, gray = 0.82): void => {
    currentPage.commands.push(
      `${gray.toFixed(2)} G 0.7 w ${marginX} ${y.toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${y.toFixed(2)} l S`,
    );
  };

  const drawSectionHeader = (title: string): void => {
    ensureSpace(34);
    currentPage.cursorY -= 10;
    drawText(title, marginX, currentPage.cursorY, {
      bold: true,
      size: 11.5,
      gray: 0.18,
    });
    currentPage.cursorY -= 6;
    drawRule(currentPage.cursorY, 0.75);
    currentPage.cursorY -= 14;
  };

  const drawKeyValueRow = (label: string, value: string): void => {
    ensureSpace(16);
    drawText(label, marginX, currentPage.cursorY, {
      bold: false,
      size: 9.5,
      gray: 0.35,
    });
    drawText(value, marginX + 210, currentPage.cursorY, {
      bold: true,
      size: 9.5,
      gray: 0.12,
    });
    currentPage.cursorY -= 15;
  };

  drawText(
    'SOFT TOUCH SOFAS - PROJECT COST & PROFITABILITY REPORT',
    marginX,
    currentPage.cursorY,
    { bold: true, size: 13.5, gray: 0.12 },
  );
  currentPage.cursorY -= 15;
  drawText(
    'Estimated financial figures based on recorded project vouchers (unaudited)',
    marginX,
    currentPage.cursorY,
    { size: 9, gray: 0.38 },
  );
  currentPage.cursorY -= 13;
  drawText(
    `Reporting Scope: ${formatPeriodText(report.period)}`,
    marginX,
    currentPage.cursorY,
    { bold: true, size: 9.5, gray: 0.22 },
  );
  currentPage.cursorY -= 10;
  drawRule(currentPage.cursorY, 0.65);
  currentPage.cursorY -= 14;

  drawSectionHeader('1. Project Information');
  drawKeyValueRow(
    'Project ID & Name',
    `${report.project.projectId} - ${truncateText(report.project.name, 48)}`,
  );
  drawKeyValueRow('Client Name', truncateText(report.project.clientName, 52));
  drawKeyValueRow(
    'Category & Status',
    `${report.project.category} | ${report.project.status}`,
  );
  drawKeyValueRow(
    'Contract Value',
    formatPdfCurrency(report.project.contractValue),
  );
  drawKeyValueRow(
    'Created / Last Activity',
    `${formatShortDate(report.project.createdAt)} / ${formatShortDate(report.project.lastActivityAt)}`,
  );

  const life = report.financialOverview.lifetime;
  drawSectionHeader('2. Lifetime Financial Overview (Estimated)');
  drawKeyValueRow('Contract Value', formatPdfCurrency(life.contractValue));
  drawKeyValueRow(
    'Material Purchase Costs',
    formatPdfCurrency(life.materialPurchaseCosts),
  );
  drawKeyValueRow(
    'Other Project Expenses',
    formatPdfCurrency(life.otherProjectExpenses),
  );
  drawKeyValueRow(
    'Total Project Costs',
    formatPdfCurrency(life.totalProjectCosts),
  );
  drawKeyValueRow(
    'Estimated Profit / (Loss)',
    formatPdfCurrency(life.estimatedProfit),
  );
  drawKeyValueRow(
    'Estimated Profit Margin',
    life.marginApplicable && life.profitMargin !== null
      ? `${life.profitMargin.toFixed(2)}%`
      : 'N/A (Zero Contract Value)',
  );
  drawKeyValueRow(
    'Cost % of Contract Value',
    life.costPercentageApplicable && life.costPercentage !== null
      ? `${life.costPercentage.toFixed(2)}%`
      : 'N/A (Zero Contract Value)',
  );

  if (report.period.isDateFiltered) {
    const per = report.financialOverview.selectedPeriod;
    drawSectionHeader(
      `3. Selected Period Cost Summary (${report.period.fromDate || 'Start'} to ${report.period.toDate || 'Present'})`,
    );
    drawKeyValueRow(
      'Period Material Purchases',
      `${formatPdfCurrency(per.materialPurchaseCosts)} (${per.purchaseCount} vouchers)`,
    );
    drawKeyValueRow(
      'Period Other Expenses',
      `${formatPdfCurrency(per.otherProjectExpenses)} (${per.expenseCount} vouchers)`,
    );
    drawKeyValueRow(
      'Combined Period Costs',
      formatPdfCurrency(per.totalProjectCosts),
    );
    drawKeyValueRow(
      'Full Contract Minus Period Costs',
      `${formatPdfCurrency(per.netAgainstContract)} (period comparison only, not lifetime profit)`,
    );
  }

  drawSectionHeader(
    `Purchase History (${report.purchaseHistory.length} Recorded Vouchers)`,
  );
  if (report.purchaseHistory.length === 0) {
    ensureSpace(16);
    drawText(
      'No active purchase vouchers recorded in this reporting scope.',
      marginX,
      currentPage.cursorY,
      { size: 9, gray: 0.42 },
    );
    currentPage.cursorY -= 14;
  } else {
    for (const pv of report.purchaseHistory) {
      ensureSpace(16);
      const line = `${formatShortDate(pv.purchaseDate)} | ${pv.voucherNumber} | ${truncateText(pv.supplierName, 26)} | ${truncateText(pv.materialsSummary, 28)} | ${formatPdfCurrency(pv.finalTotal)}`;
      drawText(line, marginX, currentPage.cursorY, { size: 8.8, gray: 0.16 });
      currentPage.cursorY -= 13;
    }
  }

  drawSectionHeader(
    `Expense History (${report.expenseHistory.length} Recorded Vouchers)`,
  );
  if (report.expenseHistory.length === 0) {
    ensureSpace(16);
    drawText(
      'No active project expense vouchers recorded in this reporting scope.',
      marginX,
      currentPage.cursorY,
      { size: 9, gray: 0.42 },
    );
    currentPage.cursorY -= 14;
  } else {
    for (const ev of report.expenseHistory) {
      ensureSpace(16);
      const line = `${formatShortDate(ev.expenseDate)} | ${ev.voucherNumber} | ${truncateText(ev.categoryName, 18)} | ${truncateText(ev.description, 34)} | ${formatPdfCurrency(ev.amount)}`;
      drawText(line, marginX, currentPage.cursorY, { size: 8.8, gray: 0.16 });
      currentPage.cursorY -= 13;
    }
  }

  drawSectionHeader(
    `Date-Wise Cost History (${report.dateWiseCostHistory.length} Active Dates)`,
  );
  if (report.dateWiseCostHistory.length === 0) {
    ensureSpace(16);
    drawText(
      'No dated cost entries recorded in this reporting scope.',
      marginX,
      currentPage.cursorY,
      { size: 9, gray: 0.42 },
    );
    currentPage.cursorY -= 14;
  } else {
    for (const bucket of report.dateWiseCostHistory) {
      ensureSpace(16);
      const line = `${bucket.date} | Purchases: ${formatPdfCurrency(bucket.purchaseCosts)} | Expenses: ${formatPdfCurrency(bucket.otherExpenses)} | Day Total: ${formatPdfCurrency(bucket.totalCosts)}`;
      drawText(line, marginX, currentPage.cursorY, { size: 8.8, gray: 0.16 });
      currentPage.cursorY -= 13;
    }
  }

  pages.forEach((p, idx) => {
    p.commands.push(
      `BT 0.45 g /F1 8 Tf ${marginX} 26 Td (${sanitizePdfText(
        `Soft Touch Sofas - ${report.project.projectId} - Page ${idx + 1} of ${pages.length}`,
      )}) Tj ET`,
    );
  });

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageObjectNumbers: number[] = [];

  for (const page of pages) {
    const streamContent = page.commands.join('\n');
    const streamByteLen = Buffer.byteLength(streamContent, 'ascii');
    const contentObjNum = objects.length + 1;
    objects.push(
      `<< /Length ${streamByteLen} >>\nstream\n${streamContent}\nendstream`,
    );

    const pageObjNum = objects.length + 1;
    pageObjectNumbers.push(pageObjNum);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let byteOffset = Buffer.byteLength(chunks[0], 'ascii');

  objects.forEach((body, idx) => {
    offsets.push(byteOffset);
    const objStr = `${idx + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(objStr);
    byteOffset += Buffer.byteLength(objStr, 'ascii');
  });

  const xrefOffset = byteOffset;
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');
  for (let i = 1; i <= objects.length; i += 1) {
    chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(''), 'ascii');
}
