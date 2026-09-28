import { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { formatBs } from './money';
import { dibujarEncabezadoPdf, PDF_COLOR } from './pdf-voucher';
import { datosEmpresa } from './empresa';

export type Celda = string | number;

export interface HojaExport {
    nombre: string;
    titulo: string;
    subtitulo?: string;
    resumen?: { label: string; valor: Celda }[];
    columnas: string[];
    filas: Celda[][];
}

const PAD_X = 6;
const PAD_Y = 5;
const FONT_SIZE = 8;
const HEADER_H = 22;
const MIN_ROW_H = 20;

function celdaTexto(valor: Celda, columna = ''): string {
    if (valor == null || valor === '') {
        return '';
    }
    if (typeof valor === 'number') {
        if (/nro|nº|#|cantidad|cant\.?/i.test(columna)) {
            return Number.isInteger(valor) ? String(valor) : valor.toLocaleString('es-BO');
        }
        return formatBs(valor);
    }
    return String(valor);
}

function pesoColumna(nombre: string): number {
    const n = nombre.toLowerCase();
    if (/concepto|descripci[oó]n|observaci|detalle/.test(n)) return 2.8;
    if (/cliente|proveedor/.test(n)) return 1.7;
    if (/categor[ií]a|origen/.test(n)) return 1.4;
    if (/fecha/.test(n)) return 1.45;
    if (/m[eé]todo/.test(n)) return 0.95;
    if (/usuario|estado/.test(n)) return 0.9;
    if (/^tipo$/.test(n)) return 0.9;
    if (/nro|nº|#/.test(n)) return 0.7;
    if (/monto|total|precio|saldo|cobrado|pagado|ingreso|egreso|cantidad/.test(n)) return 1.15;
    return 1;
}

function alinearColumna(nombre: string, valor: Celda): 'left' | 'right' | 'center' {
    if (typeof valor === 'number') {
        return 'right';
    }
    const n = nombre.toLowerCase();
    if (/monto|total|precio|saldo|cobrado|pagado|ingreso|egreso|cantidad|p\.\s*unit/.test(n)) {
        return 'right';
    }
    if (/^tipo$|estado|m[eé]todo/.test(n)) {
        return 'center';
    }
    return 'left';
}

function anchosColumnas(columnas: string[], pageWidth: number): number[] {
    const pesos = columnas.map(pesoColumna);
    const suma = pesos.reduce((acc, p) => acc + p, 0) || 1;
    return pesos.map((p) => (p / suma) * pageWidth);
}

function nombreArchivo(base: string, ext: string): string {
    const limpio = base.replace(/[^\w.-]+/g, '_');
    return `${limpio}.${ext}`;
}

function cabecerasDescarga(res: Response, filename: string, contentType: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

export async function enviarExcel(res: Response, baseNombre: string, hojas: HojaExport[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ingenio Arrocero Royal';
    workbook.created = new Date();

    for (const hoja of hojas) {
        const sheet = workbook.addWorksheet(hoja.nombre.slice(0, 31));
        let fila = 1;
        sheet.mergeCells(fila, 1, fila, Math.max(hoja.columnas.length, 2));
        const titulo = sheet.getCell(fila, 1);
        titulo.value = hoja.titulo;
        titulo.font = { bold: true, size: 14 };
        fila += 1;
        if (hoja.subtitulo) {
            sheet.mergeCells(fila, 1, fila, Math.max(hoja.columnas.length, 2));
            sheet.getCell(fila, 1).value = hoja.subtitulo;
            sheet.getCell(fila, 1).font = { italic: true, color: { argb: 'FF666666' } };
            fila += 1;
        }
        fila += 1;
        if (hoja.resumen?.length) {
            for (const item of hoja.resumen) {
                sheet.getCell(fila, 1).value = item.label;
                sheet.getCell(fila, 1).font = { bold: true };
                const celda = sheet.getCell(fila, 2);
                if (typeof item.valor === 'number') {
                    celda.value = item.valor;
                    celda.numFmt = '"Bs" #,##0.00';
                } else {
                    celda.value = item.valor;
                }
                fila += 1;
            }
            fila += 1;
        }
        const headerRow = sheet.getRow(fila);
        hoja.columnas.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA51C24' } };
        });
        fila += 1;
        for (const datos of hoja.filas) {
            const row = sheet.getRow(fila);
            datos.forEach((valor, i) => {
                const cell = row.getCell(i + 1);
                if (typeof valor === 'number') {
                    cell.value = valor;
                    cell.numFmt = '#,##0.00';
                } else {
                    cell.value = valor;
                }
            });
            fila += 1;
        }
        sheet.columns.forEach((col, i) => {
            const nombre = hoja.columnas[i] || '';
            col.width = Math.round(pesoColumna(nombre) * 14);
        });
    }

    const filename = nombreArchivo(baseNombre, 'xlsx');
    cabecerasDescarga(res, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
}

export function enviarPdf(res: Response, baseNombre: string, hojas: HojaExport[]): void {
    const muchasColumnas = hojas.some((h) => h.columnas.length > 6);
    const doc = new PDFDocument({
        size: 'A4',
        layout: muchasColumnas ? 'landscape' : 'portrait',
        margin: 36,
        bufferPages: true,
        info: {
            Title: hojas[0]?.titulo || baseNombre,
            Author: datosEmpresa().nombre
        }
    });
    const filename = nombreArchivo(baseNombre, 'pdf');
    cabecerasDescarga(res, filename, 'application/pdf');
    doc.pipe(res);

    hojas.forEach((hoja, index) => {
        if (index > 0) {
            doc.addPage();
        }
        dibujarHoja(doc, hoja);
    });
    numerarPaginas(doc);
    doc.end();
}

function numerarPaginas(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    const empresa = datosEmpresa();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const left = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const y = doc.page.height - 26;
        doc.save();
        doc.strokeColor(PDF_COLOR.linea).lineWidth(0.6);
        doc.moveTo(left, y - 8).lineTo(left + width, y - 8).stroke();
        doc.font('Helvetica').fontSize(7).fillColor(PDF_COLOR.muted);
        doc.text(empresa.nombre, left, y, { width: width / 2, lineBreak: false });
        doc.text(`Página ${i + 1} de ${range.count}`, left, y, { width, align: 'right', lineBreak: false });
        doc.restore();
    }
}

function dibujarResumen(doc: PDFKit.PDFDocument, resumen: { label: string; valor: Celda }[], startX: number, pageWidth: number): void {
    const cols = 2;
    const colW = pageWidth / cols;
    const lineH = 16;
    const pad = 10;
    const filas = Math.ceil(resumen.length / cols);
    const boxH = filas * lineH + pad * 2;
    const y0 = doc.y;
    doc.save();
    doc.roundedRect(startX, y0, pageWidth, boxH, 4).fillAndStroke(PDF_COLOR.fondoResumen, PDF_COLOR.linea);
    doc.fontSize(8);
    resumen.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + pad + col * colW;
        const y = y0 + pad + row * lineH;
        const labelW = Math.min(150, colW * 0.48);
        doc.fillColor(PDF_COLOR.muted).font('Helvetica').text(item.label, x, y, {
            width: labelW,
            lineBreak: false
        });
        doc.fillColor(PDF_COLOR.texto).font('Helvetica-Bold').text(celdaTexto(item.valor, item.label), x + labelW, y, {
            width: colW - labelW - pad * 2,
            align: typeof item.valor === 'number' ? 'right' : 'left',
            lineBreak: false
        });
    });
    doc.restore();
    doc.y = y0 + boxH + 14;
}

