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

/** Formulario continuo 9 1/2" × 11" (Paper King 140103, 3 vías). PDF en puntos (72/pulgada). */
const INCH = 72;
const PAPEL_CONTINUO = {
    width: 9.5 * INCH,
    height: 11 * INCH,
    margin: 0.5 * INCH
};

export function enviarVoucherPdf(res: Response, baseNombre: string, datos: DatosVoucher): void {
    const doc = new PDFDocument({
        size: [PAPEL_CONTINUO.width, PAPEL_CONTINUO.height],
        layout: 'portrait',
        margin: PAPEL_CONTINUO.margin
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
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const top = doc.page.margins.top;
    const infoW = width * 0.48;
    const tituloW = width * 0.34;

    const logoW = dibujarLogotipo(doc, left, top, 54);
    const headerX = left + logoW;
    const empresaW = Math.max(120, infoW - logoW);
    let y = top;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
    if (empresa.titular) {
        doc.text(empresa.titular, headerX, y, { width: empresaW });
        y = doc.y + 1;
        doc.font('Helvetica').fontSize(8);
        doc.text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + 1;
    } else {
        doc.fontSize(11).text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(8);
    }
    doc.font('Helvetica').fontSize(8);
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
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
    doc.text(datos.tipoDocumento, tituloX, top, { width: tituloW, align: 'right' });
    doc.fontSize(11).text(`Nº ${padNumero(datos.numero)}`, tituloX, top + 18, { width: tituloW, align: 'right' });
    doc.font('Helvetica').fontSize(8);
    doc.text('Página: 1', tituloX, top + 34, { width: tituloW, align: 'right' });
    doc.text(`VENDEDOR: ${datos.vendedor.toUpperCase()}`, tituloX, top + 48, { width: tituloW, align: 'right' });
    doc.text(empresa.nombre.toUpperCase(), tituloX, top + 60, { width: tituloW, align: 'right' });
    doc.text(`FECHA: ${fmtFechaCorta(datos.fecha)}`, tituloX, top + 72, { width: tituloW, align: 'right' });
    doc.text(`TIPO DE PAGO: ${datos.tipoPago}`, tituloX, top + 84, { width: tituloW, align: 'right' });

    const bloqueY = Math.max(y, top + 100) + 8;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
    doc.text(`${datos.contraparteLabel}: ${datos.contraparteNombre.toUpperCase()}`, left, bloqueY, { width });
    doc.font('Helvetica').fontSize(8);
    doc.text(`NIT/CI: ${datos.nitCi || '0'}`, left, bloqueY + 13);
    doc.text(`CODIGO: ${datos.codigoContraparte}`, left, bloqueY + 25);
    doc.text(`DIRECCION: ${datos.direccion || '-'}`, left, bloqueY + 37, { width });

    const tableTop = bloqueY + 54;
    const colPrecio = 72;
    const colImporte = 78;
    const colCant = 42;
    const colCodigo = 64;
    const cols = [
        { title: 'Código', w: colCodigo, align: 'left' as const },
        { title: 'Cant.', w: colCant, align: 'right' as const },
        { title: 'Descripción', w: width - colCodigo - colCant - colPrecio - colImporte, align: 'left' as const },
        { title: 'Precio', w: colPrecio, align: 'right' as const },
        { title: 'Imp. Neto', w: colImporte, align: 'right' as const }
    ];
    const headerH = 18;
    doc.save();
    doc.rect(left, tableTop, width, headerH).fill(PDF_COLOR.vino);
    let x = left;
    doc.fillColor(PDF_COLOR.blanco).font('Helvetica-Bold').fontSize(8);
    cols.forEach((col) => {
        doc.text(col.title, x + 4, tableTop + 5, { width: col.w - 8, align: col.align, lineBreak: false });
        x += col.w;
    });
    doc.restore();

    let rowY = tableTop + headerH;
    doc.font('Helvetica').fontSize(8).fillColor(PDF_COLOR.texto);
    let cantTotal = 0;
    datos.lineas.forEach((linea, idx) => {
        cantTotal += Number(linea.cantidad) || 0;
        const celdas = [
            linea.codigo || '',
            String(linea.cantidad),
            linea.descripcion || '',
            numeroTabla(linea.precio),
            numeroTabla(linea.importe)
        ];
        const altos = cols.map((col, i) =>
            Math.max(10, doc.heightOfString(celdas[i], { width: col.w - 8, align: col.align }))
        );
        const rowH = Math.max(16, Math.max(...altos) + 6);
        if (idx % 2 === 0) {
            doc.rect(left, rowY, width, rowH).fill(PDF_COLOR.zebra);
        }
        x = left;
        doc.fillColor(PDF_COLOR.texto).font('Helvetica').fontSize(8);
        cols.forEach((col, i) => {
            doc.text(celdas[i], x + 4, rowY + 3, { width: col.w - 8, align: col.align });
            x += col.w;
        });
        doc.strokeColor(PDF_COLOR.linea).lineWidth(0.3);
        doc.moveTo(left, rowY + rowH).lineTo(right, rowY + rowH).stroke();
        rowY += rowH;
    });
    doc.strokeColor(PDF_COLOR.vinoOscuro).lineWidth(0.8);
    doc.rect(left, tableTop, width, rowY - tableTop).stroke();

    const totY = Math.max(rowY + 10, tableTop + 80);
    const colVal = 88;
    const colLbl = 110;
    doc.moveTo(left, totY).lineTo(right, totY).stroke();
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`SUBTOTALES  ${cantTotal}`, left, totY + 8);
    doc.text('DESCUENTO FIN.', right - colLbl - colVal, totY + 8, { width: colLbl, align: 'right' });
    doc.font('Helvetica').text(numeroTabla(0), right - colVal, totY + 8, { width: colVal, align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text('TOTAL Bs', right - colLbl - colVal, totY + 22, { width: colLbl, align: 'right' });
    doc.text(numeroTabla(datos.total), right - colVal, totY + 22, { width: colVal, align: 'right' });
    if (datos.cobrado != null) {
        doc.font('Helvetica').fontSize(8);
        doc.text('COBRADO', right - colLbl - colVal, totY + 36, { width: colLbl, align: 'right' });
        doc.text(numeroTabla(datos.cobrado), right - colVal, totY + 36, { width: colVal, align: 'right' });
    }
    if (datos.pendiente != null) {
        doc.font('Helvetica').fontSize(8);
        doc.text('SALDO', right - colLbl - colVal, totY + 50, { width: colLbl, align: 'right' });
        doc.text(numeroTabla(datos.pendiente), right - colVal, totY + 50, { width: colVal, align: 'right' });
    }

    doc.font('Helvetica').fontSize(8);
    doc.text(montoALetrasBs(datos.total), left, totY + 24, { width: width - colLbl - colVal - 8 });
    doc.font('Helvetica-Bold');
    doc.text(`DETALLE: ${datos.detalle || ''}`, left, totY + 40, { width: width - colLbl - colVal - 8 });

    const firmasY = totY + 78;
    const firmaW = width / 4;
    const etiquetas = ['VENDEDOR(a)', 'Pagado por', 'Recibido Por', 'CLIENTE'];
    doc.font('Helvetica').fontSize(8);
    etiquetas.forEach((label, i) => {
        const fx = left + i * firmaW;
        doc.moveTo(fx + 10, firmasY + 36).lineTo(fx + firmaW - 10, firmasY + 36).stroke();
        doc.text(label, fx, firmasY + 40, { width: firmaW, align: 'center' });
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
