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

function fmtFechaHora(fecha: Date): string {
    return fecha.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
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

export function enviarVoucherPdf(res: Response, baseNombre: string, datos: DatosVoucher): void {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28
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

    const logoW = dibujarLogotipo(doc, left, top, 70);
    const headerX = left + logoW;
    let y = top;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
    if (empresa.titular) {
        doc.text(empresa.titular, headerX, y, { width: 220 });
        y += 12;
        doc.font('Helvetica').fontSize(8);
        doc.text(empresa.nombre, headerX, y, { width: 220 });
        y += 11;
    } else {
        doc.fontSize(12).text(empresa.nombre, headerX, y, { width: 220 });
        y += 14;
        doc.font('Helvetica').fontSize(8);
    }
    if (empresa.direccion) {
        doc.text(empresa.direccion, headerX, y, { width: 220 });
        y += 11;
    }
    if (empresa.telefono) {
        doc.text(`Tel.: ${empresa.telefono}`, headerX, y, { width: 220 });
        y += 11;
    }
    if (empresa.ciudad) {
        doc.text(empresa.ciudad, headerX, y, { width: 220 });
        y += 11;
    }

    const centro = left + width * 0.42;
    doc.font('Helvetica-Bold').fontSize(16).text(datos.tipoDocumento, centro, top + 8, { width: 200, align: 'center' });
    doc.font('Helvetica').fontSize(8);
    doc.text(`VENDEDOR: ${datos.vendedor.toUpperCase()}`, centro, top + 32, { width: 200, align: 'center' });
    doc.text(empresa.nombre.toUpperCase(), centro, top + 44, { width: 200, align: 'center' });
    doc.text(`FECHA: ${fmtFechaCorta(datos.fecha)}`, centro, top + 56, { width: 200, align: 'center' });
    doc.text(`TIPO DE PAGO: ${datos.tipoPago}`, centro, top + 68, { width: 200, align: 'center' });

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Nº ${padNumero(datos.numero)}`, right - 130, top + 8, { width: 130, align: 'right' });
    doc.font('Helvetica').fontSize(8);
    doc.text('Pagina: 1', right - 130, top + 24, { width: 130, align: 'right' });

    const bloqueY = Math.max(y, top + 84) + 6;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`${datos.contraparteLabel}: ${datos.contraparteNombre.toUpperCase()}`, left, bloqueY);
    doc.font('Helvetica').fontSize(8);
    doc.text(`NIT/CI: ${datos.nitCi || '0'}`, left, bloqueY + 13);
    doc.text(`CODIGO: ${datos.codigoContraparte}`, left, bloqueY + 26);
    doc.text(`DIRECCION: ${datos.direccion || '-'}`, left, bloqueY + 39, { width: width * 0.55 });

    const tableTop = bloqueY + 58;
    const cols = [
        { title: 'Código', w: 78, align: 'left' as const },
        { title: 'Cant.', w: 50, align: 'right' as const },
        { title: 'Descripción', w: width - 78 - 50 - 90 - 100, align: 'left' as const },
        { title: 'Precio', w: 90, align: 'right' as const },
        { title: 'Imp. Neto', w: 100, align: 'right' as const }
    ];
    const headerH = 20;
    doc.save();
    doc.rect(left, tableTop, width, headerH).fill(PDF_COLOR.vino);
    let x = left;
    doc.fillColor(PDF_COLOR.blanco).font('Helvetica-Bold').fontSize(8);
    cols.forEach((col) => {
        doc.text(col.title, x + 5, tableTop + 6, { width: col.w - 10, align: col.align, lineBreak: false });
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
            Math.max(11, doc.heightOfString(celdas[i], { width: col.w - 10, align: col.align }))
        );
        const rowH = Math.max(18, Math.max(...altos) + 8);
        if (idx % 2 === 0) {
            doc.rect(left, rowY, width, rowH).fill(PDF_COLOR.zebra);
        }
        x = left;
        doc.fillColor(PDF_COLOR.texto).font('Helvetica').fontSize(8);
        cols.forEach((col, i) => {
            doc.text(celdas[i], x + 5, rowY + 4, { width: col.w - 10, align: col.align });
            x += col.w;
        });
        doc.strokeColor(PDF_COLOR.linea).lineWidth(0.3);
        doc.moveTo(left, rowY + rowH).lineTo(right, rowY + rowH).stroke();
        rowY += rowH;
    });
    doc.strokeColor(PDF_COLOR.vinoOscuro).lineWidth(0.8);
    doc.rect(left, tableTop, width, rowY - tableTop).stroke();

    const totY = Math.max(rowY + 10, tableTop + 90);
    doc.moveTo(left, totY).lineTo(right, totY).stroke();
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`SUBTOTALES  ${cantTotal}`, left, totY + 8);
    doc.text('DESCUENTO FIN.', right - 220, totY + 8, { width: 110, align: 'right' });
    doc.font('Helvetica').text(numeroTabla(0), right - 100, totY + 8, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold');
    doc.text('TOTAL Bs', right - 220, totY + 22, { width: 110, align: 'right' });
    doc.text(numeroTabla(datos.total), right - 100, totY + 22, { width: 100, align: 'right' });
    if (datos.cobrado != null) {
        doc.font('Helvetica').fontSize(8);
        doc.text('COBRADO', right - 220, totY + 36, { width: 110, align: 'right' });
        doc.text(numeroTabla(datos.cobrado), right - 100, totY + 36, { width: 100, align: 'right' });
    }
    if (datos.pendiente != null) {
        doc.font('Helvetica').fontSize(8);
        doc.text('SALDO', right - 220, totY + 50, { width: 110, align: 'right' });
        doc.text(numeroTabla(datos.pendiente), right - 100, totY + 50, { width: 100, align: 'right' });
    }

    doc.font('Helvetica').fontSize(8);
    doc.text(montoALetrasBs(datos.total), left, totY + 24, { width: width * 0.58 });
    doc.font('Helvetica-Bold');
    doc.text(`DETALLE: ${datos.detalle}`, left, totY + 40);

    const firmasY = totY + 78;
    const firmaW = width / 4;
    const etiquetas = ['VENDEDOR(a)', 'Pagado por', 'Recibido Por', 'CLIENTE'];
    doc.font('Helvetica').fontSize(8);
    etiquetas.forEach((label, i) => {
        const fx = left + i * firmaW;
        doc.moveTo(fx + 16, firmasY + 36).lineTo(fx + firmaW - 16, firmasY + 36).stroke();
        doc.text(label, fx, firmasY + 40, { width: firmaW, align: 'center' });
    });

    const pieY = doc.page.height - doc.page.margins.bottom - 12;
    doc.fontSize(7).fillColor('#333333');
    doc.text(`${fmtFechaHora(datos.fecha)} - Guardado por: ${datos.vendedor.toUpperCase()}`, left, pieY, {
        width,
        align: 'left'
    });
    doc.fillColor('#000000');
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
