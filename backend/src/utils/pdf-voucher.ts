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
    plazoDias?: number | null;
    vendedor: string;
    tipoPago: string;
    detalle: string;
    lineas: LineaVoucher[];
    total: number;
    cobrado?: number;
    pendiente?: number;
}

export type TipoReciboMovimiento = 'COBRANZA' | 'COMPROBANTE DE INGRESO' | 'COMPROBANTE DE EGRESO';

export interface LineaReciboMovimiento {
    codigo: string;
    descripcion: string;
    importe: number;
}

export interface DatosReciboMovimiento {
    tipoDocumento: TipoReciboMovimiento;
    serie: 'VCRE' | 'IN' | 'EG';
    numero: number;
    fecha: Date;
    tipoCambio?: number | null;
    metodo: string;
    detalle: string;
    contraparteLabel: string;
    contraparteNombre: string;
    nitCi?: string;
    lineas: LineaReciboMovimiento[];
    total: number;
    saldoPendiente?: number | null;
    referencia?: string;
    observacion?: string;
    usuario: string;
}

/** @deprecated usar DatosReciboMovimiento */
export type DatosReciboPago = DatosReciboMovimiento;

function padNumero(n: number, size = 6): string {
    return String(n).padStart(size, '0');
}

function fmtFechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtFechaHora(fecha: Date): string {
    const hora = fecha.toLocaleTimeString('es-BO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return `${fmtFechaCorta(fecha)} ${hora}`;
}

function fmtCantidad(valor: number): string {
    const n = Number(valor);
    if (!Number.isFinite(n)) {
        return '';
    }
    return Number.isInteger(n)
        ? String(n)
        : n.toLocaleString('es-BO', { maximumFractionDigits: 3 });
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
const PT_POR_MM = 72 / 25.4;
const mmToPt = (mm: number) => mm * PT_POR_MM;

/**
 * Nota de venta/compra en Carta vertical (215,9 × 279,4 mm).
 * Toda la boleta (márgenes + pie) cabe en ~123 mm; la mitad inferior queda vacía.
 */
export const NOTA_FORMULARIO = {
    anchoMm: 8.5 * 25.4,
    altoMm: 11 * 25.4,
    contenidoMaxMm: 123,
    margenMm: 7,
    gapDirTablaMm: 3.5,
    firmaEspacioMm: 18,
    filasDetalle: 10,
    logoH: 22,
    headerH: 12,
    rowMin: 12,
    metaSize: 7,
    titleSize: 10,
    numeroSize: 9
};

export function notaDetalleAltoMm(): number {
    const f = NOTA_FORMULARIO;
    return ((f.headerH + f.filasDetalle * f.rowMin) * 25.4) / 72;
}

function tamanoNota(): { width: number; height: number; margin: number; limiteY: number } {
    return {
        width: 8.5 * INCH,
        height: 11 * INCH,
        margin: mmToPt(NOTA_FORMULARIO.margenMm),
        limiteY: mmToPt(NOTA_FORMULARIO.contenidoMaxMm)
    };
}

function documentoNota(): PDFKit.PDFDocument {
    return new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margin: 0,
        bufferPages: true,
        autoFirstPage: true
    });
}

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
    const doc = documentoNota();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseNombre}.pdf"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    doc.pipe(res);
    dibujarVoucher(doc, datos);
    doc.end();
}

export function bufferVoucherPdf(datos: DatosVoucher): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = documentoNota();
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        dibujarVoucher(doc, datos);
        doc.end();
    });
}

export function enviarReciboPagoPdf(res: Response, baseNombre: string, datos: DatosReciboMovimiento): void {
    enviarReciboMovimientoPdf(res, baseNombre, datos);
}

export function enviarReciboMovimientoPdf(res: Response, baseNombre: string, datos: DatosReciboMovimiento): void {
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
    dibujarReciboMovimiento(doc, datos);
    doc.end();
}

function folioRecibo(serie: string, numero: number): string {
    return `${serie}-${padNumero(numero)}`;
}

