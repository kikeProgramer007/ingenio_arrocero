import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { PDFArray, PDFDocument as PDFLibDocument, PDFName, PDFStream } from 'pdf-lib';
import { ControlOriginal, columnasOriginales, datosControlOriginal } from './produccion-controles-excel.servicio';
import { datosEmpresa, EmpresaDatos, rutaLogotipo } from '../utils/empresa';

/** PDFKit deja a veces una página extra al numerar con switchToPage; se descarta si no tiene contenido útil. */
function bytesContenidoPagina(doc: PDFLibDocument, pageIndex: number): number {
    const page = doc.getPage(pageIndex);
    const contents = page.node.lookup(PDFName.of('Contents'));
    if (!contents) return 0;
    if (contents instanceof PDFStream) return contents.getContents().length;
    if (contents instanceof PDFArray) {
        let n = 0;
        for (let i = 0; i < contents.size(); i++) {
            const part = contents.lookup(i);
            if (part instanceof PDFStream) n += part.getContents().length;
        }
        return n;
    }
    return 0;
}

async function bufferSinPaginasVacias(buffer: Buffer): Promise<Buffer> {
    const doc = await PDFLibDocument.load(buffer);
    // Solo se eliminan páginas finales casi vacías (pie de página / artefacto de PDFKit).
    while (doc.getPageCount() > 1 && bytesContenidoPagina(doc, doc.getPageCount() - 1) < 700) {
        doc.removePage(doc.getPageCount() - 1);
    }
    return Buffer.from(await doc.save());
}

function cerrarPdfNumerado(
    doc: PDFKit.PDFDocument,
    drawFooter: (pageIndex: number, pageCount: number) => void
): number {
    const range = doc.bufferedPageRange();
    const count = range.count;
    for (let i = 0; i < count; i++) {
        doc.switchToPage(range.start + i);
        drawFooter(i, count);
    }
    // Evita que end() materialice una página en blanco adicional.
    if (count > 0) doc.switchToPage(range.start + count - 1);
    doc.end();
    return count;
}

export const presentacionControl: Record<string, { titulo: string; anchos: number[] }> = {
    descarguios: { titulo: 'CONTROL DE DESCARGUÍO', anchos: [52, 56, 58, 54, 82, 95, 62, 52, 46, 36, 34, 34, 34, 78] },
    secados: { titulo: 'CONTROL DE SECADO DE ARROZ', anchos: [48, 48, 50, 48, 30, 40, 32, 34, 32, 34, 42, 78, 55, 48, 30, 58, 70] },
    guardados: { titulo: 'CONTROL DE GUARDADO DE ARROZ', anchos: [48, 48, 48, 50, 22, 78, 42, 55, 46, 32, 32, 32, 32, 58, 48, 55, 62] },
    procesados: { titulo: 'CONTROL DE PROCESADO DE ARROZ', anchos: [48, 48, 48, 48, 82, 58, 44, 50, 44, 40, 42, 40, 48, 40, 70] }
};
export const gruposDescarguio: [string, number, number][] = [
    ['RECEPCIÓN', 0, 2],
    ['DATOS DEL CAMIÓN', 3, 4],
    ['DATOS DEL CLIENTE', 5, 6],
    ['ARROZ', 7, 8],
    ['ALMACENAJE', 9, 12]
];
export function gestionControl(data: ControlOriginal): string {
    return [...new Set(data.filas.flatMap(row => row.filter(v => v instanceof Date).map(v => (v as Date).getUTCFullYear())))].join(', ') || 'Sin registros';
}
export function textoControl(v: any, tipo: string, col: number, detalle = false): string {
    if (v == null) return '';
    if (v instanceof Date) return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(v);
    if (typeof v !== 'number') return String(v);
    if ((detalle && [15, 17].includes(col)) || (!detalle && tipo === 'secados' && [6, 8].includes(col))) {
        const n = Math.round(v * 1440);
        return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    }
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(v);
}

function ahoraLaPaz() {
    const ahora = new Date();
    return {
        fecha: new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' }).format(ahora),
        hora: new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/La_Paz' }).format(ahora)
    };
}

