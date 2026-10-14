import path from 'path';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { datosEmpresa, EmpresaDatos, rutaLogotipo } from './empresa';

export interface OpcionesPdfReporte { empresa?: EmpresaDatos; logotipo?: string | null; }
const contextosPdf = new WeakMap<PDFKit.PDFDocument, OpcionesPdfReporte>();
function empresaPdf(doc: PDFKit.PDFDocument) { return contextosPdf.get(doc)?.empresa ?? datosEmpresa(); }

export type Celda = string | number;

export interface HojaExport {
    textoCompleto?: boolean;
    nombre: string;
    titulo: string;
    tituloSecundario?: string;
    subtitulo?: string;
    usuario?: string;
    plantilla?: 'formal';
    consulta?: { label: string; valor: string }[];
    mostrarFirma?: boolean;
    meta?: { label: string; valor: Celda }[];
    resumen?: { label: string; valor: Celda }[];
    columnas: string[];
    filas: Celda[][];
    /** Totales al pie, alineados bajo la última celda de cada columna. */
    pie?: Celda[][];
}

const PAD = 4;
const FONT_SIZE = 7;
const CARTA_EXCEL = 1;
const COLOR_LINEA = '#000000';
const COLOR_TEXTO = '#000000';
const COLOR_CABECERA = '#000000';
const COLOR_CABECERA_TEXTO = '#FFFFFF';
const COLOR_PIE = '#F3F3F3';

function esColumnaEntera(columna: string): boolean {
    return /nro|n[°º]|#|cantidad|cant\.?|atraso|d[ií]as|stock|m[ií]nimo|fanegas/i.test(columna);
}

function esColumnaMoneda(nombre: string): boolean {
    return /monto|total|precio|saldo|cobrado|pagado|ingreso|egreso|cargo|abono|compra|p\.\s*(venta|compra|unit)|subtotal|vendido|pendiente/i.test(nombre);
}

function esColumnaSumable(nombre: string): boolean {
    if (/nro|n[°º]|#|atraso|d[ií]as/i.test(nombre)) {
        return false;
    }
    if (/cantidad|cant\.?/i.test(nombre)) {
        return true;
    }
    return esColumnaMoneda(nombre);
}

