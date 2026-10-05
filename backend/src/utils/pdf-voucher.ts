import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { toMoney } from './money';
import { datosEmpresa, rutaLogotipo } from './empresa';
import { montoALetrasBs } from './numero-letras';

export interface LineaVoucher {
    codigo: string;
    cantidad: number;
    descripcion: string;
    precio: number;
    importe: number;
}

export interface DatosVoucher {
    tipoDocumento: 'NOTA DE VENTA' | 'NOTA DE COMPRA';
    numero: number;
    fecha: Date;
    contraparteLabel: 'CLIENTE' | 'PROVEEDOR';
    contraparteNombre: string;
    nitCi: string;
    codigoContraparte: string;
    direccion: string;
    procedencia?: string;
    fechaVencimiento?: string;
    vendedor: string;
    tipoPago: string;
    detalle: string;
    lineas: LineaVoucher[];
    total: number;
    cobrado?: number;
    pendiente?: number;
}

function padNumero(n: number, size = 6): string {
    return String(n).padStart(size, '0');
}

function fmtFechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function numeroTabla(valor: number): string {
    return toMoney(valor).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const PDF_COLOR = {
    vino: '#a51c24',
    vinoOscuro: '#741419',
    zebra: '#FDF6F5',
    linea: '#E4D0CE',
    texto: '#222222',
    muted: '#5C5C5C',
    blanco: '#FFFFFF',
    fondoResumen: '#FAF6F6'
};

export function dibujarLogotipo(doc: PDFKit.PDFDocument, x: number, y: number, maxH = 70): number {
    const logo = rutaLogotipo();
    if (!logo) {
        return 0;
    }
    try {
        doc.image(logo, x, y, { fit: [88, maxH] });
        return 96;
    } catch {
        return 0;
    }
}

/** Formulario continuo 9 1/2" de ancho. Alto 11" o 5 1/2" según empresa.formato_nota. */
const INCH = 72;

function geometriaVoucher() {
    const compacto = datosEmpresa().formato_nota === '5.5';
    return {
        compacto,
        width: 9.5 * INCH,
        height: (compacto ? 5.5 : 11) * INCH,
        margin: (compacto ? 0.28 : 0.5) * INCH,
        logoH: compacto ? 32 : 54,
        titleSize: compacto ? 10 : 13,
        numeroSize: compacto ? 9 : 11,
        metaSize: compacto ? 7 : 8,
        headerH: compacto ? 14 : 18,
        rowMin: compacto ? 12 : 16,
        firmaGap: compacto ? 16 : 28,
        firmaLabel: compacto ? 18 : 32
    };
}

export function enviarVoucherPdf(res: Response, baseNombre: string, datos: DatosVoucher): void {
    const papel = geometriaVoucher();
    const doc = new PDFDocument({
        size: [papel.width, papel.height],
        layout: 'portrait',
        margin: papel.margin
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseNombre}.pdf"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    doc.pipe(res);
    dibujarVoucher(doc, datos);
    doc.end();
}

function dibujarVoucher(doc: PDFKit.PDFDocument, datos: DatosVoucher): void {
    const empresa = datosEmpresa();
    const g = geometriaVoucher();
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const top = doc.page.margins.top;
    const infoW = width * 0.48;
    const tituloW = width * 0.34;
    const gap = g.compacto ? 0 : 1;

    const logoW = dibujarLogotipo(doc, left, top, g.logoH);
    const headerX = left + logoW;
    const empresaW = Math.max(120, infoW - logoW);
    let y = top;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(g.compacto ? 8 : 9);
    if (empresa.titular) {
        doc.text(empresa.titular, headerX, y, { width: empresaW });
        y = doc.y + gap;
        doc.font('Helvetica').fontSize(g.metaSize);
        doc.text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + gap;
    } else {
        doc.fontSize(g.compacto ? 9 : 11).text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + (g.compacto ? 1 : 2);
        doc.font('Helvetica').fontSize(g.metaSize);
    }
    doc.font('Helvetica').fontSize(g.metaSize);
    if (empresa.direccion) {
        doc.text(empresa.direccion, headerX, y, { width: empresaW });
        y = doc.y;
    }
    if (empresa.nit) {
        doc.text(`NIT: ${empresa.nit}`, headerX, y, { width: empresaW });
        y = doc.y;
    }
    if (empresa.telefono) {
        doc.text(`Tel.: ${empresa.telefono}`, headerX, y, { width: empresaW });
        y = doc.y;
    }
    if (empresa.ciudad) {
        doc.text(empresa.ciudad, headerX, y, { width: empresaW });
        y = doc.y;
    }

    const tituloX = right - tituloW;
    doc.font('Helvetica-Bold').fontSize(g.titleSize).fillColor('#000000');
    doc.text(datos.tipoDocumento, tituloX, top, { width: tituloW, align: 'right' });
    doc.fontSize(g.numeroSize).text(`Nº ${padNumero(datos.numero)}`, tituloX, top + (g.compacto ? 14 : 18), { width: tituloW, align: 'right' });
    doc.font('Helvetica').fontSize(g.metaSize);
    const metaStep = g.compacto ? 10 : 12;
    let metaY = top + (g.compacto ? 26 : 34);
    doc.text('Página: 1', tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.text(`VENDEDOR: ${datos.vendedor.toUpperCase()}`, tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.text(empresa.nombre.toUpperCase(), tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.text(`FECHA: ${fmtFechaCorta(datos.fecha)}`, tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.text(`TIPO DE PAGO: ${datos.tipoPago}`, tituloX, metaY, { width: tituloW, align: 'right' });
    if (datos.fechaVencimiento) {
        metaY += metaStep;
        doc.text(`VENCIMIENTO: ${datos.fechaVencimiento}`, tituloX, metaY, { width: tituloW, align: 'right' });
    }

    const bloqueY = Math.max(y, metaY + (g.compacto ? 8 : 12)) + (g.compacto ? 4 : 8);
    doc.font('Helvetica-Bold').fontSize(g.compacto ? 8 : 9).fillColor('#000000');
    doc.text(`${datos.contraparteLabel}: ${datos.contraparteNombre.toUpperCase()}`, left, bloqueY, { width });
    doc.font('Helvetica').fontSize(g.metaSize);
    const lit = g.compacto ? 11 : 13;
    doc.text(`NIT/CI: ${datos.nitCi || '0'}`, left, bloqueY + lit);
    doc.text(`CODIGO: ${datos.codigoContraparte}`, left, bloqueY + lit * 2);
    const lineaDir = datos.procedencia
        ? `DIRECCION: ${datos.direccion || '-'}    PROCEDENCIA: ${datos.procedencia}`
        : `DIRECCION: ${datos.direccion || '-'}`;
    doc.text(lineaDir, left, bloqueY + lit * 3, { width });

    const tableTop = bloqueY + lit * 3 + (g.compacto ? 10 : 17);
    const colPrecio = g.compacto ? 64 : 72;
    const colImporte = g.compacto ? 70 : 78;
    const colCant = g.compacto ? 36 : 42;
    const colCodigo = g.compacto ? 56 : 64;
    const cols = [
        { title: 'Código', w: colCodigo, align: 'left' as const },
        { title: 'Cant.', w: colCant, align: 'right' as const },
        { title: 'Descripción', w: width - colCodigo - colCant - colPrecio - colImporte, align: 'left' as const },
        { title: 'Precio', w: colPrecio, align: 'right' as const },
        { title: 'Imp. Neto', w: colImporte, align: 'right' as const }
    ];
    const headerH = g.headerH;
    doc.save();
    doc.lineWidth(0.8).strokeColor('#000000');
    doc.rect(left, tableTop, width, headerH).stroke();
    let x = left;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(g.metaSize);
    cols.forEach((col, i) => {
        doc.text(col.title, x + 4, tableTop + (g.compacto ? 3 : 5), { width: col.w - 8, align: col.align, lineBreak: false });
        if (i < cols.length - 1) {
            doc.moveTo(x + col.w, tableTop).lineTo(x + col.w, tableTop + headerH).stroke();
        }
        x += col.w;
    });
    doc.restore();

    let rowY = tableTop + headerH;
    doc.font('Helvetica').fontSize(g.metaSize).fillColor('#000000');
    let cantTotal = 0;
    datos.lineas.forEach((linea) => {
        cantTotal += Number(linea.cantidad) || 0;
        const celdas = [
            linea.codigo || '',
            String(linea.cantidad),
            linea.descripcion || '',
            numeroTabla(linea.precio),
            numeroTabla(linea.importe)
        ];
        const altos = cols.map((col, i) =>
            Math.max(9, doc.heightOfString(celdas[i], { width: col.w - 8, align: col.align }))
        );
        const rowH = Math.max(g.rowMin, Math.max(...altos) + (g.compacto ? 4 : 6));
        x = left;
        doc.fillColor('#000000').font('Helvetica').fontSize(g.metaSize);
        cols.forEach((col, i) => {
            doc.text(celdas[i], x + 4, rowY + 2, { width: col.w - 8, align: col.align });
            x += col.w;
        });
        doc.strokeColor('#000000').lineWidth(0.4);
        doc.moveTo(left, rowY + rowH).lineTo(right, rowY + rowH).stroke();
        rowY += rowH;
    });
    doc.strokeColor('#000000').lineWidth(0.8);
    doc.rect(left, tableTop, width, rowY - tableTop).stroke();
    x = left;
    cols.forEach((col, i) => {
        if (i < cols.length - 1) {
            doc.moveTo(x + col.w, tableTop).lineTo(x + col.w, rowY).stroke();
        }
        x += col.w;
    });

    const totY = rowY + (g.compacto ? 4 : 8);
    const colVal = g.compacto ? 80 : 88;
    const colLbl = g.compacto ? 96 : 110;
    const totStep = g.compacto ? 12 : 14;
    doc.strokeColor('#000000').lineWidth(0.8);
    doc.moveTo(left, totY).lineTo(right, totY).stroke();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(g.compacto ? 8 : 9);
    doc.text(`SUBTOTALES  ${cantTotal}`, left, totY + 6);
    doc.text('DESCUENTO FIN.', right - colLbl - colVal, totY + 6, { width: colLbl, align: 'right' });
    doc.font('Helvetica').text(numeroTabla(0), right - colVal, totY + 6, { width: colVal, align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text('TOTAL Bs', right - colLbl - colVal, totY + 6 + totStep, { width: colLbl, align: 'right' });
    doc.text(numeroTabla(datos.total), right - colVal, totY + 6 + totStep, { width: colVal, align: 'right' });
    let extraTot = 0;
    if (datos.cobrado != null) {
        extraTot += totStep;
        doc.font('Helvetica').fontSize(g.metaSize);
        doc.text('COBRADO', right - colLbl - colVal, totY + 6 + totStep + extraTot, { width: colLbl, align: 'right' });
        doc.text(numeroTabla(datos.cobrado), right - colVal, totY + 6 + totStep + extraTot, { width: colVal, align: 'right' });
    }
    if (datos.pendiente != null) {
        extraTot += totStep;
        doc.font('Helvetica').fontSize(g.metaSize);
        doc.text('SALDO', right - colLbl - colVal, totY + 6 + totStep + extraTot, { width: colLbl, align: 'right' });
        doc.text(numeroTabla(datos.pendiente), right - colVal, totY + 6 + totStep + extraTot, { width: colVal, align: 'right' });
    }

    doc.font('Helvetica').fontSize(g.metaSize);
    doc.text(montoALetrasBs(datos.total), left, totY + 6 + totStep, { width: width - colLbl - colVal - 8 });
    doc.font('Helvetica-Bold');
    doc.text(`DETALLE: ${datos.detalle || ''}`, left, totY + 6 + totStep * 2, { width: width - colLbl - colVal - 8 });

    const ultimoTotales = totY + 6 + totStep + extraTot + (g.compacto ? 8 : 14);
    const firmasY = ultimoTotales + (g.compacto ? 4 : 10);
    const firmaW = width / 4;
    const etiquetas = ['VENDEDOR(a)', 'Pagado por', 'Recibido Por', 'CLIENTE'];
    doc.strokeColor('#000000').lineWidth(0.7).font('Helvetica').fontSize(g.metaSize).fillColor('#000000');
    etiquetas.forEach((label, i) => {
        const fx = left + i * firmaW;
        doc.moveTo(fx + 8, firmasY + g.firmaGap).lineTo(fx + firmaW - 8, firmasY + g.firmaGap).stroke();
        doc.text(label, fx, firmasY + g.firmaLabel, { width: firmaW, align: 'center' });
    });
}

export function dibujarEncabezadoPdf(doc: PDFKit.PDFDocument, titulo: string, subtitulo?: string): void {
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const logoW = dibujarLogotipo(doc, left, top, 52);
    const x = left + logoW;
    const textW = width - logoW;
    const empresa = datosEmpresa();
    let y = top;
    doc.fillColor(PDF_COLOR.texto).font('Helvetica-Bold').fontSize(12).text(empresa.nombre, x, y, { width: textW });
    y = doc.y + 2;
    const lineaEmpresa = [empresa.nit ? `NIT ${empresa.nit}` : '', empresa.ciudad, empresa.telefono ? `Tel. ${empresa.telefono}` : '']
        .filter(Boolean)
        .join(' · ');
    if (lineaEmpresa) {
        doc.font('Helvetica').fontSize(8).fillColor(PDF_COLOR.muted).text(lineaEmpresa, x, y, { width: textW });
        y = doc.y + 2;
    }
    doc.fontSize(15).fillColor(PDF_COLOR.vino).text(titulo, x, y, { width: textW });
    y = doc.y + 2;
    if (subtitulo) {
        doc.font('Helvetica').fontSize(9).fillColor(PDF_COLOR.muted).text(subtitulo, x, y, { width: textW });
        y = doc.y;
    }
    const headerBottom = Math.max(top + 56, y + 8);
    doc.strokeColor(PDF_COLOR.vino).lineWidth(1.4);
    doc.moveTo(left, headerBottom).lineTo(left + width, headerBottom).stroke();
    doc.strokeColor('#000000').lineWidth(1);
    doc.fillColor(PDF_COLOR.texto);
    doc.y = headerBottom + 12;
}