/** Carta horizontal: encabezado corporativo + tabla compacta (solo descarguíos). */
function bufferDescarguioPdf(
    data: ControlOriginal,
    empresa: EmpresaDatos,
    logo: string | null
): Promise<{ buffer: Buffer; paginas: number }> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            layout: 'landscape',
            margin: 0,
            bufferPages: true,
            info: { Title: presentacionControl.descarguios.titulo, Author: empresa.nombre }
        });
        const chunks: Buffer[] = [];
        let paginas = 1;
        doc.on('data', b => chunks.push(b));
        doc.on('error', reject);
        doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), paginas }));

        const margin = 22;
        const left = margin;
        const right = doc.page.width - margin;
        const width = right - left;
        const bottom = doc.page.height - 28;
        const font = 7.2;
        const line = 9.2;
        const headers = columnasOriginales.descarguios;
        const weights = presentacionControl.descarguios.anchos;
        const widths = () => {
            const sum = weights.reduce((a, b) => a + b, 0);
            return weights.map(w => (w / sum) * width);
        };
        const numCols = new Set([8, 10, 11, 12]); // PESO, %HE, %Ie, %Is
        let y = 16;

        const drawText = (
            text: string,
            x: number,
            top: number,
            w: number,
            bold = false,
            size = font,
            align: 'left' | 'right' | 'center' = 'left',
            color = '#111111'
        ) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(text, x, top, {
                width: w,
                lineBreak: false,
                align,
                ellipsis: true
            });
        };
        const wrap = (text: string, w: number, bold = false): string[] => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(font);
            const out: string[] = [];
            for (const paragraph of String(text || '').split('\n')) {
                let current = '';
                for (const word of paragraph.split(/\s+/)) {
                    if (!word) continue;
                    let token = word;
                    if (doc.widthOfString(token) > w) {
                        if (current) {
                            out.push(current);
                            current = '';
                        }
                        let part = '';
                        for (const c of token) {
                            if (part && doc.widthOfString(part + c) > w) {
                                out.push(part);
                                part = '';
                            }
                            part += c;
                        }
                        current = part;
                        continue;
                    }
                    if (current && doc.widthOfString(current + ' ' + token) > w) {
                        out.push(current);
                        current = token;
                    } else current += (current ? ' ' : '') + token;
                }
                out.push(current);
            }
            return out.length ? out : [''];
        };
        const cell = (
            text: string,
            x: number,
            top: number,
            w: number,
            h: number,
            opts: { shade?: boolean; bold?: boolean; align?: 'left' | 'right' | 'center'; size?: number } = {}
        ) => {
            if (opts.shade) doc.rect(x, top, w, h).fill('#E8E8E8');
            doc.lineWidth(0.4).strokeColor('#555555').rect(x, top, w, h).stroke();
            drawText(text, x + 2, top + Math.max(2, (h - (opts.size || font)) / 2 - 1), w - 4, !!opts.bold, opts.size || font, opts.align || 'left');
        };

        const encabezado = () => {
            y = 14;
            const logoSize = 40;
            let logoW = 0;
            if (logo && fs.existsSync(logo)) {
                try {
                    doc.image(logo, left, y, { fit: [logoSize, logoSize] });
                    logoW = logoSize;
                } catch {
                    logoW = 0;
                }
            }
            const empresaX = left + logoW + (logoW ? 5 : 0);
            const metaW = 150;
            const empresaW = Math.max(160, width - metaW - logoW - 20);
            let ey = y + 2;
            doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11);
            doc.text(String(empresa.nombre || '').toUpperCase(), empresaX, ey, { width: empresaW, lineBreak: false });
            ey = doc.y + 1;
            doc.font('Helvetica').fontSize(7.5);
            const sub = String(empresa.slogan || 'Sistema de Gestión Administrativa').trim();
            if (sub) {
                doc.text(sub, empresaX, ey, { width: empresaW, lineBreak: false });
                ey = doc.y + 1;
            }
            const tel = String(empresa.telefono || '').trim();
            const ciudad = String(empresa.ciudad || '').trim();
            const contacto = [tel ? `Teléfono: ${tel}` : '', ciudad].filter(Boolean).join(' · ');
            if (contacto) doc.text(contacto, empresaX, ey, { width: empresaW, lineBreak: false });

            const meta = ahoraLaPaz();
            const metaX = right - metaW;
            drawText(`Gestión ${gestionControl(data)}`, metaX, y + 2, metaW, true, 9, 'right');
            drawText(`Generado: ${meta.fecha}`, metaX, y + 14, metaW, false, 8, 'right');
            drawText(`Hora: ${meta.hora}`, metaX, y + 25, metaW, false, 8, 'right');

            y = Math.max(y + logoSize, doc.y) + 6;
            doc.rect(left, y, width, 2.2).fill('#741419');
            y += 10;

            drawText(presentacionControl.descarguios.titulo, left, y, width, true, 15, 'center');
            y += 18;
            doc.moveTo(left + width * 0.28, y).lineTo(right - width * 0.28, y).lineWidth(0.9).strokeColor('#222').stroke();
            doc.moveTo(left + width * 0.28, y + 2.2).lineTo(right - width * 0.28, y + 2.2).lineWidth(0.45).stroke();
            y += 10;

            const filtro = data.filtros.map(f => `${f.label}: ${f.valor}`).join('   |   ') || 'Todos los registros';
            const filtroLines = wrap(filtro, width - 16);
            const filtroH = Math.max(18, filtroLines.length * line + 8);
            doc.rect(left, y, width, filtroH).fill('#EDEDED');
            doc.rect(left, y, width, filtroH).lineWidth(0.5).strokeColor('#999').stroke();
            filtroLines.forEach((l, i) => drawText(l, left + 8, y + 5 + i * line, width - 16, false, 7.5));
            y += filtroH + 8;

            const ws = widths();
            for (const [name, a, b] of gruposDescarguio) {
                const x = left + ws.slice(0, a).reduce((n, w) => n + w, 0);
                const w = ws.slice(a, b + 1).reduce((n, w) => n + w, 0);
                cell(name, x, y, w, 14, { shade: true, bold: true, align: 'center', size: 6.5 });
            }
            // OBSERVACIONES sin grupo
            const obsX = left + ws.slice(0, 13).reduce((n, w) => n + w, 0);
            cell('', obsX, y, ws[13], 14, { shade: true });
            y += 14;

            const labels = headers.map((h, i) => wrap(h, ws[i] - 4, true));
            const height = Math.max(...labels.map(a => a.length)) * line + 6;
            let x = left;
            headers.forEach((_, i) => {
                cell('', x, y, ws[i], height, { shade: true });
                labels[i].forEach((l, j) => drawText(l, x + 2, y + 3 + j * line, ws[i] - 4, true, font, 'center'));
                x += ws[i];
            });
            y += height;
        };

        const next = () => {
            doc.addPage();
            encabezado();
        };

        encabezado();
        const ws = widths();
        if (!data.filas.length) {
            drawText('Sin registros para los filtros seleccionados.', left, y + 8, width, false, 9);
            y += 28;
        }
        for (const row of data.filas) {
            const strings = headers.map((_, i) => wrap(textoControl(row[i], 'descarguios', i), ws[i] - 4));
            const count = Math.max(...strings.map(a => a.length));
            let offset = 0;
            while (offset < count) {
                if (y + line + 6 > bottom) next();
                const take = Math.min(count - offset, Math.max(1, Math.floor((bottom - y - 6) / line)));
                const height = take * line + 5;
                let x = left;
                headers.forEach((_, i) => {
                    cell('', x, y, ws[i], height);
                    const align = numCols.has(i) || typeof row[i] === 'number' ? 'right' : 'left';
                    strings[i].slice(offset, offset + take).forEach((l, j) => drawText(l, x + 2, y + 3 + j * line, ws[i] - 4, false, font, align));
                    x += ws[i];
                });
                y += height;
                offset += take;
            }
        }

        // Totales alineados bajo PESO (col 8)
        for (const total of data.totales) {
            if (y + 18 > bottom) next();
            const h = 16;
            doc.rect(left, y, width, h).fill('#E8E8E8');
            doc.rect(left, y, width, h).lineWidth(0.45).strokeColor('#555').stroke();
            const pesoX = left + ws.slice(0, 8).reduce((n, w) => n + w, 0);
            drawText(String(total[0] || ''), left + 4, y + 4, pesoX - left - 8, true, 8);
            drawText(textoControl(total[1], 'descarguios', 8), pesoX, y + 4, ws[8], true, 8, 'right');
            y += h + 4;
        }
        for (const note of data.notas) {
            for (const l of wrap(note, width)) {
                if (y + line + 4 > bottom) next();
                doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#333').text(l, left, y + 2, { width });
                y += line;
            }
            y += 2;
        }

        paginas = cerrarPdfNumerado(doc, (i, count) => {
            doc.moveTo(left, doc.page.height - 22).lineTo(right, doc.page.height - 22).lineWidth(0.5).strokeColor('#333').stroke();
            drawText(`Página ${i + 1} de ${count}`, left, doc.page.height - 18, width, false, 7.5, 'right');
        });
    });
}