function textoNumero(valor: number, columna = ''): string {
    if (esColumnaEntera(columna) && Number.isInteger(valor)) {
        return String(valor);
    }
    return valor.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function celdaTexto(valor: Celda, columna = ''): string {
    if (valor == null || valor === '') {
        return '';
    }
    if (typeof valor === 'number') {
        return textoNumero(valor, columna);
    }
    return String(valor);
}

function recapValor(valor: Celda, label: string): string {
    if (typeof valor === 'number') {
        if (esColumnaEntera(label) && Number.isInteger(valor)) {
            return String(valor);
        }
        return `${textoNumero(valor, label)} Bs.`;
    }
    return String(valor ?? '');
}

function pesoColumna(nombre: string): number {
    const n = nombre.toLowerCase();
    if (/concepto|descripci[oó]n|observaci|detalle/.test(n)) return 2.8;
    if (/chofer|productor/.test(n)) return 1.6;
    if (/boleta|placa|fanegas/.test(n)) return 0.9;
    if (/cliente|proveedor/.test(n)) return 2.2;
    if (/categor[ií]a|origen/.test(n)) return 1.4;
    if (/fecha/.test(n)) return 0.95;
    if (/m[eé]todo/.test(n)) return 0.95;
    if (/usuario|estado/.test(n)) return 0.9;
    if (/^tipo$/.test(n)) return 0.85;
    if (/n[°º].*venta|venta/.test(n) && /n[°º]|nro/.test(n)) return 0.8;
    if (/^n[°º]$|^#$|^nro$/.test(n.trim())) return 0.42;
    if (/nro|n[°º]|#/.test(n)) return 0.7;
    if (/atraso|d[ií]as/.test(n)) return 0.78;
    if (/vencimiento/.test(n)) return 1.05;
    if (/monto|total|precio|saldo|cobrado|pagado|ingreso|egreso|cantidad|cargo|abono|compra|\(bs\)/.test(n)) return 1.05;
    return 1;
}

function alinearColumna(nombre: string, valor: Celda): 'left' | 'right' | 'center' {
    if (typeof valor === 'number') {
        return 'right';
    }
    const n = nombre.toLowerCase();
    if (/monto|total|precio|saldo|cobrado|pagado|ingreso|egreso|cantidad|p\.\s*unit|cant/.test(n)) {
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
    const raw = pesos.map((p) => (p / suma) * pageWidth);
    const anchos = raw.map((n) => Math.floor(n * 10) / 10);
    const usados = anchos.slice(0, -1).reduce((acc, n) => acc + n, 0);
    if (anchos.length) {
        anchos[anchos.length - 1] = pageWidth - usados;
    }
    return anchos;
}

function nombreArchivo(base: string, ext: string): string {
    const limpio = base.replace(/[^\w.-]+/g, '_');
    return `${limpio}.${ext}`;
}

function cabecerasDescarga(res: Response, filename: string, contentType: string): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

function fmtGenerado(fecha = new Date()): string {
    return fecha.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function camposCabecera(hoja: HojaExport, empresa = datosEmpresa()): { label: string; valor: string }[] {
    const campos: { label: string; valor: string }[] = [
        { label: 'Empresa', valor: empresa.nombre },
        { label: 'Dirección', valor: [empresa.direccion, empresa.ciudad].filter(Boolean).join(' — ') || '-' },
        { label: 'Generado', valor: fmtGenerado() },
        { label: 'Periodo', valor: hoja.subtitulo || '-' }
    ];
    if (hoja.usuario) {
        campos.push({ label: 'Usuario', valor: hoja.usuario });
    }
    if (empresa.telefono) {
        campos.push({ label: 'Teléfono', valor: empresa.telefono });
    }
    if (empresa.nit) {
        campos.push({ label: 'NIT', valor: empresa.nit });
    }
    for (const item of hoja.meta || []) {
        campos.push({ label: item.label, valor: celdaTexto(item.valor, item.label) });
    }
    return campos.filter((c) => c.valor && c.valor !== '-');
}

function construirPie(hoja: HojaExport): Celda[][] {
    if (hoja.plantilla === 'formal') {
        return hoja.pie || [];
    }
    if (hoja.pie?.length) {
        return hoja.pie;
    }
    if (!hoja.filas.length) {
        return [];
    }
    const tieneFlujo = hoja.columnas.some((c) => /cargo|abono|^pagos$/i.test(c));
    let hayNumero = false;
    const pie: Celda[] = hoja.columnas.map((col, i) => {
        const valores = hoja.filas.map((f) => f[i]).filter((v) => typeof v === 'number') as number[];
        if (!valores.length || !esColumnaSumable(col)) {
            return '';
        }
        hayNumero = true;
        if (/^saldo$/i.test(col) && tieneFlujo) {
            return valores[valores.length - 1];
        }
        return Math.round(valores.reduce((acc, n) => acc + n, 0) * 100) / 100;
    });
    if (!hayNumero) {
        return [];
    }
    const firstNum = pie.findIndex((v) => typeof v === 'number');
    if (firstNum > 0 && pie[firstNum - 1] === '') {
        pie[firstNum - 1] = 'Total';
    }
    return [pie];
}

function bordeExcel(): Partial<ExcelJS.Borders> {
    const lado: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
    return { top: lado, left: lado, bottom: lado, right: lado };
}

function extensionLogo(archivo: string): 'jpeg' | 'png' {
    const ext = path.extname(archivo).toLowerCase();
    return ext === '.png' ? 'png' : 'jpeg';
}

function mergeExcel(sheet: ExcelJS.Worksheet, row: number, fromCol: number, toCol: number): void {
    if (fromCol >= 1 && toCol > fromCol) {
        sheet.mergeCells(row, fromCol, row, toCol);
    }
}

function pintarHojaExcelFormal(
    sheet: ExcelJS.Worksheet,
    hoja: HojaExport,
    logoId: number | null
): void {
    const empresa = datosEmpresa();
    const lastCol = Math.max(hoja.columnas.length, 8);
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    const negro = { argb: 'FF000000' as const };
    const gris = { argb: 'FFF2F2F2' as const };
    if (logoId != null) {
        sheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 70, height: 52 }
        });
    }
    const infoCol = logoId != null ? 3 : 1;
    const infoEnd = Math.min(6, lastCol - 2);
    mergeExcel(sheet, 1, infoCol, infoEnd);
    const nombre = sheet.getCell(1, infoCol);
    nombre.value = empresa.nombre;
    nombre.font = { bold: true, size: 14, color: negro };
    mergeExcel(sheet, 2, infoCol, infoEnd);
    sheet.getCell(2, infoCol).value = 'Sistema de Gestión Administrativa';
    sheet.getCell(2, infoCol).font = { size: 9, color: negro };
    let infoFila = 3;
    const direccion = [empresa.direccion, empresa.ciudad].filter(Boolean).join(' — ');
    if (direccion) {
        mergeExcel(sheet, infoFila, infoCol, infoEnd);
        sheet.getCell(infoFila, infoCol).value = direccion;
        sheet.getCell(infoFila, infoCol).font = { size: 9, color: negro };
        infoFila += 1;
    }
    if (empresa.telefono) {
        mergeExcel(sheet, infoFila, infoCol, infoEnd);
        sheet.getCell(infoFila, infoCol).value = `Teléfono: ${empresa.telefono}`;
        sheet.getCell(infoFila, infoCol).font = { size: 9, color: negro };
        infoFila += 1;
    }
    if (empresa.email) {
        mergeExcel(sheet, infoFila, infoCol, infoEnd);
        sheet.getCell(infoFila, infoCol).value = `Correo: ${empresa.email}`;
        sheet.getCell(infoFila, infoCol).font = { size: 9, color: negro };
        infoFila += 1;
    }
    const metaCol = lastCol - 1;
    const meta = [
        { label: 'Fecha de generación:', valor: fecha },
        { label: 'Hora:', valor: hora }
    ];
    if (hoja.usuario) {
        meta.push({ label: 'Usuario:', valor: hoja.usuario });
    }
    meta.forEach((item, i) => {
        const r = 1 + i;
        sheet.getCell(r, metaCol).value = item.label;
        sheet.getCell(r, metaCol).font = { bold: true, size: 9, color: negro };
        sheet.getCell(r, metaCol).alignment = { horizontal: 'right' };
        sheet.getCell(r, lastCol).value = item.valor;
        sheet.getCell(r, lastCol).font = { size: 9, color: negro };
    });
    let fila = Math.max(infoFila, 1 + meta.length) + 1;
    mergeExcel(sheet, fila, 1, lastCol);
    const titulo = sheet.getCell(fila, 1);
    titulo.value = (hoja.titulo || '').toUpperCase();
    titulo.font = { bold: true, size: 14, color: negro };
    titulo.alignment = { horizontal: 'center' };
    fila += 1;
    if (hoja.tituloSecundario) {
        mergeExcel(sheet, fila, 1, lastCol);
        const sub = sheet.getCell(fila, 1);
        sub.value = hoja.tituloSecundario.toUpperCase();
        sub.font = { bold: true, size: 12, color: negro };
        sub.alignment = { horizontal: 'center' };
        fila += 1;
    }
    if (hoja.subtitulo) {
        mergeExcel(sheet, fila, 1, lastCol);
        const per = sheet.getCell(fila, 1);
        per.value = hoja.subtitulo;
        per.font = { size: 9, color: negro };
        per.alignment = { horizontal: 'center' };
        fila += 1;
    }
    fila += 1;
    const headerRow = sheet.getRow(fila);
    hoja.columnas.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col;
        cell.font = { bold: true, size: 9, color: negro };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: gris };
        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: alinearColumna(col, '') };
        cell.border = bordeExcel();
    });
    headerRow.height = 18;
    const filaHeader = fila;
    fila += 1;
    for (const datos of hoja.filas) {
        const row = sheet.getRow(fila);
        datos.forEach((valor, i) => {
            const cell = row.getCell(i + 1);
            const nombreCol = hoja.columnas[i] || '';
            if (typeof valor === 'number') {
                cell.value = valor;
                cell.numFmt = esColumnaEntera(nombreCol) ? '0' : '#,##0.00';
            } else {
                cell.value = valor;
            }
            cell.font = { size: 9, color: negro, bold: String(valor) === 'VENCIDA' };
            cell.alignment = { wrapText: true, vertical: 'middle', horizontal: alinearColumna(nombreCol, valor) };
            cell.border = bordeExcel();
        });
        row.height = 16;
        fila += 1;
    }
    if (hoja.resumen?.length) {
        fila += 1;
        const colLabel = Math.max(1, lastCol - 2);
        for (const item of hoja.resumen) {
            const pendiente = /pendiente/i.test(item.label);
            mergeExcel(sheet, fila, colLabel, lastCol - 1);
            const lab = sheet.getCell(fila, colLabel);
            lab.value = `${item.label}:`;
            lab.font = { bold: pendiente, size: 9, color: negro };
            lab.alignment = { horizontal: 'right', vertical: 'middle' };
            const val = sheet.getCell(fila, lastCol);
            if (typeof item.valor === 'number') {
                val.value = item.valor;
                val.numFmt = '"Bs" #,##0.00';
            } else {
                val.value = item.valor;
            }
            val.font = { bold: pendiente, size: 9, color: negro };
            val.alignment = { horizontal: 'right' };
            fila += 1;
        }
    }
    if (hoja.consulta?.length) {
        fila += 1;
        sheet.getCell(fila, 1).value = 'Consulta:';
        sheet.getCell(fila, 1).font = { size: 9, color: negro };
        fila += 1;
        for (const item of hoja.consulta) {
            mergeExcel(sheet, fila, 1, Math.min(4, lastCol));
            sheet.getCell(fila, 1).value = `${item.label}: ${item.valor}`;
            sheet.getCell(fila, 1).font = { size: 8, color: negro };
            fila += 1;
        }
    }
    if (hoja.mostrarFirma) {
        fila += 2;
        const firmaCol = Math.max(1, lastCol - 2);
        mergeExcel(sheet, fila, firmaCol, lastCol);
        const linea = sheet.getCell(fila, firmaCol);
        linea.border = { bottom: { style: 'thin', color: negro } };
        fila += 1;
        mergeExcel(sheet, fila, firmaCol, lastCol);
        const firma = sheet.getCell(fila, firmaCol);
        firma.value = 'Firma';
        firma.font = { size: 8, color: negro };
        firma.alignment = { horizontal: 'center' };
        fila += 1;
        mergeExcel(sheet, fila, firmaCol, lastCol);
        const emp = sheet.getCell(fila, firmaCol);
        emp.value = empresa.nombre;
        emp.font = { size: 8, color: negro };
        emp.alignment = { horizontal: 'center' };
    }
    hoja.columnas.forEach((nombre, i) => {
        sheet.getColumn(i + 1).width = Math.max(6, Math.round(pesoColumnaFormal(nombre) * 11));
    });
    sheet.pageSetup = {
        paperSize: CARTA_EXCEL,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        printTitlesRow: `${filaHeader}:${filaHeader}`,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
    };
    sheet.headerFooter = {
        oddFooter: '&L&D &T&RPágina &P de &N'
    };
}

