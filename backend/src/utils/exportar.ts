import { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { formatBs } from './money';
import { dibujarEncabezadoPdf } from './pdf-voucher';

export type Celda = string | number;

export interface HojaExport {
    nombre: string;
    titulo: string;
    subtitulo?: string;
    resumen?: { label: string; valor: Celda }[];
    columnas: string[];
    filas: Celda[][];
}

function celdaTexto(valor: Celda): string {
    if (typeof valor === 'number') {
        return formatBs(valor);
    }
    return valor == null ? '' : String(valor);
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
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
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
        sheet.columns.forEach((col) => {
            col.width = 18;
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
        margin: 40
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
    doc.end();
}

function dibujarHoja(doc: PDFKit.PDFDocument, hoja: HojaExport): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    dibujarEncabezadoPdf(doc, hoja.titulo, hoja.subtitulo);
    if (hoja.resumen?.length) {
        doc.font('Helvetica').fontSize(10);
        for (const item of hoja.resumen) {
            doc.text(`${item.label}: ${celdaTexto(item.valor)}`);
        }
        doc.moveDown(0.6);
    }
    if (!hoja.columnas.length) {
        return;
    }
    const colCount = hoja.columnas.length;
    const colWidth = pageWidth / colCount;
    const startX = doc.page.margins.left;
    const rowHeight = 18;
    const bottom = doc.page.height - doc.page.margins.bottom;

    const pintarCabecera = () => {
        let x = startX;
        const y = doc.y;
        doc.rect(startX, y, pageWidth, rowHeight).fill('#1F4E79');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
        hoja.columnas.forEach((col, i) => {
            doc.text(col, x + 3, y + 5, { width: colWidth - 6, ellipsis: true });
            x += colWidth;
        });
        doc.fillColor('#000000').font('Helvetica');
        doc.y = y + rowHeight;
    };

    pintarCabecera();
    hoja.filas.forEach((fila, idx) => {
        if (doc.y + rowHeight > bottom) {
            doc.addPage();
            pintarCabecera();
        }
        const y = doc.y;
        if (idx % 2 === 0) {
            doc.rect(startX, y, pageWidth, rowHeight).fill('#F3F4F6');
            doc.fillColor('#000000');
        }
        let x = startX;
        fila.forEach((valor, i) => {
            doc.fontSize(8).text(celdaTexto(valor), x + 3, y + 5, { width: colWidth - 6, ellipsis: true });
            x += colWidth;
        });
        doc.y = y + rowHeight;
    });
}
