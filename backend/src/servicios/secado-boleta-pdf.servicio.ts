import fs from 'fs';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { obtenerEtapa } from './produccion-etapas.servicio';
import { datosEmpresa, EmpresaDatos, rutaLogotipo } from '../utils/empresa';

type Fila = Record<string, any>;

const COLOR = {
    texto: '#1A1A1A',
    label: '#2A2A2A',
    grisClaro: '#E8E8E8',
    grisBanner: '#EDEDED',
    grisLinea: '#BDBDBD',
    borde: '#222222',
    blanco: '#FFFFFF'
};

function fmtFecha(v: unknown): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isFinite(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/La_Paz'
    }).format(d);
}

function fmtHora(v: unknown): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isFinite(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('es-BO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/La_Paz'
    }).format(d);
}

function fmtPct(v: unknown): string {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return `${n.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function fmtCant(v: unknown): string {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function abrevUnidad(u: unknown): string {
    const s = String(u || '').trim().toLowerCase();
    if (s.startsWith('fan')) return 'F.';
    if (s.startsWith('quin')) return 'Qq.';
    if (s.startsWith('kil')) return 'Kg.';
    if (s.startsWith('uni')) return 'U.';
    return String(u || '').trim() || '';
}

function nroDocumento(codigo: string, id: number): string {
    const m = String(codigo || '').match(/(\d+)\s*$/);
    if (m) return String(Number(m[1]));
    return String(id);
}

function codigoVisible(fila: Fila): string {
    const c = String(fila.codigo || '').trim();
    if (c) return c;
    return `S-${String(fila.id).padStart(3, '0')}`;
}

function origenesTexto(fila: Fila): string {
    const origenes: Fila[] = Array.isArray(fila.origenes) ? fila.origenes : [];
    const codigos = [...new Set(origenes.map(o => String(o.origen_codigo || o.codigo || '').trim()).filter(Boolean))];
    return codigos.join(', ');
}

function variedadTexto(fila: Fila): string {
    if (fila.variedad) return String(fila.variedad).trim();
    const origenes: Fila[] = Array.isArray(fila.origenes) ? fila.origenes : [];
    return [...new Set(origenes.map(o => String(o.variedad || '').trim()).filter(Boolean))].join(', ');
}

function productorTexto(fila: Fila): string {
    if (fila.productor) return String(fila.productor).trim();
    const origenes: Fila[] = Array.isArray(fila.origenes) ? fila.origenes : [];
    return [...new Set(origenes.map(o => String(o.productor || '').trim()).filter(Boolean))].join(', ');
}

function cantidadTotal(fila: Fila): { cant: string; uni: string } {
    const origenes: Fila[] = Array.isArray(fila.origenes) ? fila.origenes : [];
    if (!origenes.length) return { cant: fmtCant(fila.cantidad), uni: abrevUnidad(fila.unidad) };
    let sum = 0;
    let uni = '';
    for (const o of origenes) {
        const n = Number(o.cantidad);
        if (Number.isFinite(n)) sum += n;
        if (!uni) uni = abrevUnidad(o.unidad);
    }
    return { cant: fmtCant(sum || null), uni };
}

function ubicacionTexto(fila: Fila): string {
    return [fila.ubicacion, fila.ubicacion_detalle, fila.destino_nombre].map(v => String(v || '').trim()).filter(Boolean).join(' / ');
}

function textoCaja(
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
        bold?: boolean;
        size?: number;
        align?: 'left' | 'center' | 'right';
        color?: string;
        padX?: number;
        padY?: number;
        wrap?: boolean;
    } = {}
): void {
    const size = opts.size ?? 9.5;
    const padX = opts.padX ?? 7;
    const padY = opts.padY ?? Math.max(2.5, (h - size) / 2);
    doc.fillColor(opts.color || COLOR.texto)
        .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(size)
        .text(text, x + padX, y + padY, {
            width: Math.max(10, w - padX * 2),
            height: Math.max(size + 2, h - padY - 2),
            align: opts.align || 'left',
            lineBreak: !!opts.wrap,
            ellipsis: !opts.wrap
        });
}

export async function bufferBoletaSecado(
    id: unknown,
    usuario = '',
    empresa: EmpresaDatos = datosEmpresa(),
    logo: string | null = rutaLogotipo()
): Promise<{ buffer: Buffer; codigo: string }> {
    const fila = await obtenerEtapa('SECADO', id);
    const codigo = String(fila.codigo || `S-${fila.id}`);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            layout: 'portrait',
            margin: 0,
            bufferPages: true,
            info: { Title: `CONTROL DE SECADO ${codigo}`, Author: empresa.nombre }
        });
        const chunks: Buffer[] = [];
        doc.on('data', (b: Buffer) => chunks.push(b));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        dibujarBoleta(doc, fila, usuario, empresa, logo);
        doc.end();
    });
    return { buffer, codigo };
}

function dibujarBoleta(
    doc: PDFKit.PDFDocument,
    fila: Fila,
    usuario: string,
    empresa: EmpresaDatos,
    logo: string | null
): void {
    const pageW = doc.page.width;
    const margin = 28;
    const left = margin;
    const right = pageW - margin;
    const width = right - left;
    let y = 18;

    const headerH = 48;
    const logoSize = headerH - 2;
    let logoW = 0;
    if (logo && fs.existsSync(logo)) {
        try {
            doc.image(logo, left, y, { fit: [logoSize, logoSize] });
            logoW = logoSize;
        } catch {
            logoW = 0;
        }
    }
    const gapLogo = logoW ? 4 : 0;
    const empresaX = left + logoW + gapLogo;
    const metaW = 200;
    const empresaW = Math.max(140, width - metaW - logoW - gapLogo - 12);
    let ey = y;
    const titular = String(empresa.titular || '').trim();
    const nombre = String(empresa.nombre || 'INGENIO ARROCERO').trim();
    const direccion = String(empresa.direccion || '').trim();
    const telefono = String(empresa.telefono || '').trim();
    const ciudad = String(empresa.ciudad || '').trim();
    doc.fillColor(COLOR.texto);
    if (titular) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text(titular.toUpperCase(), empresaX, ey, { width: empresaW, lineBreak: false });
        ey = doc.y + 1;
        doc.font('Helvetica').fontSize(8);
        doc.text(nombre.toUpperCase(), empresaX, ey, { width: empresaW, lineBreak: false });
        ey = doc.y + 1;
    } else {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text(nombre.toUpperCase(), empresaX, ey, { width: empresaW, lineBreak: false });
        ey = doc.y + 1;
    }
    doc.font('Helvetica').fontSize(8);
    if (direccion) {
        doc.text(direccion, empresaX, ey, { width: empresaW, lineBreak: false });
        ey = doc.y + 1;
    }
    const contacto = [telefono ? `Tel.: ${telefono}` : '', ciudad ? ciudad.toUpperCase() : ''].filter(Boolean).join(' · ');
    if (contacto) doc.text(contacto, empresaX, ey, { width: empresaW, lineBreak: false });

    const metaX = right - metaW;
    const fecha = fmtFecha(fila.fecha);
    doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(9.5);
    if (fecha) doc.text(`Fecha: ${fecha}`, metaX, y + 8, { width: metaW, align: 'right', lineBreak: false });
    if (usuario) doc.text(`Usuario: ${usuario}`, metaX, y + 22, { width: metaW, align: 'right', lineBreak: false });
    y += headerH + 6;

    const titleH = 26;
    doc.rect(left, y, width, titleH).fill(COLOR.grisBanner);
    doc.rect(left, y, width, titleH).lineWidth(1).strokeColor(COLOR.borde).stroke();
    doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(15);
    doc.text('CONTROL DE SECADO', left, y + 6, { width, align: 'center' });
    y += titleH + 8;

    const gap = 10;
    const panelW = 150;
    const tableW = width - panelW - gap;
    const tableHeaderH = 22;
    const rowH = 20;
    const obsH = 34;
    const filasSimples = 10;
    const bodyH = tableHeaderH + filasSimples * rowH + obsH;
    const tableTop = y;

    dibujarTablaPrincipal(doc, fila, left, tableTop, tableW, bodyH, tableHeaderH, rowH, obsH);
    dibujarPanelLateral(doc, fila, right - panelW, tableTop, panelW, bodyH);
}

function dibujarTablaPrincipal(
    doc: PDFKit.PDFDocument,
    fila: Fila,
    x: number,
    y: number,
    w: number,
    h: number,
    headerH: number,
    rowH: number,
    obsH: number
): void {
    const labelW = Math.round(w * 0.28);
    const valueW = w - labelW;
    const filas: { label: string; value: string }[] = [
        { label: 'SEC', value: String(fila.secadora || '').trim() },
        { label: 'SILO', value: String(fila.silo || '').trim() },
        { label: 'Fecha', value: fmtFecha(fila.fecha) },
        { label: 'Hora inicio', value: fmtHora(fila.inicio) },
        { label: 'Hora Fin', value: fmtHora(fila.fin) },
        { label: '% H. entrada', value: fmtPct(fila.humedad_entrada) },
        { label: '% H. salida', value: fmtPct(fila.humedad_salida) },
        { label: 'Productor', value: productorTexto(fila) },
        { label: 'Variedad', value: variedadTexto(fila) },
        { label: 'Ubicación', value: ubicacionTexto(fila) }
    ];
    const obs = String(fila.observacion || '').trim();
    const origen = origenesTexto(fila);

    doc.lineWidth(1.3).strokeColor(COLOR.borde).rect(x, y, w, h).stroke();

    const half = w / 2;
    doc.rect(x, y, half, headerH).fill(COLOR.grisClaro);
    doc.rect(x + half, y, half, headerH).fill(COLOR.grisClaro);
    doc.lineWidth(1).strokeColor(COLOR.borde);
    doc.rect(x, y, half, headerH).stroke();
    doc.rect(x + half, y, half, headerH).stroke();
    textoCaja(doc, `Código: ${codigoVisible(fila)}`, x, y, half, headerH, { bold: true, size: 10, padX: 8 });
    textoCaja(doc, `Origen: ${origen || '-'}`, x + half, y, half, headerH, { bold: true, size: 10, padX: 8 });

    let cy = y + headerH;
    for (const filaCampo of filas) {
        doc.rect(x, cy, labelW, rowH).fill(COLOR.grisClaro);
        doc.rect(x + labelW, cy, valueW, rowH).fill(COLOR.blanco);
        doc.lineWidth(1).strokeColor(COLOR.borde);
        doc.rect(x, cy, labelW, rowH).stroke();
        doc.rect(x + labelW, cy, valueW, rowH).stroke();
        textoCaja(doc, filaCampo.label, x, cy, labelW, rowH, { bold: true, size: 9.5, color: COLOR.label, padX: 8 });
        textoCaja(doc, filaCampo.value || '', x + labelW, cy, valueW, rowH, { size: 10, padX: 8 });
        cy += rowH;
    }

    doc.rect(x, cy, labelW, obsH).fill(COLOR.grisClaro);
    doc.rect(x + labelW, cy, valueW, obsH).fill(COLOR.blanco);
    doc.lineWidth(1).strokeColor(COLOR.borde);
    doc.rect(x, cy, labelW, obsH).stroke();
    doc.rect(x + labelW, cy, valueW, obsH).stroke();
    textoCaja(doc, 'OBS.', x, cy, labelW, obsH, { bold: true, size: 9.5, color: COLOR.label, padX: 8, padY: 10 });
    textoCaja(doc, obs, x + labelW, cy, valueW, obsH, { size: 9.5, padX: 8, padY: 6, wrap: true });
}

function dibujarPanelLateral(
    doc: PDFKit.PDFDocument,
    fila: Fila,
    x: number,
    y: number,
    w: number,
    h: number
): void {
    const nroHeaderH = 18;
    const nroBodyH = 36;
    const totalH = 28;
    const descHeaderH = 18;
    const descTop = y + nroHeaderH + nroBodyH;
    const descBodyH = h - nroHeaderH - nroBodyH - descHeaderH - totalH;

    doc.lineWidth(1.3).strokeColor(COLOR.borde).rect(x, y, w, h).stroke();

    doc.rect(x, y, w, nroHeaderH).fillAndStroke(COLOR.grisClaro, COLOR.borde);
    textoCaja(doc, 'Nro.', x, y, w, nroHeaderH, { bold: true, size: 10, align: 'center', padX: 3 });

    doc.rect(x, y + nroHeaderH, w, nroBodyH).fillAndStroke(COLOR.blanco, COLOR.borde);
    textoCaja(doc, nroDocumento(String(fila.codigo || ''), Number(fila.id)), x, y + nroHeaderH, w, nroBodyH, {
        bold: true,
        size: 22,
        align: 'center',
        padY: 7
    });

    doc.rect(x, descTop, w, descHeaderH).fillAndStroke(COLOR.grisClaro, COLOR.borde);
    textoCaja(doc, 'Operador', x, descTop, w, descHeaderH, { bold: true, size: 9, align: 'center', padX: 3 });

    const bodyY = descTop + descHeaderH;
    doc.rect(x, bodyY, w, descBodyH).fillAndStroke(COLOR.blanco, COLOR.borde);
    const persona = String(fila.operador || fila.responsable || '').trim();
    let ly = bodyY + 14;
    const lineGap = 16;
    const lineLeft = x + 10;
    const lineRight = x + w - 10;
    if (persona) {
        doc.fillColor(COLOR.texto).font('Helvetica').fontSize(9);
        doc.text(persona, lineLeft, ly - 10, { width: w - 20, lineBreak: false, ellipsis: true });
    }
    while (ly < bodyY + descBodyH - 6) {
        doc.moveTo(lineLeft, ly).lineTo(lineRight, ly).lineWidth(0.6).strokeColor(COLOR.grisLinea).stroke();
        ly += lineGap;
    }

    const totalY = y + h - totalH;
    const { cant, uni } = cantidadTotal(fila);
    const totalTxt = cant ? `~ ${cant}${uni ? ` ${uni}` : ''}` : '';
    doc.rect(x, totalY, w, totalH).fillAndStroke(COLOR.grisClaro, COLOR.borde);
    doc.fillColor(COLOR.texto).font('Helvetica-Oblique').fontSize(11);
    doc.text(totalTxt, x + 4, totalY + 8, { width: w - 8, align: 'center', lineBreak: false });
}

export async function enviarBoletaSecadoPdf(res: Response, id: unknown, usuario = ''): Promise<void> {
    const { buffer, codigo } = await bufferBoletaSecado(id, usuario);
    const safe = codigo.replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `inline; filename="Control_Secado_${safe}.pdf"`);
    res.send(buffer);
}