export async function enviarExcel(res: Response, baseNombre: string, hojas: HojaExport[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = datosEmpresa().nombre;
    workbook.created = new Date();
    const logoPath = rutaLogotipo();
    let logoId: number | null = null;
    if (logoPath) {
        try {
            logoId = workbook.addImage({ filename: logoPath, extension: extensionLogo(logoPath) });
        } catch {
            logoId = null;
        }
    }

    for (const hoja of hojas) {
        const sheet = workbook.addWorksheet(hoja.nombre.slice(0, 31));
        if (hoja.plantilla === 'formal') {
            pintarHojaExcelFormal(sheet, hoja, logoId);
            continue;
        }
        const lastCol = Math.max(hoja.columnas.length, 4);
        let fila = 1;
        if (logoId != null) {
            sheet.addImage(logoId, {
                tl: { col: 0, row: 0 },
                ext: { width: 72, height: 48 }
            });
            sheet.getRow(1).height = 22;
            sheet.mergeCells(1, 3, 1, lastCol);
            const titulo = sheet.getCell(1, 3);
            titulo.value = hoja.titulo;
            titulo.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
            titulo.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
            sheet.mergeCells(1, 1, 1, lastCol);
            const titulo = sheet.getCell(1, 1);
            titulo.value = hoja.titulo;
            titulo.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
            titulo.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        fila = 3;
        const campos = camposCabecera(hoja);
        const mitad = Math.ceil(campos.length / 2);
        const filasMeta = Math.max(mitad, campos.length - mitad);
        for (let i = 0; i < filasMeta; i++) {
            const izq = campos[i];
            const der = campos[i + mitad];
            if (izq) {
                sheet.getCell(fila, 1).value = `${izq.label}:`;
                sheet.getCell(fila, 1).font = { bold: true, size: 9 };
                sheet.mergeCells(fila, 2, fila, Math.min(4, lastCol));
                sheet.getCell(fila, 2).value = izq.valor;
                sheet.getCell(fila, 2).font = { size: 9 };
            }
            if (der && lastCol >= 6) {
                const colLabel = Math.min(5, lastCol - 1);
                sheet.getCell(fila, colLabel).value = `${der.label}:`;
                sheet.getCell(fila, colLabel).font = { bold: true, size: 9 };
                sheet.getCell(fila, colLabel + 1).value = der.valor;
                sheet.getCell(fila, colLabel + 1).font = { size: 9 };
            }
            fila += 1;
        }
        fila += 1;
        const formal = hoja.plantilla === 'formal';
        const headerRow = sheet.getRow(fila);
        hoja.columnas.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col;
            cell.font = {
                bold: true,
                size: 9,
                color: { argb: formal ? 'FF000000' : 'FFFFFFFF' }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: formal ? 'FFF2F2F2' : 'FF000000' }
            };
            cell.alignment = { wrapText: true, vertical: 'middle', horizontal: alinearColumna(col, '') };
            cell.border = bordeExcel();
        });
        headerRow.height = 16;
        const filaHeader = fila;
        fila += 1;
        for (const datos of hoja.filas) {
            const row = sheet.getRow(fila);
            datos.forEach((valor, i) => {
                const cell = row.getCell(i + 1);
                const nombreCol = hoja.columnas[i] || '';
                if (typeof valor === 'number') {
                    cell.value = valor;
                    cell.numFmt = esColumnaEntera(nombreCol) ? '0' : '#,##0.00';
                } else {
                    cell.value = valor;
                }
                cell.font = { size: 9 };
                cell.alignment = { wrapText: true, vertical: 'middle', horizontal: alinearColumna(nombreCol, valor) };
                cell.border = bordeExcel();
            });
            row.height = 16;
            fila += 1;
        }
        for (const datos of construirPie(hoja)) {
            const row = sheet.getRow(fila);
            hoja.columnas.forEach((nombreCol, i) => {
                const cell = row.getCell(i + 1);
                const valor = datos[i] ?? '';
                if (typeof valor === 'number') {
                    cell.value = valor;
                    cell.numFmt = esColumnaEntera(nombreCol) ? '0' : '#,##0.00';
                } else {
                    cell.value = valor;
                }
                cell.font = { bold: true, size: 9 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
                cell.alignment = { wrapText: true, vertical: 'middle', horizontal: alinearColumna(nombreCol, valor) };
                cell.border = bordeExcel();
            });
            row.height = 16;
            fila += 1;
        }
        if (hoja.resumen?.length) {
            fila += 1;
            for (const item of hoja.resumen) {
                const pendiente = /pendiente/i.test(item.label);
                sheet.getCell(fila, 1).value = `${item.label}:`;
                sheet.getCell(fila, 1).font = { bold: pendiente || !formal, size: 9 };
                if (formal && typeof item.valor === 'number') {
                    sheet.getCell(fila, 2).value = item.valor;
                    sheet.getCell(fila, 2).numFmt = '"Bs" #,##0.00';
                } else {
                    sheet.getCell(fila, 2).value = recapValor(item.valor, item.label);
                }
                sheet.getCell(fila, 2).font = { bold: pendiente, size: 9 };
                fila += 1;
            }
        }
        if (formal && hoja.consulta?.length) {
            fila += 1;
            sheet.getCell(fila, 1).value = 'Consulta:';
            sheet.getCell(fila, 1).font = { size: 9 };
            fila += 1;
            for (const item of hoja.consulta) {
                sheet.getCell(fila, 1).value = `${item.label}:`;
                sheet.getCell(fila, 1).font = { size: 8 };
                sheet.getCell(fila, 2).value = item.valor;
                sheet.getCell(fila, 2).font = { size: 8 };
                fila += 1;
            }
        }
        sheet.columns.forEach((col, i) => {
            const nombre = hoja.columnas[i] || '';
            col.width = Math.round(pesoColumna(nombre) * 13);
        });
        sheet.pageSetup = {
            paperSize: CARTA_EXCEL,
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            printTitlesRow: `${filaHeader}:${filaHeader}`,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
        };
    }

    const filename = nombreArchivo(baseNombre, 'xlsx');
    cabecerasDescarga(res, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
}

export function enviarPdf(res: Response, baseNombre: string, hojas: HojaExport[]): void {
    const doc = documentoReporte(hojas, baseNombre);
    const filename = nombreArchivo(baseNombre, 'pdf');
    cabecerasDescarga(res, filename, 'application/pdf');
    doc.pipe(res);
    pintarReporte(doc, hojas);
    doc.end();
}

function documentoReporte(hojas: HojaExport[], baseNombre: string, opciones: OpcionesPdfReporte = {}) {
    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margin: 36,
        bufferPages: true,
        info: {
            Title: hojas[0]?.titulo || baseNombre,
            Author: (opciones.empresa ?? datosEmpresa()).nombre
        }
    });
    contextosPdf.set(doc, opciones);
    return doc;
}