function dibujarReciboMovimiento(doc: PDFKit.PDFDocument, datos: DatosReciboMovimiento): void {
    const empresa = datosEmpresa();
    const g = geometriaVoucher();
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const top = doc.page.margins.top;
    const infoW = width * 0.52;
    const tituloW = width * 0.4;
    const folio = folioRecibo(datos.serie, datos.numero);
    const tc = datos.tipoCambio && datos.tipoCambio > 0 ? datos.tipoCambio : empresa.tipo_cambio;

    const logoW = dibujarLogotipo(doc, left, top, g.logoH);
    const headerX = left + logoW;
    const empresaW = Math.max(120, infoW - logoW);
    let y = top;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(g.compacto ? 8 : 9);
    if (empresa.titular) {
        doc.text(empresa.titular, headerX, y, { width: empresaW });
        y = doc.y + 1;
        doc.font('Helvetica').fontSize(g.metaSize);
        doc.text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + 1;
    } else {
        doc.fontSize(g.compacto ? 9 : 11).text(empresa.nombre, headerX, y, { width: empresaW });
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(g.metaSize);
    }
    doc.font('Helvetica').fontSize(g.metaSize);
    if (empresa.direccion) {
        doc.text(empresa.direccion, headerX, y, { width: empresaW });
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
    const metaStep = g.compacto ? 10 : 12;
    let metaY = top + (g.compacto ? 14 : 18);
    doc.fontSize(g.numeroSize).text(`Nro. Doc.: ${folio}`, tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.font('Helvetica').fontSize(g.metaSize);
    doc.text(`Fecha: ${fmtFechaCorta(datos.fecha)}`, tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    if (tc) {
        doc.text(`Tipo de cambio: ${tc}`, tituloX, metaY, { width: tituloW, align: 'right' });
        metaY += metaStep;
    }
    doc.text(`Método: ${datos.metodo || '-'}`, tituloX, metaY, { width: tituloW, align: 'right' });
    metaY += metaStep;
    doc.text('Página: 1', tituloX, metaY, { width: tituloW, align: 'right' });

    y = Math.max(y, metaY) + (g.compacto ? 8 : 12);
    doc.font('Helvetica-Bold').fontSize(g.compacto ? 8 : 9);
    doc.text(`${datos.contraparteLabel}: ${datos.contraparteNombre.toUpperCase()}`, left, y, { width });
    y = doc.y + 2;
    doc.font('Helvetica').fontSize(g.metaSize);
    if (datos.nitCi) {
        doc.text(`NIT/CI: ${datos.nitCi}`, left, y, { width });
        y = doc.y;
    }
    doc.text(`Detalle: ${datos.detalle || '-'}`, left, y, { width });
    y = doc.y;
    if (datos.referencia) {
        doc.text(`Referencia: ${datos.referencia}`, left, y, { width });
        y = doc.y;
    }
    if (datos.observacion && datos.observacion !== datos.detalle) {
        doc.text(`Por lo siguiente: ${datos.observacion}`, left, y, { width });
        y = doc.y;
    }

    const tableTop = y + (g.compacto ? 8 : 12);
    const colImporte = g.compacto ? 80 : 90;
    const colCodigo = g.compacto ? 80 : 92;
    const cols = [
        { title: 'Código / Nro. Doc.', w: colCodigo, align: 'left' as const },
        { title: 'Descripción', w: width - colCodigo - colImporte, align: 'left' as const },
        { title: 'Importe', w: colImporte, align: 'right' as const }
    ];
    const headerH = g.headerH;
    doc.save();
    doc.lineWidth(0.8).strokeColor('#000000');
    doc.rect(left, tableTop, width, headerH).stroke();
    let hx = left;
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(g.metaSize);
    cols.forEach((col, i) => {
        doc.text(col.title, hx + 4, tableTop + (g.compacto ? 3 : 5), { width: col.w - 8, align: col.align, lineBreak: false });
        if (i < cols.length - 1) {
            doc.moveTo(hx + col.w, tableTop).lineTo(hx + col.w, tableTop + headerH).stroke();
        }
        hx += col.w;
    });
    doc.restore();

    let rowY = tableTop + headerH;
    const lineas = datos.lineas.length ? datos.lineas : [{ codigo: folio, descripcion: datos.detalle, importe: datos.total }];
    lineas.forEach((linea) => {
        const celdas = [linea.codigo || '', linea.descripcion || '', numeroTabla(linea.importe)];
        const altos = cols.map((col, i) => Math.max(9, doc.heightOfString(celdas[i], { width: col.w - 8, align: col.align })));
        const rowH = Math.max(g.rowMin, Math.max(...altos) + (g.compacto ? 4 : 6));
        let x = left;
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
    let vx = left;
    cols.forEach((col, i) => {
        if (i < cols.length - 1) {
            doc.moveTo(vx + col.w, tableTop).lineTo(vx + col.w, rowY).stroke();
        }
        vx += col.w;
    });

    let totY = rowY + (g.compacto ? 8 : 12);
    doc.font('Helvetica').fontSize(g.metaSize);
    doc.text(`Son: ${montoALetrasBs(datos.total)}`, left, totY, { width: width * 0.68 });
    doc.font('Helvetica-Bold').fontSize(g.compacto ? 9 : 11);
    doc.text(`TOTAL  ${numeroTabla(datos.total)}`, left + width * 0.68, totY, { width: width * 0.32, align: 'right' });
    totY = doc.y + 4;
    if (datos.saldoPendiente != null) {
        doc.font('Helvetica').fontSize(g.metaSize);
        doc.text(`Saldo pendiente: Bs ${numeroTabla(datos.saldoPendiente)}`, left, totY, { width });
        totY = doc.y + 2;
    }
    doc.font('Helvetica').fontSize(g.metaSize).fillColor('#5C5C5C');
    doc.text(`Registrado por: ${datos.usuario || '-'}`, left, totY, { width });
    doc.fillColor('#000000');

    const firmas = datos.tipoDocumento === 'COBRANZA'
        ? ['VENDEDOR(a)', `Cobrador por\n${datos.usuario || ''}`, 'Pagado por', 'CLIENTE']
        : ['Recibido por', 'Pagado por'];
    const firmaW = width / firmas.length;
    const firmasY = Math.min(doc.y + (g.compacto ? 22 : 34), doc.page.height - doc.page.margins.bottom - g.firmaLabel - 18);
    doc.strokeColor('#000000').lineWidth(0.7).font('Helvetica').fontSize(g.metaSize);
    firmas.forEach((label, i) => {
        const fx = left + i * firmaW;
        doc.moveTo(fx + 10, firmasY + g.firmaGap).lineTo(fx + firmaW - 10, firmasY + g.firmaGap).stroke();
        doc.text(label, fx, firmasY + g.firmaLabel, { width: firmaW, align: 'center' });
    });
}

function dibujarLogoNota(doc: PDFKit.PDFDocument, x: number, y: number, alto: number): number {
    const logo = rutaLogotipo();
    if (!logo) {
        return 0;
    }
    try {
        const ancho = 36;
        doc.image(logo, x, y, { fit: [ancho, alto] });
        return ancho + 5;
    } catch {
        return 0;
    }
}

function textoPlazo(datos: DatosVoucher): string {
    if (datos.plazoDias && datos.plazoDias > 0) {
        return `${datos.plazoDias} ${datos.plazoDias === 1 ? 'día' : 'días'}`;
    }
    return '';
}

function dibujarVoucher(doc: PDFKit.PDFDocument, datos: DatosVoucher): void {
    const empresa = datosEmpresa();
    const f = NOTA_FORMULARIO;
    const papel = tamanoNota();
    const left = papel.margin;
    const right = papel.width - papel.margin;
    const width = right - left;
    const top = papel.margin;
    const limiteY = papel.limiteY;
    const meta = f.metaSize;
    const headerH = f.headerH;
    const totStep = 8;
    const colVal = 72;
    const colLbl = 90;
    const gapDirTabla = mmToPt(f.gapDirTablaMm);
    const firmaEspacio = mmToPt(f.firmaEspacioMm);
    const detalleH = headerH + f.filasDetalle * f.rowMin;
    let extraTot = 0;
    if (datos.cobrado != null) extraTot += totStep;
    if (datos.pendiente != null) extraTot += totStep;
    const altoTotales = 5 + totStep + extraTot + 12;
    const cols = [
        { title: 'Código', w: 52, align: 'left' as const },
        { title: 'Cantidad', w: 42, align: 'right' as const },
        { title: 'Descripción', w: 0, align: 'left' as const },
        { title: 'Precio', w: 62, align: 'right' as const },
        { title: 'Importe', w: 68, align: 'right' as const }
    ];
    cols[2].w = width - cols[0].w - cols[1].w - cols[3].w - cols[4].w;

    const celdasDe = (linea: LineaVoucher) => [
        linea.codigo || '',
        fmtCantidad(linea.cantidad),
        linea.descripcion || '',
        numeroTabla(linea.precio),
        numeroTabla(linea.importe)
    ];

    const altoFila = (linea: LineaVoucher) => {
        doc.font('Helvetica').fontSize(meta);
        const celdas = celdasDe(linea);
        const altos = cols.map((col, i) =>
            Math.max(8, doc.heightOfString(celdas[i], { width: col.w - 8, align: col.align }))
        );
        return Math.max(f.rowMin, Math.max(...altos) + 2);
    };

    const lineas = datos.lineas || [];
    const altos = lineas.map(altoFila);
    const cantTotal = lineas.reduce((acc, linea) => acc + (Number(linea.cantidad) || 0), 0);

    const pintarIdentificacion = (pagina: number, paginas: number, compacta: boolean) => {
        const logoW = compacta ? 0 : dibujarLogoNota(doc, left, top, f.logoH);
        const headerX = left + logoW;
        const empresaW = Math.max(100, width * 0.52 - logoW);
        const tituloW = width * 0.4;
        const tituloX = right - tituloW;
        const line = 7.5;
        let yEmp = top;
        doc.fillColor('#000000');
        if (!compacta) {
            doc.font('Helvetica-Bold').fontSize(8);
            if (empresa.titular) {
                doc.text(empresa.titular, headerX, yEmp, { width: empresaW, lineBreak: false });
                yEmp += line;
                doc.font('Helvetica').fontSize(meta);
                doc.text(empresa.nombre, headerX, yEmp, { width: empresaW, lineBreak: false });
                yEmp += line;
            } else {
                doc.text(empresa.nombre, headerX, yEmp, { width: empresaW, lineBreak: false });
                yEmp += line;
            }
            doc.font('Helvetica').fontSize(meta);
            if (empresa.direccion) {
                doc.text(empresa.direccion, headerX, yEmp, { width: empresaW, lineBreak: false });
                yEmp += line;
            }
            const pieEmp = [empresa.telefono ? `Tel.: ${empresa.telefono}` : '', empresa.ciudad]
                .filter(Boolean)
                .join('  ·  ');
            if (pieEmp) {
                doc.text(pieEmp, headerX, yEmp, { width: empresaW, lineBreak: false });
                yEmp += line;
            }
        } else {
            doc.font('Helvetica-Bold').fontSize(8);
            doc.text(empresa.nombre, headerX, yEmp, { width: empresaW, lineBreak: false });
            yEmp += line;
        }

        doc.font('Helvetica-Bold').fontSize(f.titleSize);
        doc.text(datos.tipoDocumento, tituloX, top, { width: tituloW, align: 'right', lineBreak: false });
        doc.fontSize(f.numeroSize).text(`Nº ${padNumero(datos.numero)}`, tituloX, top + 10, {
            width: tituloW,
            align: 'right',
            lineBreak: false
        });
        const metaStep = 7.5;
        let metaY = top + 20;
        doc.font('Helvetica').fontSize(meta);
        const paginaTxt = paginas > 1 ? `Página: ${pagina} de ${paginas}` : `Página: ${pagina}`;
        doc.text(paginaTxt, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        metaY += metaStep;
        doc.text(`VENDEDOR: ${datos.vendedor.toUpperCase()}`, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        metaY += metaStep;
        doc.text(`FECHA: ${fmtFechaCorta(datos.fecha)}`, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        metaY += metaStep;
        doc.text(`TIPO DE PAGO: ${datos.tipoPago}`, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        const plazo = textoPlazo(datos);
        if (plazo) {
            metaY += metaStep;
            doc.text(`PLAZO: ${plazo}`, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        } else if (datos.fechaVencimiento) {
            metaY += metaStep;
            doc.text(`VENCIMIENTO: ${datos.fechaVencimiento}`, tituloX, metaY, { width: tituloW, align: 'right', lineBreak: false });
        }

        const bloqueY = Math.max(yEmp, metaY) + 3;
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text(`${datos.contraparteLabel}: ${datos.contraparteNombre.toUpperCase()}`, left, bloqueY, {
            width,
            lineBreak: false
        });
        doc.font('Helvetica').fontSize(meta);
        const lit = 7.5;
        doc.text(`NIT/CI: ${datos.nitCi || '0'}     CODIGO: ${datos.codigoContraparte}`, left, bloqueY + lit, {
            width,
            lineBreak: false
        });
        const lineaDir = datos.procedencia
            ? `DIRECCION: ${datos.direccion || '-'}    PROCEDENCIA: ${datos.procedencia}`
            : `DIRECCION: ${datos.direccion || '-'}`;
        doc.text(lineaDir, left, bloqueY + lit * 2, { width, lineBreak: false });
        return bloqueY + lit * 2 + 2;
    };

    const marcoTabla = (origenY: number, alto: number) => {
        doc.save();
        doc.lineWidth(0.6).strokeColor('#000000');
        doc.rect(left, origenY, width, alto).stroke();
        doc.moveTo(left, origenY + headerH).lineTo(right, origenY + headerH).stroke();
        let vx = left;
        cols.forEach((col, i) => {
            if (i < cols.length - 1) {
                doc.moveTo(vx + col.w, origenY).lineTo(vx + col.w, origenY + alto).stroke();
            }
            vx += col.w;
        });
        let hx = left;
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(meta);
        cols.forEach((col) => {
            doc.text(col.title, hx + 3, origenY + 3, { width: col.w - 6, align: col.align, lineBreak: false });
            hx += col.w;
        });
        doc.restore();
    };

    const pintarFilas = (origenY: number, desde: number, hasta: number) => {
        let rowY = origenY + headerH;
        for (let i = desde; i < hasta; i++) {
            const rowH = altos[i];
            const celdas = celdasDe(lineas[i]);
            let x = left;
            doc.fillColor('#000000').font('Helvetica').fontSize(meta);
            cols.forEach((col, c) => {
                doc.save();
                doc.rect(x, rowY, col.w, rowH).clip();
                doc.text(celdas[c], x + 3, rowY + 2, {
                    width: col.w - 6,
                    align: col.align,
                    height: rowH - 2
                });
                doc.restore();
                x += col.w;
            });
            doc.strokeColor('#000000').lineWidth(0.35);
            doc.moveTo(left, rowY + rowH).lineTo(right, rowY + rowH).stroke();
            rowY += rowH;
        }
    };

    const pintarPie = (totY: number, continua = false) => {
        doc.strokeColor('#000000').lineWidth(0.6);
        doc.moveTo(left, totY).lineTo(right, totY).stroke();
        if (continua) {
            doc.font('Helvetica').fontSize(meta).fillColor('#000000');
            doc.text('Continúa en la página siguiente', left, totY + 6, { width, align: 'center', lineBreak: false });
            return;
        }
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7.5);
        doc.text(`SUBTOTALES  ${fmtCantidad(cantTotal)}`, left, totY + 3, { lineBreak: false });
        doc.text('DESCUENTO FIN.', right - colLbl - colVal, totY + 3, { width: colLbl, align: 'right', lineBreak: false });
        doc.font('Helvetica').text(numeroTabla(0), right - colVal, totY + 3, { width: colVal, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold');
        doc.text('TOTAL Bs', right - colLbl - colVal, totY + 3 + totStep, { width: colLbl, align: 'right', lineBreak: false });
        doc.text(numeroTabla(datos.total), right - colVal, totY + 3 + totStep, { width: colVal, align: 'right', lineBreak: false });
        let extra = 0;
        if (datos.cobrado != null) {
            extra += totStep;
            doc.font('Helvetica').fontSize(meta);
            doc.text('COBRADO', right - colLbl - colVal, totY + 3 + totStep + extra, { width: colLbl, align: 'right', lineBreak: false });
            doc.text(numeroTabla(datos.cobrado), right - colVal, totY + 3 + totStep + extra, { width: colVal, align: 'right', lineBreak: false });
        }
        if (datos.pendiente != null) {
            extra += totStep;
            doc.font('Helvetica').fontSize(meta);
            doc.text('SALDO', right - colLbl - colVal, totY + 3 + totStep + extra, { width: colLbl, align: 'right', lineBreak: false });
            doc.text(numeroTabla(datos.pendiente), right - colVal, totY + 3 + totStep + extra, { width: colVal, align: 'right', lineBreak: false });
        }
        doc.font('Helvetica').fontSize(meta);
        doc.text(montoALetrasBs(datos.total), left, totY + 3 + totStep, {
            width: width - colLbl - colVal - 6
        });
        doc.font('Helvetica-Bold');
        doc.text(`DETALLE: ${datos.detalle || ''}`, left, totY + 3 + totStep * 2, {
            width: width - colLbl - colVal - 6,
            lineBreak: false
        });

        const totalesEnd = totY + altoTotales;
        const firmaLineY = totalesEnd + firmaEspacio;
        const firmaW = width / 4;
        const etiquetas = ['VENDEDOR(a)', 'Pagado por', 'Recibido Por', 'CLIENTE'];
        doc.strokeColor('#000000').lineWidth(0.6).font('Helvetica').fontSize(meta).fillColor('#000000');
        etiquetas.forEach((label, i) => {
            const fx = left + i * firmaW;
            doc.moveTo(fx + 6, firmaLineY).lineTo(fx + firmaW - 6, firmaLineY).stroke();
            doc.text(label, fx, firmaLineY + 3, { width: firmaW, align: 'center', lineBreak: false });
        });
        doc.font('Helvetica').fontSize(6.5);
        doc.text(
            `Hora de registro: ${fmtFechaHora(datos.fecha)} - Guardado por: ${datos.vendedor.toUpperCase()}`,
            left,
            Math.min(firmaLineY + 12, limiteY - 7),
            { width, lineBreak: false }
        );
    };

    const usable = detalleH - headerH;
    const paginas: { desde: number; hasta: number }[] = [];
    let i = 0;
    if (!lineas.length) {
        paginas.push({ desde: 0, hasta: 0 });
    }
    while (i < lineas.length) {
        let usado = 0;
        const desde = i;
        while (i < lineas.length) {
            const h = altos[i];
            if (usado > 0 && usado + h > usable) {
                break;
            }
            if (h > usable && usado === 0) {
                i += 1;
                break;
            }
            usado += h;
            i += 1;
        }
        paginas.push({ desde, hasta: i });
    }

    const totalPaginas = paginas.length;
    paginas.forEach((pag, idx) => {
        if (idx > 0) {
            doc.addPage({ size: 'LETTER', layout: 'portrait', margin: 0 });
        }
        const esUltima = idx === totalPaginas - 1;
        doc.save();
        doc.rect(0, 0, papel.width, limiteY).clip();
        const afterId = pintarIdentificacion(idx + 1, totalPaginas, idx > 0);
        const tableTop = afterId + gapDirTabla;
        const tableH = detalleH;
        marcoTabla(tableTop, tableH);
        pintarFilas(tableTop, pag.desde, pag.hasta);
        pintarPie(tableTop + tableH, !esUltima);
        doc.restore();
        doc.y = limiteY;
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
