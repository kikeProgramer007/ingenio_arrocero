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
        { title: 'Codigo', w: 70 },
        { title: 'Cant.', w: 55 },
        { title: 'Descripcion', w: width - 70 - 55 - 90 - 100 },
        { title: 'Precio', w: 90 },
        { title: 'Imp. Neto', w: 100 }
    ];
    doc.lineWidth(0.8);
    doc.moveTo(left, tableTop).lineTo(right, tableTop).stroke();
    let x = left;
    doc.font('Helvetica-Bold').fontSize(8);
    cols.forEach((col) => {
        const align = col.title === 'Descripcion' || col.title === 'Codigo' ? 'left' : 'right';
        doc.text(col.title, x + 2, tableTop + 4, { width: col.w - 4, align });
        x += col.w;
    });
    doc.moveTo(left, tableTop + 18).lineTo(right, tableTop + 18).stroke();

    let rowY = tableTop + 22;
    doc.font('Helvetica').fontSize(8);
    let cantTotal = 0;
    datos.lineas.forEach((linea) => {
        cantTotal += Number(linea.cantidad) || 0;
        x = left;
        const celdas = [
            linea.codigo,
            String(linea.cantidad),
            linea.descripcion,
            numeroTabla(linea.precio),
            numeroTabla(linea.importe)
        ];
        cols.forEach((col, i) => {
            const align = i <= 2 ? 'left' : 'right';
            doc.text(celdas[i], x + 2, rowY, { width: col.w - 4, align, ellipsis: true });
            x += col.w;
        });
        rowY += 14;
    });

    const totY = Math.max(rowY + 8, tableTop + 90);
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
    const logoW = dibujarLogotipo(doc, left, top, 48);
    const x = left + logoW;
    const empresa = datosEmpresa();
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14).text(empresa.nombre, x, top, { width: 400 });
    doc.fontSize(12).text(titulo, x, top + 18, { width: 500 });
    if (subtitulo) {
        doc.font('Helvetica').fontSize(9).fillColor('#555555').text(subtitulo, x, top + 36, { width: 500 });
        doc.fillColor('#000000');
    }
    doc.y = Math.max(doc.y, top + 78);
    doc.moveDown(0.4);
}