export function bufferReportePdf(hojas: HojaExport[], opciones: OpcionesPdfReporte = {}): Promise<{ buffer: Buffer; paginas: number }> {
    return new Promise((resolve, reject) => {
        const doc = documentoReporte(hojas, hojas[0]?.nombre || 'reporte', opciones);
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), paginas }));
        pintarReporte(doc, hojas);
        const paginas = doc.bufferedPageRange().count;
        doc.end();
    });
}

function pintarReporte(doc: PDFKit.PDFDocument, hojas: HojaExport[]) {
    const formal = hojas.some((h) => h.plantilla === 'formal');
    hojas.forEach((hoja, index) => {
        if (index > 0) {
            doc.addPage();
        }
        if (hoja.plantilla === 'formal') {
            dibujarHojaFormal(doc, hoja);
        } else {
            dibujarHoja(doc, hoja);
        }
    });
    numerarPaginas(doc, { linea: !formal });
}

function numerarPaginas(doc: PDFKit.PDFDocument, opts?: { linea?: boolean }): void {
    const range = doc.bufferedPageRange();
    const generado = fmtGenerado();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const left = doc.page.margins.left;
        const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const margenInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const y = doc.page.height - 18;
        doc.save();
        if (opts?.linea !== false) {
            doc.strokeColor(COLOR_LINEA).lineWidth(0.5);
            doc.moveTo(left, y - 8).lineTo(left + width, y - 8).stroke();
        }
        doc.font('Helvetica').fontSize(7).fillColor('#000000');
        doc.text(generado, left, y, { width: width / 2, lineBreak: false });
        doc.text(`Página ${i + 1} de ${range.count}`, left, y, { width, align: 'right', lineBreak: false });
        doc.restore();
        doc.page.margins.bottom = margenInferior;
    }
}