/** One source projection for Excel and PDF. Long rows continue inside cells on the next page. */
export function bufferControlPdf(
    data: ControlOriginal,
    empresa: EmpresaDatos = datosEmpresa(),
    logo: string | null = rutaLogotipo()
): Promise<{ buffer: Buffer; paginas: number }> {
    if (data.tipo === 'descarguios') return bufferDescarguioPdf(data, empresa, logo);
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            layout: 'landscape',
            margin: 16,
            bufferPages: true,
            info: { Title: presentacionControl[data.tipo].titulo, Author: empresa.nombre }
        });
        let paginas = 1;
        const chunks: Buffer[] = [];
        doc.on('data', b => chunks.push(b));
        doc.on('error', reject);
        doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), paginas }));
        const left = 16,
            width = doc.page.width - 32,
            bottom = doc.page.height - 28,
            line = 8.4,
            font = 6.4;
        let y = 14,
            headers: string[] = [],
            weights: number[] = [];
        const drawText = (text: string, x: number, top: number, w: number, bold = false, size = font, align: 'left' | 'right' | 'center' = 'left') => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('#111111').text(text, x, top, { width: w, lineBreak: false, align });
        };
        const wrap = (text: string, w: number, bold = false): string[] => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(font);
            const out: string[] = [];
            for (const paragraph of text.split('\n')) {
                let current = '';
                for (const word of paragraph.split(/\s+/)) {
                    if (!word) continue;
                    let token = word;
                    if (doc.widthOfString(token) > w) {
                        if (current) {
                            out.push(current);
                            current = '';
                        }
                        let part = '';
                        for (const c of token) {
                            if (part && doc.widthOfString(part + c) > w) {
                                out.push(part);
                                part = '';
                            }
                            part += c;
                        }
                        current = part;
                        continue;
                    }
                    if (current && doc.widthOfString(current + ' ' + token) > w) {
                        out.push(current);
                        current = token;
                    } else current += (current ? ' ' : '') + token;
                }
                out.push(current);
            }
            return out.length ? out : [''];
        };
        const widths = () => {
            const sum = weights.reduce((a, b) => a + b, 0);
            return weights.map(w => (w / sum) * width);
        };
        const cell = (text: string, x: number, top: number, w: number, h: number, shade = false, bold = false, align: 'left' | 'right' | 'center' = 'left') => {
            if (shade) doc.rect(x, top, w, h).fill('#E5E5E5');
            doc.lineWidth(0.35).strokeColor('#555555').rect(x, top, w, h).stroke();
            drawText(text, x + 1.5, top + 2.5, w - 3, bold, font, align);
        };
        const header = () => {
            y = 12;
            let logoWidth = 0;
            if (logo && fs.existsSync(logo)) {
                try {
                    doc.image(logo, left, y, { fit: [70, 30], valign: 'center' });
                    logoWidth = 76;
                } catch {
                    /* Configured unsupported image: company name remains visible. */
                }
            }
            drawText(empresa.nombre, left + logoWidth, y + 2, 180 - logoWidth, true, 8);
            drawText(presentacionControl[data.tipo].titulo, left + 180, y + 6, width - 300, true, 11, 'center');
            drawText('GESTIÓN ' + gestionControl(data), left + width - 110, y + 8, 110, true, 8, 'right');
            y += 36;
            const filter = data.filtros.map(f => `${f.label}: ${f.valor}`).join(' | ') || 'Todos los registros';
            const lines = wrap(filter, width);
            for (const l of lines) {
                drawText(l, left, y, width, false, 6.5);
                y += line;
            }
            y += 4;
            const ws = widths();
            const labels = headers.map((h, i) => wrap(h, ws[i] - 3, true)),
                height = Math.max(...labels.map(a => a.length)) * line + 4;
            let x = left;
            headers.forEach((h, i) => {
                cell('', x, y, ws[i], height, true);
                labels[i].forEach((l, j) => drawText(l, x + 1.5, y + 2.5 + j * line, ws[i] - 3, true, font, 'center'));
                x += ws[i];
            });
            y += height;
        };
        const next = () => {
            doc.addPage();
            header();
        };
        const table = (hs: string[], rows: any[][], w: number[]) => {
            headers = hs;
            weights = w;
            header();
            const ws = widths();
            if (!rows.length) {
                drawText('Sin registros para los filtros seleccionados.', left, y + 8, width);
                y += 24;
            }
            for (const row of rows) {
                const strings = hs.map((_, i) => wrap(textoControl(row[i], data.tipo, i), ws[i] - 3)),
                    count = Math.max(...strings.map(a => a.length));
                let offset = 0;
                while (offset < count) {
                    if (y + line + 5 > bottom) next();
                    const take = Math.max(1, Math.min(count - offset, Math.floor((bottom - y - 5) / line) || 1));
                    const height = take * line + 4;
                    let x = left;
                    hs.forEach((_, i) => {
                        cell('', x, y, ws[i], height);
                        const align = typeof row[i] === 'number' ? 'right' : 'left';
                        strings[i].slice(offset, offset + take).forEach((l, j) => drawText(l, x + 1.5, y + 2.5 + j * line, ws[i] - 3, false, font, align));
                        x += ws[i];
                    });
                    y += height;
                    offset += take;
                }
            }
        };
        table(columnasOriginales[data.tipo], data.filas, presentacionControl[data.tipo].anchos);
        for (const total of data.totales) {
            if (y + 16 > bottom) next();
            drawText(`${total[0]}: ${textoControl(total[1], data.tipo, -1)}`, left, y + 4, width, true, 7);
            y += 16;
        }
        for (const note of data.notas) {
            for (const l of wrap(note, width)) {
                if (y + line + 4 > bottom) next();
                drawText(l, left, y + 3, width, false, 6);
                y += line;
            }
            y += 3;
        }
        paginas = cerrarPdfNumerado(doc, (i, count) => {
            drawText(`Página ${i + 1} de ${count}`, left, doc.page.height - 22, width, false, 6.5, 'right');
        });
    });
}
export async function enviarControlPdf(res: Response, tipo: string, q: Record<string, any>) {
    const data = await datosControlOriginal(tipo, q);
    const limpio = await bufferSinPaginasVacias((await bufferControlPdf(data)).buffer);
    const names: Record<string, string> = {
        descarguios: 'Control_Descarguio',
        secados: 'Control_Secado_Arroz',
        guardados: 'Control_Guardado_Arroz',
        procesados: 'Control_Procesado_Arroz'
    };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `inline; filename="${names[tipo]}.pdf"`);
    res.send(limpio);
}

