import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
    Acopio,
    Caja,
    CategoriaProducto,
    Cliente,
    Compra,
    CompraDetalle,
    Gasto,
    MovimientoCaja,
    PagoProveedor,
    Productos,
    Proveedor,
    User,
    Venta,
    VentaDetalle,
    Cobranza
} from '../models';
import { handleError } from '../utils/error.handler';
import { clasificarDiferencia, formatBs, roundMoney, toMoney } from '../utils/money';
import { enviarExcel, enviarPdf, HojaExport } from '../utils/exportar';
import { DatosVoucher, enviarVoucherPdf, LineaVoucher } from '../utils/pdf-voucher';
import { ESTADO_CAJA, TIPO_MOVIMIENTO } from '../constants/caja.constants';

function rango(req: Request) {
    const desde = typeof req.query.fecha_desde === 'string' && req.query.fecha_desde
        ? new Date(`${req.query.fecha_desde}T00:00:00`)
        : (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
    const hasta = typeof req.query.fecha_hasta === 'string' && req.query.fecha_hasta
        ? new Date(`${req.query.fecha_hasta}T23:59:59`)
        : new Date();
    return { desde, hasta };
}

function ymd(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function fmtFecha(valor: Date | string | null | undefined): string {
    if (!valor) {
        return '-';
    }
    const date = typeof valor === 'string' ? new Date(valor) : valor;
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function etiquetaCategoria(categoria: string): string {
    const map: Record<string, string> = {
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        OTRO_INGRESO: 'Otro ingreso',
        ANULACION_VENTA: 'Anulación de venta',
        PAGO_PROVEEDOR: 'Pago a proveedor',
        GASTO_EMPRESA: 'Gasto de empresa',
        RETIRO_PERSONAL: 'Retiro personal',
        OTRO_EGRESO: 'Otro egreso'
    };
    return map[categoria] || categoria;
}

function etiquetaMetodo(metodo: string): string {
    const map: Record<string, string> = {
        EFECTIVO: 'Efectivo',
        QR: 'QR',
        TRANSFERENCIA: 'Transferencia',
        OTRO: 'Otro'
    };
    return map[metodo] || metodo || '-';
}

function etiquetaOrigen(origen: string): string {
    const map: Record<string, string> = {
        MANUAL: 'Manual',
        VENTA: 'Venta',
        COBRANZA: 'Cobranza',
        COMPRA: 'Compra',
        GASTO: 'Gasto / retiro',
        PAGO_PROVEEDOR: 'Pago a proveedor'
    };
    return map[origen] || origen || '-';
}

function periodoTexto(desde: Date, hasta: Date): string {
    return `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}`;
}

export class ReporteController {
    public static async resumen(req: Request, res: Response): Promise<void> {
        try {
            const data = await ReporteController.datosResumen(req);
            res.status(200).json({
                fecha_desde: data.desde,
                fecha_hasta: data.hasta,
                ventas: data.ventas,
                compras: data.compras,
                gastos: data.gastos,
                retiros: data.retiros,
                acopios: data.acopios,
                caja: data.caja
            });
        } catch (error) {
            handleError(res, error, 'Error al generar el reporte');
        }
    }

    public static async exportar(req: Request, res: Response): Promise<void> {
        try {
            const formato = req.query.formato === 'xlsx' ? 'xlsx' : 'pdf';
            const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : 'resumen';
            const { desde, hasta } = rango(req);
            if (formato === 'pdf' && tipo === 'venta') {
                const voucher = await ReporteController.datosNotaVenta(req);
                if (!voucher) {
                    res.status(404).json({ mensaje: 'No hay datos para exportar' });
                    return;
                }
                enviarVoucherPdf(res, `nota-venta-${voucher.numero}`, voucher);
                return;
            }
            if (formato === 'pdf' && tipo === 'compra') {
                const voucher = await ReporteController.datosNotaCompra(req);
                if (!voucher) {
                    res.status(404).json({ mensaje: 'No hay datos para exportar' });
                    return;
                }
                enviarVoucherPdf(res, `nota-compra-${voucher.numero}`, voucher);
                return;
            }
            const hojas = await ReporteController.construirHojas(tipo, req, desde, hasta);
            if (!hojas.length) {
                res.status(404).json({ mensaje: 'No hay datos para exportar' });
                return;
            }
            const base = `ingenio-${tipo}-${ymd(desde)}`;
            if (formato === 'xlsx') {
                await enviarExcel(res, base, hojas);
            } else {
                enviarPdf(res, base, hojas);
            }
        } catch (error) {
            handleError(res, error, 'Error al exportar el reporte');
        }
    }

    private static async construirHojas(tipo: string, req: Request, desde: Date, hasta: Date): Promise<HojaExport[]> {
        if (tipo === 'venta') {
            return ReporteController.hojaVenta(req);
        }
        if (tipo === 'compra') {
            return ReporteController.hojaCompra(req);
        }
        if (tipo === 'caja') {
            return ReporteController.hojaCaja(req);
        }
        if (tipo === 'movimientos') {
            return [await ReporteController.hojaMovimientos(desde, hasta)];
        }
        if (tipo === 'ventas') {
            return [await ReporteController.hojaVentas(req, desde, hasta)];
        }
        if (tipo === 'egresos') {
            return [await ReporteController.hojaEgresos(req, desde, hasta)];
        }
        if (tipo === 'compras') {
            return [await ReporteController.hojaCompras(req, desde, hasta)];
        }
        if (tipo === 'cobranzas') {
            return [await ReporteController.hojaCobranzas(desde, hasta)];
        }
        if (tipo === 'pagos') {
            return [await ReporteController.hojaPagos(desde, hasta)];
        }
        if (tipo === 'inventario') {
            return [await ReporteController.hojaInventario()];
        }
        const resumen = await ReporteController.datosResumen(req);
        const hojaResumen: HojaExport = {
            nombre: 'Resumen',
            titulo: 'Resumen operativo',
            subtitulo: periodoTexto(desde, hasta),
            columnas: ['Indicador', 'Valor'],
            filas: [
                ['Ventas (cantidad)', resumen.ventas.cantidad],
                ['Ventas (total)', resumen.ventas.total],
                ['Cobrado', resumen.ventas.cobrado],
                ['Por cobrar', resumen.ventas.por_cobrar],
                ['Gastos de empresa', resumen.gastos],
                ['Retiros personales', resumen.retiros],
                ['Caja ingresos', resumen.caja.ingresos],
                ['Caja egresos', resumen.caja.egresos],
                ['Compras', resumen.compras.total],
                ['Por pagar', resumen.compras.por_pagar]
            ]
        };
        return [
            hojaResumen,
            await ReporteController.hojaMovimientos(desde, hasta),
            await ReporteController.hojaVentas(req, desde, hasta),
            await ReporteController.hojaCompras(req, desde, hasta),
            await ReporteController.hojaEgresos(req, desde, hasta)
        ];
    }

    private static async datosResumen(req: Request) {
        const { desde, hasta } = rango(req);
        const filtro = { fecha: { [Op.between]: [desde, hasta] } };
        const [ventas, compras, gastos, acopios, movimientos] = await Promise.all([
            Venta.findAll({ where: filtro }),
            Compra.findAll({ where: filtro }),
            Gasto.findAll({ where: filtro }),
            Acopio.findAll({ where: filtro }),
            MovimientoCaja.findAll({ where: filtro })
        ]);
        const totalVentas = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('total')), 0));
        const cobrado = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('total')) - toMoney(v.get('saldo_pendiente')), 0));
        const porCobrar = roundMoney(ventas.reduce((acc, v) => acc + toMoney(v.get('saldo_pendiente')), 0));
        const totalCompras = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('total')), 0));
        const porPagar = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('saldo_pendiente')), 0));
        const totalGastos = roundMoney(gastos.filter((g) => g.get('tipo') === 'GASTO_EMPRESA').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
        const totalRetiros = roundMoney(gastos.filter((g) => g.get('tipo') === 'RETIRO_PERSONAL').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
        const totalAcopio = roundMoney(acopios.reduce((acc, a) => acc + toMoney(a.get('total')), 0));
        let ingresosCaja = 0;
        let egresosCaja = 0;
        for (const m of movimientos) {
            const monto = toMoney(m.get('monto'));
            if (m.get('tipo') === TIPO_MOVIMIENTO.INGRESO) ingresosCaja += monto;
            else egresosCaja += monto;
        }
        return {
            desde,
            hasta,
            ventas: { cantidad: ventas.length, total: totalVentas, cobrado, por_cobrar: porCobrar },
            compras: { cantidad: compras.length, total: totalCompras, por_pagar: porPagar },
            gastos: totalGastos,
            retiros: totalRetiros,
            acopios: { cantidad: acopios.length, total: totalAcopio },
            caja: { ingresos: roundMoney(ingresosCaja), egresos: roundMoney(egresosCaja) }
        };
    }

    private static async hojaMovimientos(desde: Date, hasta: Date): Promise<HojaExport> {
        const movimientos = await MovimientoCaja.findAll({
            where: { fecha: { [Op.between]: [desde, hasta] } },
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
            order: [['fecha', 'ASC'], ['id', 'ASC']],
            limit: 2000
        });
        let ingresos = 0;
        let egresos = 0;
        const filas = movimientos.map((item: any) => {
            const monto = toMoney(item.monto);
            if (item.tipo === TIPO_MOVIMIENTO.INGRESO) ingresos += monto;
            else egresos += monto;
            return [
                fmtFecha(item.fecha),
                item.tipo,
                etiquetaOrigen(item.origen),
                etiquetaCategoria(item.categoria),
                item.concepto || '',
                etiquetaMetodo(item.metodo_pago),
                item.tipo === TIPO_MOVIMIENTO.INGRESO ? monto : 0,
                item.tipo === TIPO_MOVIMIENTO.EGRESO ? monto : 0,
                item.usuario?.username || '-'
            ];
        });
        return {
            nombre: 'Movimientos',
            titulo: 'Ingresos y egresos',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Ingresos', valor: roundMoney(ingresos) },
                { label: 'Egresos', valor: roundMoney(egresos) },
                { label: 'Saldo neto', valor: roundMoney(ingresos - egresos) }
            ],
            columnas: ['Fecha', 'Tipo', 'Origen', 'Categoría', 'Concepto', 'Método', 'Ingreso', 'Egreso', 'Usuario'],
            filas
        };
    }

    private static async hojaVentas(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = { fecha: { [Op.between]: [desde, hasta] } };
        if (typeof req.query.estado === 'string' && req.query.estado) {
            where.estado = req.query.estado;
        }
        if (typeof req.query.id_cliente === 'string' && req.query.id_cliente) {
            where.id_cliente = Number(req.query.id_cliente);
        }
        const ventas = await Venta.findAll({
            where,
            include: [{ model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] }],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = ventas.map((v: any) => {
            const total = toMoney(v.total);
            const pendiente = toMoney(v.saldo_pendiente);
            return [
                v.id,
                fmtFecha(v.fecha),
                v.cliente?.nombre || '-',
                total,
                roundMoney(total - pendiente),
                pendiente,
                v.estado
            ];
        });
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[3]), 0));
        const cobrado = roundMoney(filas.reduce((acc, f) => acc + Number(f[4]), 0));
        return {
            nombre: 'Ventas',
            titulo: 'Ventas',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(ventas.length) },
                { label: 'Total', valor: total },
                { label: 'Cobrado', valor: cobrado }
            ],
            columnas: ['Nro', 'Fecha', 'Cliente', 'Total', 'Cobrado', 'Pendiente', 'Estado'],
            filas
        };
    }

    private static async hojaEgresos(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = { fecha: { [Op.between]: [desde, hasta] } };
        if (typeof req.query.tipo_gasto === 'string' && req.query.tipo_gasto) {
            where.tipo = req.query.tipo_gasto;
        }
        const gastos = await Gasto.findAll({
            where,
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = gastos.map((g: any) => [
            fmtFecha(g.fecha),
            g.tipo === 'RETIRO_PERSONAL' ? 'Personal' : 'Empresa',
            g.categoria || '-',
            g.concepto || '',
            toMoney(g.monto),
            g.descontar_caja && g.id_caja ? 'Sí' : 'No',
            etiquetaMetodo(g.metodo_pago),
            g.usuario?.username || '-'
        ]);
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[4]), 0));
        return {
            nombre: 'Egresos',
            titulo: 'Gastos y retiros',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [{ label: 'Total', valor: total }],
            columnas: ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Monto', 'Descontó caja', 'Método', 'Usuario'],
            filas
        };
    }

    private static async hojaCaja(req: Request): Promise<HojaExport[]> {
        let caja = null;
        if (typeof req.query.id_caja === 'string' && req.query.id_caja) {
            caja = await Caja.findByPk(Number(req.query.id_caja), {
                include: [
                    { model: User, as: 'usuarioApertura', attributes: ['id', 'username'] },
                    { model: User, as: 'usuarioCierre', attributes: ['id', 'username'] }
                ]
            });
        } else {
            caja = await Caja.findOne({
                where: { estado: ESTADO_CAJA.ABIERTA },
                include: [
                    { model: User, as: 'usuarioApertura', attributes: ['id', 'username'] },
                    { model: User, as: 'usuarioCierre', attributes: ['id', 'username'] }
                ],
                order: [['id', 'DESC']]
            });
            if (!caja) {
                caja = await Caja.findOne({
                    include: [
                        { model: User, as: 'usuarioApertura', attributes: ['id', 'username'] },
                        { model: User, as: 'usuarioCierre', attributes: ['id', 'username'] }
                    ],
                    order: [['id', 'DESC']]
                });
            }
        }
        if (!caja) {
            return [];
        }
        const movimientos = await MovimientoCaja.findAll({
            where: { id_caja: caja.get('id') },
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username'] }],
            order: [['fecha', 'ASC'], ['id', 'ASC']]
        });
        let ingresos = 0;
        let egresos = 0;
        const filas = movimientos.map((item: any) => {
            const monto = toMoney(item.monto);
            if (item.tipo === TIPO_MOVIMIENTO.INGRESO) ingresos += monto;
            else egresos += monto;
            return [
                fmtFecha(item.fecha),
                item.tipo,
                etiquetaCategoria(item.categoria),
                item.concepto || '',
                etiquetaMetodo(item.metodo_pago),
                monto,
                item.usuario?.username || '-'
            ];
        });
        const saldoInicial = toMoney(caja.get('saldo_inicial'));
        const saldoEsperado = roundMoney(saldoInicial + ingresos - egresos);
        const saldoContado = caja.get('saldo_contado') != null ? toMoney(caja.get('saldo_contado')) : null;
        const diferencia = caja.get('diferencia') != null
            ? toMoney(caja.get('diferencia'))
            : (saldoContado != null ? roundMoney(saldoContado - saldoEsperado) : null);
        return [{
            nombre: 'Caja',
            titulo: `Caja #${caja.get('id')} — ${caja.get('estado')}`,
            subtitulo: `Apertura ${fmtFecha(caja.get('fecha_apertura') as Date)} · Cierre ${fmtFecha(caja.get('fecha_cierre') as Date | null)}`,
            resumen: [
                { label: 'Saldo inicial', valor: saldoInicial },
                { label: 'Ingresos', valor: roundMoney(ingresos) },
                { label: 'Egresos', valor: roundMoney(egresos) },
                { label: 'Saldo esperado', valor: saldoEsperado },
                { label: 'Saldo contado', valor: saldoContado == null ? '-' : formatBs(saldoContado) },
                { label: 'Diferencia', valor: diferencia == null ? '-' : formatBs(diferencia) },
                { label: 'Arqueo', valor: diferencia == null ? '-' : clasificarDiferencia(diferencia) },
                { label: 'Usuario apertura', valor: (caja as any).usuarioApertura?.username || '-' }
            ],
            columnas: ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Método', 'Monto', 'Usuario'],
            filas
        }];
    }

    private static async hojaVenta(req: Request): Promise<HojaExport[]> {
        const id = Number(req.query.id);
        if (!id) {
            return [];
        }
        const venta: any = await Venta.findByPk(id, {
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'nit_ci', 'direccion', 'telefono'] },
                { model: VentaDetalle, as: 'detalles' },
                { model: Cobranza, as: 'cobranzas' },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ]
        });
        if (!venta) {
            return [];
        }
        const total = toMoney(venta.total);
        const pendiente = toMoney(venta.saldo_pendiente);
        const cobrado = roundMoney(total - pendiente);
        const filas = (venta.detalles || []).map((linea: any) => [
            linea.descripcion || '',
            Number(linea.cantidad),
            toMoney(linea.precio_unitario),
            toMoney(linea.subtotal)
        ]);
        const cobros = (venta.cobranzas || []).map((c: any) => [
            fmtFecha(c.fecha),
            toMoney(c.monto),
            etiquetaMetodo(c.metodo_pago),
            c.referencia || '-'
        ]);
        const hojas: HojaExport[] = [{
            nombre: 'Venta',
            titulo: `Comprobante de venta #${venta.id}`,
            subtitulo: `${venta.cliente?.nombre || 'Cliente'} · ${fmtFecha(venta.fecha)} · ${venta.estado}`,
            resumen: [
                { label: 'NIT/CI', valor: venta.cliente?.nit_ci || '-' },
                { label: 'Total', valor: total },
                { label: 'Cobrado', valor: cobrado },
                { label: 'Pendiente', valor: pendiente },
                { label: 'Usuario', valor: venta.usuario?.username || '-' }
            ],
            columnas: ['Descripción', 'Cantidad', 'P. unitario', 'Subtotal'],
            filas
        }];
        if (cobros.length) {
            hojas.push({
                nombre: 'Cobranzas',
                titulo: `Cobranzas de la venta #${venta.id}`,
                columnas: ['Fecha', 'Monto', 'Método', 'Referencia'],
                filas: cobros
            });
        }
        return hojas;
    }

    private static async hojaCompras(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = { fecha: { [Op.between]: [desde, hasta] } };
        if (typeof req.query.estado === 'string' && req.query.estado) {
            where.estado = req.query.estado;
        }
        const compras = await Compra.findAll({
            where,
            include: [{ model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] }],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = compras.map((c: any) => {
            const total = toMoney(c.total);
            const pendiente = toMoney(c.saldo_pendiente);
            return [
                c.id,
                fmtFecha(c.fecha),
                c.proveedor?.nombre || '-',
                total,
                roundMoney(total - pendiente),
                pendiente,
                c.estado
            ];
        });
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[3]), 0));
        const porPagar = roundMoney(filas.reduce((acc, f) => acc + Number(f[5]), 0));
        return {
            nombre: 'Compras',
            titulo: 'Compras',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(compras.length) },
                { label: 'Total', valor: total },
                { label: 'Por pagar', valor: porPagar }
            ],
            columnas: ['Nro', 'Fecha', 'Proveedor', 'Total', 'Pagado', 'Pendiente', 'Estado'],
            filas
        };
    }

    private static async hojaCompra(req: Request): Promise<HojaExport[]> {
        const id = Number(req.query.id);
        if (!id) {
            return [];
        }
        const compra: any = await Compra.findByPk(id, {
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre', 'nit_ci', 'direccion'] },
                { model: CompraDetalle, as: 'detalles' },
                { model: PagoProveedor, as: 'pagos' },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ]
        });
        if (!compra) {
            return [];
        }
        const total = toMoney(compra.total);
        const pendiente = toMoney(compra.saldo_pendiente);
        const filas = (compra.detalles || []).map((linea: any) => [
            linea.descripcion || '',
            Number(linea.cantidad),
            toMoney(linea.precio_unitario),
            toMoney(linea.subtotal)
        ]);
        const hojas: HojaExport[] = [{
            nombre: 'Compra',
            titulo: `Comprobante de compra #${compra.id}`,
            subtitulo: `${compra.proveedor?.nombre || 'Proveedor'} · ${fmtFecha(compra.fecha)} · ${compra.estado}`,
            resumen: [
                { label: 'Total', valor: total },
                { label: 'Pagado', valor: roundMoney(total - pendiente) },
                { label: 'Pendiente', valor: pendiente },
                { label: 'Usuario', valor: compra.usuario?.username || '-' }
            ],
            columnas: ['Descripción', 'Cantidad', 'P. unitario', 'Subtotal'],
            filas
        }];
        const pagos = (compra.pagos || []).map((p: any) => [
            fmtFecha(p.fecha),
            toMoney(p.monto),
            etiquetaMetodo(p.metodo_pago),
            p.referencia || '-'
        ]);
        if (pagos.length) {
            hojas.push({
                nombre: 'Pagos',
                titulo: `Pagos de la compra #${compra.id}`,
                columnas: ['Fecha', 'Monto', 'Método', 'Referencia'],
                filas: pagos
            });
        }
        return hojas;
    }

    private static async hojaCobranzas(desde: Date, hasta: Date): Promise<HojaExport> {
        const cobranzas = await Cobranza.findAll({
            where: { fecha: { [Op.between]: [desde, hasta] } },
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = cobranzas.map((c: any) => [
            fmtFecha(c.fecha),
            c.id_venta,
            c.cliente?.nombre || '-',
            toMoney(c.monto),
            etiquetaMetodo(c.metodo_pago),
            c.referencia || '-',
            c.usuario?.username || '-'
        ]);
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[3]), 0));
        return {
            nombre: 'Cobranzas',
            titulo: 'Cobranzas',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(cobranzas.length) },
                { label: 'Total cobrado', valor: total }
            ],
            columnas: ['Fecha', 'Venta', 'Cliente', 'Monto', 'Método', 'Referencia', 'Usuario'],
            filas
        };
    }

    private static async hojaPagos(desde: Date, hasta: Date): Promise<HojaExport> {
        const pagos = await PagoProveedor.findAll({
            where: { fecha: { [Op.between]: [desde, hasta] } },
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = pagos.map((p: any) => [
            fmtFecha(p.fecha),
            p.id_compra,
            p.proveedor?.nombre || '-',
            toMoney(p.monto),
            etiquetaMetodo(p.metodo_pago),
            p.referencia || '-',
            p.usuario?.username || '-'
        ]);
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[3]), 0));
        return {
            nombre: 'Pagos',
            titulo: 'Pagos a proveedores',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(pagos.length) },
                { label: 'Total pagado', valor: total }
            ],
            columnas: ['Fecha', 'Compra', 'Proveedor', 'Monto', 'Método', 'Referencia', 'Usuario'],
            filas
        };
    }

    private static async hojaInventario(): Promise<HojaExport> {
        const productos = await Productos.findAll({
            where: { eliminado: false },
            include: [{ model: CategoriaProducto, as: 'categoria', attributes: ['id', 'nombre'] }],
            order: [['nombre', 'ASC']],
            limit: 2000
        });
        const filas = productos.map((p: any) => {
            const stock = Number(p.stock);
            const minimo = Number(p.stock_minimo);
            return [
                p.nombre,
                p.categoria?.nombre || '-',
                p.unidad_medida || '-',
                stock,
                minimo,
                toMoney(p.precio_venta),
                toMoney(p.precio_compra),
                stock <= minimo ? 'Bajo mínimo' : 'OK'
            ];
        });
        return {
            nombre: 'Inventario',
            titulo: 'Inventario de productos',
            subtitulo: `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Productos', valor: String(productos.length) }],
            columnas: ['Producto', 'Categoría', 'Unidad', 'Stock', 'Mínimo', 'P. venta', 'P. compra', 'Estado'],
            filas
        };
    }

    private static codigoLinea(linea: any): string {
        if (linea.id_producto) {
            return `PR-${String(linea.id_producto).padStart(5, '0')}`;
        }
        return '-';
    }

    private static lineasVoucher(detalles: any[]): LineaVoucher[] {
        return (detalles || []).map((linea) => ({
            codigo: ReporteController.codigoLinea(linea),
            cantidad: Number(linea.cantidad),
            descripcion: linea.descripcion || '',
            precio: toMoney(linea.precio_unitario),
            importe: toMoney(linea.subtotal)
        }));
    }

    private static tipoPagoPorSaldo(_total: number, pendiente: number): string {
        return pendiente > 0 ? 'Credito' : 'Contado';
    }

    private static async datosNotaVenta(req: Request): Promise<DatosVoucher | null> {
        const id = Number(req.query.id);
        if (!id) {
            return null;
        }
        const venta: any = await Venta.findByPk(id, {
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'nit_ci', 'direccion'] },
                { model: VentaDetalle, as: 'detalles' },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ]
        });
        if (!venta) {
            return null;
        }
        const total = toMoney(venta.total);
        const pendiente = toMoney(venta.saldo_pendiente);
        const fecha = venta.fecha instanceof Date ? venta.fecha : new Date(venta.fecha);
        return {
            tipoDocumento: 'NOTA DE VENTA',
            numero: venta.id,
            fecha,
            contraparteLabel: 'CLIENTE',
            contraparteNombre: venta.cliente?.nombre || 'Cliente',
            nitCi: venta.cliente?.nit_ci || '0',
            codigoContraparte: venta.cliente?.id != null ? String(venta.cliente.id).padStart(6, '0') : '-',
            direccion: venta.cliente?.direccion || '',
            vendedor: venta.usuario?.username || '-',
            tipoPago: ReporteController.tipoPagoPorSaldo(total, pendiente),
            detalle: 'VENTA',
            lineas: ReporteController.lineasVoucher(venta.detalles),
            total,
            cobrado: roundMoney(total - pendiente),
            pendiente
        };
    }

    private static async datosNotaCompra(req: Request): Promise<DatosVoucher | null> {
        const id = Number(req.query.id);
        if (!id) {
            return null;
        }
        const compra: any = await Compra.findByPk(id, {
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre', 'nit_ci', 'direccion'] },
                { model: CompraDetalle, as: 'detalles' },
                { model: User, as: 'usuario', attributes: ['id', 'username'] }
            ]
        });
        if (!compra) {
            return null;
        }
        const total = toMoney(compra.total);
        const pendiente = toMoney(compra.saldo_pendiente);
        const fecha = compra.fecha instanceof Date ? compra.fecha : new Date(compra.fecha);
        return {
            tipoDocumento: 'NOTA DE COMPRA',
            numero: compra.id,
            fecha,
            contraparteLabel: 'PROVEEDOR',
            contraparteNombre: compra.proveedor?.nombre || 'Proveedor',
            nitCi: compra.proveedor?.nit_ci || '0',
            codigoContraparte: compra.proveedor?.id != null ? String(compra.proveedor.id).padStart(6, '0') : '-',
            direccion: compra.proveedor?.direccion || '',
            vendedor: compra.usuario?.username || '-',
            tipoPago: ReporteController.tipoPagoPorSaldo(total, pendiente),
            detalle: 'COMPRA',
            lineas: ReporteController.lineasVoucher(compra.detalles),
            total,
            cobrado: roundMoney(total - pendiente),
            pendiente
        };
    }
}