function dibujarLogo(doc: PDFKit.PDFDocument, x: number, y: number, maxW: number, maxH: number): number {
    const configurado = contextosPdf.get(doc)?.logotipo;
    const logo = configurado === undefined ? rutaLogotipo() : configurado;
    if (!logo) {
        return 0;
    }
    try {
        doc.image(logo, x, y, { fit: [maxW, maxH] });
        return maxW + 8;
    } catch {
        return 0;
    }
}

function dibujarCabeceraReporte(doc: PDFKit.PDFDocument, hoja: HojaExport): void {
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const logoH = 40;
    dibujarLogo(doc, left, top, 52, logoH);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR_TEXTO);
    doc.text(hoja.titulo, left, top + 6, {
        width,
        align: 'center'
    });
    const empresa = empresaPdf(doc);
    doc.font('Helvetica').fontSize(8).fillColor('#333333');
    doc.text(empresa.nombre, left, top + 24, {
        width,
        align: 'center'
    });
    let y = top + logoH + 10;
    const campos = camposCabecera(hoja, empresa);
    const colW = width / 2;
    const lineH = 12;
    const mitad = Math.ceil(campos.length / 2);
    const filasMeta = Math.max(mitad, campos.length - mitad);
    for (let i = 0; i < filasMeta; i++) {
        const izq = campos[i];
        const der = campos[i + mitad];
        if (izq) {
            pintarMeta(doc, left, y, colW - 8, izq.label, izq.valor);
        }
        if (der) {
            pintarMeta(doc, left + colW, y, colW - 8, der.label, der.valor);
        }
        y += lineH;
    }
    y += 6;
    doc.strokeColor(COLOR_LINEA).lineWidth(0.8);
    doc.moveTo(left, y).lineTo(left + width, y).stroke();
    doc.y = y + 8;
}