export async function enviarControlConsolidadoPdf(res: Response, q: Record<string, any>, tipos: string[]) {
    const { controlesOriginales } = await import('./produccion-controles-excel.servicio');
    const { hojaTransformacion } = await import('./produccion-transformaciones-consulta.servicio');
    const { bufferReportePdf } = await import('../utils/exportar');
    const merged = await PDFLibDocument.create();
    let paginas = 0;
    for (const tipo of tipos) {
        let buffer: Buffer | null = null;
        if (controlesOriginales.includes(tipo)) {
            const data = await datosControlOriginal(tipo, q);
            buffer = await bufferSinPaginasVacias((await bufferControlPdf(data)).buffer);
        } else if (tipo === 'envasados') {
            const hoja = await hojaTransformacion('ENVASADO', { ...q, orden: 'fecha', direccion: -1 }, 'pdf');
            hoja.mostrarFirma = false;
            hoja.cabeceraReporte = true;
            buffer = await bufferSinPaginasVacias((await bufferReportePdf([hoja])).buffer);
        }
        if (!buffer) continue;
        const src = await PDFLibDocument.load(buffer);
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach(p => merged.addPage(p));
        paginas += copied.length;
    }
    if (!paginas) throw new Error('No hay módulos de producción para consolidar.');
    const limpio = await bufferSinPaginasVacias(Buffer.from(await merged.save()));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', 'inline; filename="Control_Produccion_Consolidado.pdf"');
    res.send(limpio);
}
