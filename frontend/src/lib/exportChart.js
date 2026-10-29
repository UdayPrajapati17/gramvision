// Saving a chart or its numbers to a file, entirely in the browser.
import { full } from './format.js';

function triggerDownload(href, filename, revoke = false) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) URL.revokeObjectURL(href);
}

/** Rasterise one chart's SVG at 2× so the PNG stays sharp in a document. */
export function exportChartPng(container, filename = 'gramvision-chart.png', title = '') {
  const svg = container?.querySelector('svg.recharts-surface') || container?.querySelector('svg');
  if (!svg) throw new Error('Build a chart before exporting it.');

  const box = svg.getBoundingClientRect();
  const width = Math.max(640, Math.round(box.width));
  const chartHeight = Math.max(280, Math.round(box.height));
  const titleBand = title ? 46 : 0;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(chartHeight));

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent =
    "text { font-family: Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif; }";
  clone.insertBefore(style, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = (chartHeight + titleBand) * scale;
    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, chartHeight + titleBand);
    if (title) {
      context.fillStyle = '#102a24';
      context.font = "600 15px Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif";
      context.fillText(title, 16, 28);
    }
    context.drawImage(image, 0, titleBand);
    URL.revokeObjectURL(url);
    triggerDownload(canvas.toDataURL('image/png'), filename);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    throw new Error('This browser could not convert the chart to an image.');
  };
  image.src = url;
}

/** The numbers behind a chart, as a spreadsheet-ready file. */
export function exportRowsCsv(rows, columns, filename = 'gramvision-chart-data.csv') {
  const escape = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map(escape).join(',')];
  for (const row of rows) lines.push(columns.map((column) => escape(row[column])).join(','));
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), filename, true);
}

export function chartRowsForExport(data, keys) {
  return data.map((row) => {
    const output = { Category: row.name };
    for (const key of keys) output[key] = full(row[key] ?? row.value);
    return output;
  });
}

export function slug(text) {
  return String(text || 'chart')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