function pintarMeta(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, valor: string): void {
    const labelW = 62;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_TEXTO).text(`${label}:`, x, y, {
        width: labelW,
        lineBreak: false
    });
    doc.font('Helvetica').fontSize(8).text(valor, x + labelW, y, {
        width: w - labelW,
        lineBreak: false
    });
}

function anchoTexto(anchoCol: number): number {
    return Math.max(8, anchoCol - PAD * 2);
}

function alturaContenido(doc: PDFKit.PDFDocument, texto: string, anchoCol: number): number {
    const lineGap = FONT_SIZE - doc.currentLineHeight(true);
    return doc.heightOfString(texto || ' ', {
        width: anchoTexto(anchoCol),
        lineGap
    });
}

function alturaBloque(doc: PDFKit.PDFDocument, fila: Celda[], columnas: string[], anchos: number[], negrita: boolean): number {
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
    let maxH = FONT_SIZE;
    columnas.forEach((col, i) => {
        const h = alturaContenido(doc, celdaTexto(fila[i], col) || ' ', anchos[i]);
        if (h > maxH) {
            maxH = h;
        }
    });
    return maxH + PAD * 2;
}

type BloqueTabla = { fila: Celda[]; h: number; negrita?: boolean; fondo?: string; color?: string };

function dibujarGrilla(
    doc: PDFKit.PDFDocument,
    startX: number,
    y0: number,
    pageWidth: number,
    columnas: string[],
    anchos: number[],
    bloques: BloqueTabla[],
    grosor = 0.7,
    textoCompleto = false
): number {
    let y = y0;
    bloques.forEach((bloque) => {
        if (bloque.fondo) {
            doc.save();
            doc.rect(startX, y, pageWidth, bloque.h).fill(bloque.fondo);
            doc.restore();
        }
        let x = startX;
        doc.font(bloque.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);
        const lineGap = FONT_SIZE - doc.currentLineHeight(true);
        columnas.forEach((col, i) => {
            const texto = celdaTexto(bloque.fila[i], col);
            const align = texto === 'Total' || texto === 'Totales' ? 'right' : alinearColumna(col, bloque.fila[i]);
            const contentH = alturaContenido(doc, texto || ' ', anchos[i]);
            const textY = y + (bloque.h - contentH) / 2;
            doc.fillColor(bloque.color || COLOR_TEXTO).text(texto, x + PAD, textY, {
                width: anchoTexto(anchos[i]),
                align,
                lineGap,
                ...(textoCompleto ? {} : { height: contentH + 0.5 })
            });
            x += anchos[i];
        });
        y += bloque.h;
    });
    const totalH = y - y0;
    if (totalH > 0) {
        doc.save();
        doc.strokeColor(COLOR_LINEA).lineWidth(grosor);
        doc.rect(startX, y0, pageWidth, totalH).stroke();
        let x = startX;
        for (let i = 0; i < anchos.length - 1; i++) {
            x += anchos[i];
            doc.moveTo(x, y0).lineTo(x, y0 + totalH).stroke();
        }
        let hy = y0;
        for (let i = 0; i < bloques.length - 1; i++) {
            hy += bloques[i].h;
            doc.moveTo(startX, hy).lineTo(startX + pageWidth, hy).stroke();
        }
        doc.restore();
    }
    doc.x = startX;
    doc.y = y;
    return y;
}

function dibujarRecap(
    doc: PDFKit.PDFDocument,
    resumen: { label: string; valor: Celda }[],
    startX: number,
    bottom: number
): void {
    const lineH = 13;
    if (doc.y + resumen.length * lineH + 12 > bottom) {
        doc.addPage();
        doc.y = doc.page.margins.top;
    }
    doc.y += 10;
    resumen.forEach((item) => {
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_TEXTO).text(`${item.label}:`, startX, y, {
            width: 170,
            lineBreak: false
        });
        doc.font('Helvetica').fontSize(8).text(recapValor(item.valor, item.label), startX + 174, y, {
            width: 220,
            lineBreak: false
        });
        doc.y = y + lineH;
    });
}