function alturaFila(doc: PDFKit.PDFDocument, fila: Celda[], columnas: string[], anchos: number[]): number {
    doc.font('Helvetica').fontSize(FONT_SIZE);
    let maxH = 11;
    columnas.forEach((col, i) => {
        const texto = celdaTexto(fila[i], col);
        const h = doc.heightOfString(texto || ' ', {
            width: Math.max(12, anchos[i] - PAD_X * 2),
            align: alinearColumna(col, fila[i])
        });
        if (h > maxH) {
            maxH = h;
        }
    });
    return Math.max(MIN_ROW_H, maxH + PAD_Y * 2);
}

function dibujarHoja(doc: PDFKit.PDFDocument, hoja: HojaExport): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const bottom = doc.page.height - 40;
    dibujarEncabezadoPdf(doc, hoja.titulo, hoja.subtitulo);
    if (hoja.resumen?.length) {
        dibujarResumen(doc, hoja.resumen, startX, pageWidth);
    }
    if (!hoja.columnas.length) {
        return;
    }
    const anchos = anchosColumnas(hoja.columnas, pageWidth);
    let tablaInicio = 0;

    const pintarCabecera = () => {
        const y = doc.y;
        tablaInicio = y;
        doc.save();
        doc.rect(startX, y, pageWidth, HEADER_H).fill(PDF_COLOR.vino);
        let x = startX;
        doc.fillColor(PDF_COLOR.blanco).font('Helvetica-Bold').fontSize(FONT_SIZE);
        hoja.columnas.forEach((col, i) => {
            doc.text(col, x + PAD_X, y + 7, {
                width: anchos[i] - PAD_X * 2,
                align: alinearColumna(col, ''),
                lineBreak: false
            });
            x += anchos[i];
        });
        doc.restore();
        doc.y = y + HEADER_H;
    };

    const enmarcarTabla = (yFin: number) => {
        if (!tablaInicio || yFin <= tablaInicio) {
            return;
        }
        doc.save();
        doc.strokeColor(PDF_COLOR.vinoOscuro).lineWidth(0.7);
        doc.rect(startX, tablaInicio, pageWidth, yFin - tablaInicio).stroke();
        doc.restore();
    };

    pintarCabecera();
    hoja.filas.forEach((fila, idx) => {
        const rowH = alturaFila(doc, fila, hoja.columnas, anchos);
        if (doc.y + rowH > bottom) {
            enmarcarTabla(doc.y);
            doc.addPage();
            dibujarEncabezadoPdf(doc, `${hoja.titulo} (cont.)`, hoja.subtitulo);
            pintarCabecera();
        }
        const y = doc.y;
        doc.save();
        if (idx % 2 === 0) {
            doc.rect(startX, y, pageWidth, rowH).fill(PDF_COLOR.zebra);
        }
        doc.strokeColor(PDF_COLOR.linea).lineWidth(0.4);
        doc.moveTo(startX, y + rowH).lineTo(startX + pageWidth, y + rowH).stroke();
        let x = startX;
        doc.fillColor(PDF_COLOR.texto).font('Helvetica').fontSize(FONT_SIZE);
        hoja.columnas.forEach((col, i) => {
            const texto = celdaTexto(fila[i], col);
            doc.text(texto, x + PAD_X, y + PAD_Y, {
                width: anchos[i] - PAD_X * 2,
                align: alinearColumna(col, fila[i])
            });
            x += anchos[i];
        });
        doc.restore();
        doc.y = y + rowH;
    });
    enmarcarTabla(doc.y);
}