function dibujarHoja(doc: PDFKit.PDFDocument, hoja: HojaExport): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const bottom = doc.page.height - 40;
    dibujarCabeceraReporte(doc, hoja);
    if (!hoja.columnas.length) {
        if (hoja.resumen?.length) {
            dibujarRecap(doc, hoja.resumen, startX, bottom);
        }
        return;
    }
    const anchos = anchosColumnas(hoja.columnas, pageWidth);
    const headerH = alturaBloque(doc, hoja.columnas, hoja.columnas, anchos, true);
    const pie = construirPie(hoja);
    const filasTabla = [...hoja.filas.map((fila) => ({ fila, pie: false })), ...pie.map((fila) => ({ fila, pie: true }))];

    const encabezado = (): BloqueTabla => ({
        fila: hoja.columnas,
        h: headerH,
        negrita: true,
        fondo: COLOR_CABECERA,
        color: COLOR_CABECERA_TEXTO
    });

    let bloques: BloqueTabla[] = [encabezado()];
    const flush = () => {
        if (!bloques.length) {
            return;
        }
        dibujarGrilla(doc, startX, doc.y, pageWidth, hoja.columnas, anchos, bloques);
        bloques = [];
    };

    filasTabla.forEach((item) => {
        const rowH = alturaBloque(doc, item.fila, hoja.columnas, anchos, item.pie);
        const usado = bloques.reduce((acc, b) => acc + b.h, 0);
        if (doc.y + usado + rowH > bottom) {
            flush();
            doc.addPage();
            bloques = [encabezado()];
        }
        bloques.push({
            fila: item.fila,
            h: rowH,
            negrita: item.pie,
            fondo: item.pie ? COLOR_PIE : undefined
        });
    });
    flush();
    if (hoja.resumen?.length) {
        dibujarRecap(doc, hoja.resumen, startX, bottom);
    }
}

const FORMAL_HEADER = '#F2F2F2';
const FORMAL_LINEA = '#000000';
const FIRMA_H = 54;

function limiteContenido(doc: PDFKit.PDFDocument): number {
    return doc.page.height - 36;
}

function pesoColumnaFormal(nombre: string): number {
    const n = nombre.toLowerCase().trim();
    if (n === 'despachado') return 1.45;
    if (/^n[°º]$|^#$/.test(n)) return 0.4;
    if (/n[°º].*venta/.test(n)) return 0.85;
    if (/^fecha$/.test(n)) return 1.05;
    if (/cliente/.test(n)) return 2.5;
    if (/total|cobrado|saldo/.test(n)) return 1.2;
    if (/vencimiento/.test(n)) return 1.15;
    if (/atraso|d[ií]as/.test(n)) return 1.15;
    if (/estado/.test(n)) return 1.15;
    return pesoColumna(nombre);
}

function anchosFormal(columnas: string[], pageWidth: number): number[] {
    const pesos = columnas.map(pesoColumnaFormal);
    const suma = pesos.reduce((acc, p) => acc + p, 0) || 1;
    const anchos = pesos.map((p) => Math.floor((p / suma) * pageWidth * 10) / 10);
    const usados = anchos.slice(0, -1).reduce((acc, n) => acc + n, 0);
    if (anchos.length) {
        anchos[anchos.length - 1] = pageWidth - usados;
    }
    return anchos;
}

function dibujarEncabezadoFormal(doc: PDFKit.PDFDocument, hoja: HojaExport, completo: boolean): void {
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const empresa = empresaPdf(doc);
    if (!completo) {
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        doc.text(empresa.nombre, left, top, { width: width / 2, lineBreak: false });
        doc.text(hoja.titulo, left, top, { width, align: 'right', lineBreak: false });
        doc.y = top + 16;
        return;
    }
    const logoH = 50;
    dibujarLogo(doc, left, top, 50, logoH);
    const textX = left + 62;
    const leftW = Math.max(180, width * 0.52 - 62);
    let y = top + 2;
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(empresa.nombre, textX, y, { width: leftW, lineBreak: false });
    y += 15;
    doc.font('Helvetica').fontSize(8);
    doc.text('Sistema de Gestión Administrativa', textX, y, { width: leftW, lineBreak: false });
    y += 12;
    const direccion = [empresa.direccion, empresa.ciudad].filter(Boolean).join(' — ');
    if (direccion) {
        doc.text(direccion, textX, y, { width: leftW });
        y = Math.max(y + 11, doc.y);
    }
    if (empresa.telefono) {
        doc.text(`Teléfono: ${empresa.telefono}`, textX, y, { width: leftW, lineBreak: false });
        y += 11;
    }
    if (empresa.email) {
        doc.text(`Correo: ${empresa.email}`, textX, y, { width: leftW, lineBreak: false });
        y += 11;
    }
    const ahora = new Date();
    const rightW = 200;
    const rightX = left + width - rightW;
    let my = top + 2;
    const meta = [
        { label: 'Fecha de generación', valor: ahora.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) },
        { label: 'Hora', valor: ahora.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) }
    ];
    if (hoja.usuario) {
        meta.push({ label: 'Usuario', valor: hoja.usuario });
    }
    meta.forEach((item) => {
        doc.font('Helvetica-Bold').fontSize(8).text(`${item.label}:`, rightX, my, { width: 108, lineBreak: false });
        doc.font('Helvetica').text(item.valor, rightX + 110, my, { width: rightW - 110, lineBreak: false });
        my += 12;
    });
    y = Math.max(top + logoH, y, my) + 16;
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
    doc.text((hoja.titulo || '').toUpperCase(), left, y, { width, align: 'center' });
    y = doc.y + 1;
    if (hoja.tituloSecundario) {
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text(hoja.tituloSecundario.toUpperCase(), left, y, { width, align: 'center' });
        y = doc.y + 4;
    }
    if (hoja.subtitulo) {
        doc.font('Helvetica').fontSize(9);
        doc.text(hoja.subtitulo, left, y, { width, align: 'center' });
        y = doc.y;
    }
    doc.y = y + 12;
}

function dibujarTotalesFormal(
    doc: PDFKit.PDFDocument,
    resumen: { label: string; valor: Celda }[],
    startX: number,
    pageWidth: number
): void {
    const labelW = 130;
    const valorW = 110;
    const xLabel = startX + pageWidth - labelW - valorW;
    doc.y += 12;
    resumen.forEach((item) => {
        const y = doc.y;
        const pendiente = /pendiente/i.test(item.label);
        doc.font(pendiente ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
        doc.text(`${item.label}:`, xLabel, y, { width: labelW, align: 'right', lineBreak: false });
        const texto = typeof item.valor === 'number'
            ? `Bs ${textoNumero(item.valor, item.label)}`
            : String(item.valor ?? '');
        doc.text(texto, xLabel + labelW + 8, y, { width: valorW, align: 'right', lineBreak: false });
        doc.y = y + 13;
    });
}

function dibujarConsultaFormal(
    doc: PDFKit.PDFDocument,
    consulta: { label: string; valor: string }[],
    startX: number,
    textoCompleto = false
): void {
    if (!consulta.length) {
        return;
    }
    doc.y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    doc.text('Consulta:', startX, doc.y);
    consulta.forEach((item) => {
        const y = doc.y;
        doc.text(`${item.label}: ${item.valor}`, startX, y, { lineBreak: textoCompleto, width: doc.page.width - startX - doc.page.margins.right });
        doc.y = textoCompleto ? doc.y + 2 : y + 11;
    });
}

function dibujarFirmaFormal(doc: PDFKit.PDFDocument, startX: number, pageWidth: number): void {
    const empresa = empresaPdf(doc);
    const w = 160;
    const x = startX + pageWidth - w;
    doc.y += 22;
    const y = doc.y;
    doc.save();
    doc.strokeColor(FORMAL_LINEA).lineWidth(0.7);
    doc.moveTo(x, y).lineTo(x + w, y).stroke();
    doc.restore();
    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    doc.text('Firma', x, y + 6, { width: w, align: 'center' });
    doc.text(empresa.nombre, x, y + 18, { width: w, align: 'center' });
    doc.y = y + FIRMA_H - 22;
}

function dibujarHojaFormal(doc: PDFKit.PDFDocument, hoja: HojaExport): void {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    dibujarEncabezadoFormal(doc, hoja, true);
    if (!hoja.columnas.length) {
        return;
    }
    const anchos = anchosFormal(hoja.columnas, pageWidth);
    const headerH = alturaBloque(doc, hoja.columnas, hoja.columnas, anchos, true);
    const encabezado = (): BloqueTabla => ({
        fila: hoja.columnas,
        h: headerH,
        negrita: true,
        fondo: FORMAL_HEADER,
        color: '#000000'
    });

    let bloques: BloqueTabla[] = [encabezado()];
    const bottom = () => limiteContenido(doc);
    const flush = () => {
        if (!bloques.length) {
            return;
        }
        dibujarGrilla(doc, startX, doc.y, pageWidth, hoja.columnas, anchos, bloques, 0.4, hoja.textoCompleto);
        bloques = [];
    };
    const nuevaPagina = () => {
        flush();
        doc.addPage();
        dibujarEncabezadoFormal(doc, hoja, false);
        bloques = [encabezado()];
    };

    hoja.filas.forEach((fila) => {
        const rowH = alturaBloque(doc, fila, hoja.columnas, anchos, false);
        const usado = bloques.reduce((acc, b) => acc + b.h, 0);
        if (doc.y + usado + rowH > bottom()) {
            nuevaPagina();
        }
        bloques.push({ fila, h: rowH });
    });
    flush();

    const consulta = hoja.consulta || [];
    const resumen = hoja.resumen || [];
    const totalesH = resumen.length ? 12 + resumen.length * 13 : 0;
    const consultaH = consulta.length ? 14 + 12 + consulta.length * 11 : 0;
    const firmaH = hoja.mostrarFirma ? 22 + FIRMA_H : 0;

    if (resumen.length) {
        if (doc.y + totalesH > bottom()) {
            doc.addPage();
            dibujarEncabezadoFormal(doc, hoja, false);
        }
        dibujarTotalesFormal(doc, resumen, startX, pageWidth);
    }
    if (consulta.length) {
        if (doc.y + consultaH > bottom()) {
            doc.addPage();
            dibujarEncabezadoFormal(doc, hoja, false);
        }
        dibujarConsultaFormal(doc, consulta, startX, hoja.textoCompleto);
    }
    if (hoja.mostrarFirma) {
        if (doc.y + firmaH > bottom()) {
            doc.addPage();
            dibujarEncabezadoFormal(doc, hoja, false);
        }
        dibujarFirmaFormal(doc, startX, pageWidth);
    }
}
