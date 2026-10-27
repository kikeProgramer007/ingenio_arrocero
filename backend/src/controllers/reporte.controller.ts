import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ReservaProducto } from '../models/despacho.model';
import { Acopio, Caja, Campana, CategoriaProducto, Cliente, Compra, CompraDetalle, Gasto, MovimientoCaja, PagoGasto, PagoProveedor, Produccion, Productor, Productos, Proveedor, User, Venta, VentaDetalle, Cobranza } from '../models';
import { handleError } from '../utils/error.handler';
import { clasificarDiferencia, formatBs, formatUsd, roundMoney, toMoney } from '../utils/money';
import { aplicarPlantillaFormal, enviarExcel, enviarPdf, HojaExport } from '../utils/exportar';
import {
    etiquetaCategoriaMovimiento,
    etiquetaDisponibleEn,
    etiquetaEstadoCaja,
    etiquetaEstadoVenta,
    etiquetaMetodoPago,
    etiquetaOrigenMovimiento,
    etiquetaTipoGasto,
    etiquetaTipoMovimiento,
    etiquetaTipoOperacionProveedor
} from '../utils/etiquetas-documento';
import { COLUMNAS_DOCUMENTOS } from '../utils/columnas-documentos';
import { DatosReciboMovimiento, DatosVoucher, enviarReciboMovimientoPdf, enviarVoucherPdf, LineaVoucher } from '../utils/pdf-voucher';
import { ESTADO_CAJA, TIPO_MOVIMIENTO } from '../constants/caja.constants';
import { cobradoVenta, diasAtraso, ESTADO_VENTA, esVentaVencida, saldoVenta, situacionCobranza } from '../constants/venta.constants';
import { hayPeriodoQuery, parseFechaLocal, ymdLocal } from '../utils/fecha';
import { esProductoEmpaque } from '../utils/empaque';
import { resumirMovimientos } from '../utils/caja-resumen';
import { armarCuentaProveedor, esCompraServicio, extraerProductores, filtroCuentaDesdeQuery } from '../utils/cuenta-proveedor';
import { etiquetaTipoCompra, inferirTipoCompra, TIPO_COMPRA } from '../constants/compra.constants';
import { getAuthUser, nombreVisible } from '../utils/auth-user';
import { datosEmpresa, refrescarEmpresa } from '../utils/empresa';
import { aplicarFiltroIn, idsQuery, valoresQuery } from '../utils/query';

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

function fmtFechaDia(valor: Date | string | null | undefined): string {
    if (!valor) {
        return '-';
    }
    const texto = typeof valor === 'string' ? valor.slice(0, 10) : ymd(valor);
    const date = parseFechaLocal(texto);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }
    return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function etiquetaMetodoDocumento(item: { metodo_pago?: string; monto_efectivo?: unknown; monto_qr?: unknown }): string {
    if (item.metodo_pago === 'MIXTO') {
        return `Mixto (efectivo ${toMoney(item.monto_efectivo).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + QR ${toMoney(item.monto_qr).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return etiquetaMetodoPago(String(item.metodo_pago || ''));
}

function partesMontos(item: { metodo_pago?: string; monto?: unknown; monto_efectivo?: unknown; monto_qr?: unknown }): { efectivo: number; qr: number } {
    const metodo = String(item.metodo_pago || '').toUpperCase();
    const monto = toMoney(item.monto);
    if (metodo === 'QR') {
        return { efectivo: 0, qr: monto };
    }
    if (metodo === 'MIXTO') {
        return { efectivo: toMoney(item.monto_efectivo), qr: toMoney(item.monto_qr) };
    }
    return { efectivo: monto, qr: 0 };
}

function periodoTexto(desde: Date, hasta: Date): string {
    return `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}`;
}

/** Busca en las columnas textuales del documento. Misma idea que el buscador del reporte. */
function coincideBusquedaCxC(doc: {
    id: number;
    fecha: Date | string | null;
    cliente: { nombre: string } | null;
    total: number;
    cobrado: number;
    saldo: number;
    fecha_vencimiento: string | null;
    dias_atraso: number | null;
    estado: string;
    situacion: string;
    vencida: boolean;
}, q: unknown): boolean {
    if (typeof q !== 'string' || !q.trim()) {
        return true;
    }
    const texto = [
        doc.id,
        `#${doc.id}`,
        doc.cliente?.nombre,
        doc.estado,
        doc.situacion,
        doc.vencida ? 'VENCIDA' : '',
        fmtFechaDia(doc.fecha),
        doc.fecha_vencimiento ? fmtFechaDia(doc.fecha_vencimiento) : 'Sin plazo',
        doc.dias_atraso == null ? '-' : doc.dias_atraso,
        doc.total,
        doc.cobrado,
        doc.saldo,
        formatBs(doc.total),
        formatBs(doc.cobrado),
        formatBs(doc.saldo)
    ].join(' ').toLowerCase();
    return texto.includes(q.trim().toLowerCase());
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
                caja: data.caja
            });
        } catch (error) {
            handleError(res, error, 'Error al generar el reporte');
        }
    }

    /** Consulta de documentos a crédito. Lee saldos de ventas; no crea ni modifica nada. */
    public static async cuentasPorCobrar(req: Request, res: Response): Promise<void> {
        try {
            res.status(200).json(await ReporteController.datosCuentasPorCobrar(req));
        } catch (error) {
            handleError(res, error, 'Error al generar cuentas por cobrar');
        }
    }

    /** Saldo por proveedor a la fecha de corte, y el detalle de uno si se indica. */
    public static async cuentasPorPagar(req: Request, res: Response): Promise<void> {
        try {
            const consolidado = await ReporteController.consolidadoPorPagar(req);
            const id = Number(req.query.id_proveedor || 0);
            const detalle = id ? await ReporteController.detalleCuentaProveedor(id, req) : null;
            res.status(200).json({ ...consolidado, detalle });
        } catch (error) {
            handleError(res, error, 'Error al generar cuentas por pagar');
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
            if (formato === 'pdf' && (tipo === 'pago' || tipo === 'cobranza' || tipo === 'movimiento' || tipo === 'gasto')) {
                const recibo = tipo === 'cobranza'
                    ? await ReporteController.datosReciboCobranza(req)
                    : tipo === 'movimiento'
                        ? await ReporteController.datosReciboMovimiento(req)
                        : tipo === 'gasto'
                            ? await ReporteController.datosReciboGasto(req)
                            : await ReporteController.datosReciboPago(req);
                if (!recibo) {
                    res.status(404).json({ mensaje: 'No hay datos para exportar' });
                    return;
                }
                const base = `${recibo.serie.toLowerCase()}-${recibo.numero}`;
                enviarReciboMovimientoPdf(res, base, recibo);
                return;
            }
            await refrescarEmpresa();
            const hojas = await ReporteController.construirHojas(tipo, req, desde, hasta);
            if (!hojas.length) {
                res.status(404).json({ mensaje: 'No hay datos para exportar' });
                return;
            }
            const auth = getAuthUser(req);
            const registro = auth ? await User.findByPk(auth.id, { attributes: ['id', 'username', 'nombre'] }) : null;
            const plano = registro ? (registro.get({ plain: true }) as { nombre?: string | null; username?: string | null }) : null;
            const usuario = nombreVisible(plano, auth ? { username: auth.username } : null);
            if (usuario && usuario !== '-') {
                for (const hoja of hojas) {
                    if (!hoja.usuario) {
                        hoja.usuario = usuario;
                    }
                }
            }
            if (tipo !== 'venta' && tipo !== 'compra') {
                const consulta = ReporteController.consultaFiltros(req, desde, hasta);
                for (const hoja of hojas) {
                    aplicarPlantillaFormal(hoja, consulta);
                }
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
        if (tipo === 'pago') {
            return ReporteController.hojaPago(req);
        }
        if (tipo === 'caja') {
            return ReporteController.hojaCaja(req);
        }
        if (tipo === 'movimientos') {
            return [await ReporteController.hojaMovimientos(req, desde, hasta)];
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
            return [await ReporteController.hojaCobranzas(req, desde, hasta)];
        }
        if (tipo === 'pagos') {
            return [await ReporteController.hojaPagos(req, desde, hasta)];
        }
        if (tipo === 'inventario') {
            return [await ReporteController.hojaInventario(req)];
        }
        if (tipo === 'clientes') {
            return [await ReporteController.hojaClientes(req)];
        }
        if (tipo === 'proveedores') {
            return [await ReporteController.hojaProveedores(req)];
        }
        if (tipo === 'empaques') {
            return [await ReporteController.hojaEmpaques(req)];
        }
        if (tipo === 'produccion') {
            return [await ReporteController.hojaProduccion(req, desde, hasta)];
        }
        if (tipo === 'campanas') {
            return [await ReporteController.hojaCampanas(req, desde, hasta)];
        }
        if (tipo === 'cajas') {
            return [await ReporteController.hojaCajas(req, desde, hasta)];
        }
        if (tipo === 'cuenta_proveedor') {
            return ReporteController.hojasCuentaProveedor(req);
        }
        if (tipo === 'cuentas_por_pagar') {
            return [await ReporteController.hojaCuentasPorPagar(req)];
        }
        if (tipo === 'cuentas_por_cobrar') {
            return [ReporteController.hojaCuentasPorCobrar(await ReporteController.datosCuentasPorCobrar(req))];
        }
        const resumen = await ReporteController.datosResumen(req);
        const hojaResumen: HojaExport = {
            nombre: 'Resumen',
            titulo: 'Resumen operativo',
            subtitulo: periodoTexto(desde, hasta),
            columnas: COLUMNAS_DOCUMENTOS.resumen,
            filas: [
                ['Ventas vigentes (cantidad)', resumen.ventas.cantidad],
                ['Ventas vigentes (total)', resumen.ventas.total],
                ['Cobrado neto a clientes', resumen.caja.cobrado_neto],
                ['Cobros brutos', resumen.caja.cobros_clientes],
                ['Anulaciones / devoluciones', resumen.caja.anulaciones_venta],
                ['Por cobrar (documentos del período)', resumen.ventas.por_cobrar],
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
            await ReporteController.hojaMovimientos(req, desde, hasta),
            await ReporteController.hojaVentas(req, desde, hasta),
            await ReporteController.hojaCompras(req, desde, hasta),
            await ReporteController.hojaEgresos(req, desde, hasta)
        ];
    }

    private static async datosResumen(req: Request) {
        const { desde, hasta } = rango(req);
        const filtro = { fecha: { [Op.between]: [desde, hasta] } };
        const [ventas, compras, gastos, movimientos] = await Promise.all([
            Venta.findAll({ where: filtro }),
            Compra.findAll({ where: filtro }),
            Gasto.findAll({ where: filtro }),
            MovimientoCaja.findAll({ where: filtro })
        ]);
        const vigentes = ventas.filter((v) => v.get('estado') !== ESTADO_VENTA.ANULADA);
        const totalVentas = roundMoney(vigentes.reduce((acc, v) => acc + toMoney(v.get('total')), 0));
        const cobradoDocumentos = roundMoney(
            vigentes.reduce((acc, v) => acc + cobradoVenta(v.get('total'), v.get('saldo_pendiente'), String(v.get('estado'))), 0)
        );
        const porCobrar = roundMoney(vigentes.reduce((acc, v) => acc + toMoney(v.get('saldo_pendiente')), 0));
        const totalCompras = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('total')), 0));
        const porPagar = roundMoney(compras.reduce((acc, c) => acc + toMoney(c.get('saldo_pendiente')), 0));
        const totalGastos = roundMoney(gastos.filter((g) => g.get('tipo') === 'GASTO_EMPRESA').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
        const totalRetiros = roundMoney(gastos.filter((g) => g.get('tipo') === 'RETIRO_PERSONAL').reduce((acc, g) => acc + toMoney(g.get('monto')), 0));
        const flujo = resumirMovimientos(movimientos);
        return {
            desde,
            hasta,
            ventas: {
                cantidad: vigentes.length,
                anuladas: ventas.length - vigentes.length,
                total: totalVentas,
                cobrado: cobradoDocumentos,
                por_cobrar: porCobrar
            },
            compras: { cantidad: compras.length, total: totalCompras, por_pagar: porPagar },
            gastos: totalGastos,
            retiros: totalRetiros,
            caja: {
                ingresos: flujo.ingresos,
                egresos: flujo.egresos,
                cobros_clientes: flujo.cobros_clientes,
                anulaciones_venta: flujo.anulaciones_venta,
                cobrado_neto: flujo.cobrado_neto
            }
        };
    }

    private static whereCuentasPorCobrar(req: Request): any {
        const where: any = { estado: { [Op.ne]: ESTADO_VENTA.ANULADA } };
        const filtrosEstado = valoresQuery(req.query, 'estado');
        const todos = !filtrosEstado.length || filtrosEstado.includes('TODAS');
        const filtro = todos
            ? 'TODAS'
            : filtrosEstado.length === 1
                ? filtrosEstado[0]
                : 'CON_SALDO';
        if (!todos) {
            where.estado = { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] };
            where.saldo_pendiente = { [Op.gt]: 0 };
        }
        if (filtro === 'VENCIDAS') {
            where.fecha_vencimiento = { [Op.lt]: ymdLocal() };
        }
        aplicarFiltroIn(where, 'id_cliente', idsQuery(req.query, 'id_cliente'));
        if (typeof req.query.fecha_desde === 'string' && req.query.fecha_desde) {
            const inicio = parseFechaLocal(req.query.fecha_desde);
            if (!Number.isNaN(inicio.getTime())) {
                inicio.setHours(0, 0, 0, 0);
                where.fecha = { ...(where.fecha || {}), [Op.gte]: inicio };
            }
        }
        if (typeof req.query.fecha_hasta === 'string' && req.query.fecha_hasta) {
            const fin = parseFechaLocal(req.query.fecha_hasta);
            if (!Number.isNaN(fin.getTime())) {
                fin.setHours(23, 59, 59, 999);
                where.fecha = { ...(where.fecha || {}), [Op.lte]: fin };
            }
        }
        return { where, filtro };
    }

    private static consultaFiltros(req: Request, desde: Date, hasta: Date): { label: string; valor: string }[] {
        const consulta: { label: string; valor: string }[] = [
            { label: 'Período', valor: `${fmtFechaDia(desde)} - ${fmtFechaDia(hasta)}` }
        ];
        if (typeof req.query.estado === 'string' && req.query.estado) {
            consulta.push({ label: 'Estado', valor: etiquetaEstadoVenta(req.query.estado) });
        }
        if (typeof req.query.tipo_gasto === 'string' && req.query.tipo_gasto) {
            consulta.push({ label: 'Tipo', valor: etiquetaTipoGasto(req.query.tipo_gasto) });
        }
        if (typeof req.query.q === 'string' && req.query.q.trim()) {
            consulta.push({ label: 'Búsqueda', valor: req.query.q.trim() });
        }
        return consulta;
    }


    private static async datosCuentasPorCobrar(req: Request) {
        const { where, filtro } = ReporteController.whereCuentasPorCobrar(req);
        const ventas = await Venta.findAll({
            where,
            include: [{ model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] }],
            order: [['fecha', 'ASC'], ['id', 'ASC']],
            limit: 3000
        });
        const documentos = ventas.map((venta: any) => {
            const total = toMoney(venta.total);
            const saldo = saldoVenta(venta.saldo_pendiente, venta.estado);
            const cobrado = cobradoVenta(total, venta.saldo_pendiente, venta.estado);
            const situacion = situacionCobranza(venta.fecha_vencimiento, saldo, venta.estado);
            const vencida = esVentaVencida(venta.fecha_vencimiento, saldo, venta.estado);
            return {
                id: venta.id,
                fecha: venta.fecha,
                cliente: venta.cliente ? { id: venta.cliente.id, nombre: venta.cliente.nombre } : null,
                total,
                cobrado,
                saldo,
                fecha_vencimiento: venta.fecha_vencimiento || null,
                dias_atraso: diasAtraso(venta.fecha_vencimiento, saldo, venta.estado),
                estado: venta.estado,
                situacion,
                vencida
            };
        }).filter((doc) => {
            if (filtro === 'POR_VENCER') {
                return doc.situacion === 'POR VENCER' || doc.situacion === 'VENCE HOY';
            }
            return true;
        }).filter((doc) => coincideBusquedaCxC(doc, req.query.q));
        const totales = {
            vendido: roundMoney(documentos.reduce((acc, d) => acc + d.total, 0)),
            cobrado: roundMoney(documentos.reduce((acc, d) => acc + d.cobrado, 0)),
            pendiente: roundMoney(documentos.reduce((acc, d) => acc + d.saldo, 0))
        };
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const idCliente = typeof req.query.id_cliente === 'string' && req.query.id_cliente
            ? Number(req.query.id_cliente)
            : null;
        return {
            filtro,
            q,
            id_cliente: idCliente,
            cliente: idCliente
                ? documentos.find((d) => d.cliente?.nombre)?.cliente?.nombre || null
                : null,
            fecha_desde: typeof req.query.fecha_desde === 'string' ? req.query.fecha_desde : null,
            fecha_hasta: typeof req.query.fecha_hasta === 'string' ? req.query.fecha_hasta : null,
            documentos,
            totales
        };
    }

    private static hojaCuentasPorCobrar(data: Awaited<ReturnType<typeof ReporteController.datosCuentasPorCobrar>>): HojaExport {
        const etiquetaFiltro = data.filtro === 'CON_SALDO'
            ? 'Con saldo'
            : data.filtro === 'POR_VENCER'
                ? 'Por vencer'
                : data.filtro === 'VENCIDAS'
                    ? 'Vencidas'
                    : data.filtro === 'TODOS'
                        ? 'Todos'
                        : data.filtro;
        const hayPeriodo = Boolean(data.fecha_desde || data.fecha_hasta);
        const periodoTexto = hayPeriodo
            ? `Período: ${data.fecha_desde ? fmtFechaDia(data.fecha_desde) : 'inicio'} al ${data.fecha_hasta ? fmtFechaDia(data.fecha_hasta) : 'hoy'}`
            : '';
        const filas: (string | number)[][] = data.documentos.map((doc, i) => [
            i + 1,
            fmtFechaDia(doc.fecha),
            doc.id,
            doc.cliente?.nombre || '-',
            doc.total,
            doc.cobrado,
            doc.saldo,
            doc.fecha_vencimiento ? fmtFechaDia(doc.fecha_vencimiento) : 'Sin plazo',
            doc.dias_atraso == null ? '-' : doc.dias_atraso,
            etiquetaEstadoVenta(doc.vencida ? 'VENCIDA' : doc.estado)
        ]);
        const consulta: { label: string; valor: string }[] = [];
        consulta.push({
            label: 'Período',
            valor: hayPeriodo
                ? `${data.fecha_desde ? fmtFechaDia(data.fecha_desde) : 'inicio'} - ${data.fecha_hasta ? fmtFechaDia(data.fecha_hasta) : 'hoy'}`
                : 'todos los documentos'
        });
        consulta.push({ label: 'Cliente', valor: data.cliente || 'Todos' });
        consulta.push({ label: 'Estado', valor: etiquetaFiltro });
        if (data.q) {
            consulta.push({ label: 'Búsqueda', valor: data.q });
        }
        const filtrosTitulo = [
            periodoTexto,
            data.cliente ? `Cliente: ${data.cliente}` : ''
        ].filter(Boolean).join('   ');
        return {
            nombre: 'Cuentas por cobrar',
            titulo: 'Cuentas por cobrar',
            tituloSecundario: 'Por documento de venta',
            subtitulo: filtrosTitulo || undefined,
            plantilla: 'formal',
            mostrarFirma: true,
            consulta,
            columnas: COLUMNAS_DOCUMENTOS.cuentas_por_cobrar,
            filas,
            resumen: [
                { label: 'Total crédito', valor: data.totales.vendido },
                { label: 'Total cobrado', valor: data.totales.cobrado },
                { label: 'Total pendiente', valor: data.totales.pendiente }
            ]
        };
    }

    private static async hojaMovimientos(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = {};
        if (typeof req.query.id_caja === 'string' && req.query.id_caja) {
            where.id_caja = Number(req.query.id_caja);
        }
        aplicarFiltroIn(where, 'tipo', valoresQuery(req.query, 'tipo_movimiento'));
        aplicarFiltroIn(where, 'origen', valoresQuery(req.query, 'origen'));
        aplicarFiltroIn(where, 'metodo_pago', valoresQuery(req.query, 'metodo'));
        if (hayPeriodoQuery(req.query) || !where.id_caja) {
            where.fecha = { [Op.between]: [desde, hasta] };
        }
        const movimientos = await MovimientoCaja.findAll({
            where,
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
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
                etiquetaTipoMovimiento(item.tipo),
                etiquetaOrigenMovimiento(item.origen),
                etiquetaCategoriaMovimiento(item.categoria),
                item.concepto || '',
                etiquetaMetodoPago(item.metodo_pago),
                item.tipo === TIPO_MOVIMIENTO.INGRESO ? monto : 0,
                item.tipo === TIPO_MOVIMIENTO.EGRESO ? monto : 0,
                nombreVisible(item.usuario)
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
            columnas: COLUMNAS_DOCUMENTOS.movimientos,
            filas
        };
    }

    private static async hojaVentas(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = { fecha: { [Op.between]: [desde, hasta] } };
        const estadosVenta = valoresQuery(req.query, 'estado');
        if (estadosVenta.length) {
            const reales = estadosVenta.filter((e) => e !== 'VENCIDA');
            const vencida = estadosVenta.includes('VENCIDA');
            const partes: any[] = [];
            if (reales.length) {
                partes.push({ estado: reales.length === 1 ? reales[0] : { [Op.in]: reales } });
            }
            if (vencida) {
                partes.push({
                    estado: { [Op.in]: [ESTADO_VENTA.PENDIENTE, ESTADO_VENTA.PARCIAL] },
                    saldo_pendiente: { [Op.gt]: 0 },
                    fecha_vencimiento: { [Op.lt]: ymd(new Date()) }
                });
            }
            if (partes.length === 1) {
                Object.assign(where, partes[0]);
            } else if (partes.length > 1) {
                where[Op.or] = partes;
            }
        }
        aplicarFiltroIn(where, 'id_cliente', idsQuery(req.query, 'id_cliente'));
        const ventas = await Venta.findAll({
            where,
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
                { model: Cobranza, as: 'cobranzas', attributes: ['id', 'monto', 'metodo_pago', 'monto_efectivo', 'monto_qr', 'fecha'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = ventas.map((v: any) => {
            const total = toMoney(v.total);
            const estado = String(v.estado);
            const anulada = estado === ESTADO_VENTA.ANULADA;
            const medios = (anulada ? [] : (v.cobranzas || [])).reduce((acc: { efectivo: number; qr: number }, cob: any) => {
                if (new Date(cob.fecha).getTime() > hasta.getTime()) {
                    return acc;
                }
                const parte = partesMontos(cob);
                acc.efectivo = roundMoney(acc.efectivo + parte.efectivo);
                acc.qr = roundMoney(acc.qr + parte.qr);
                return acc;
            }, { efectivo: 0, qr: 0 });
            const cobrado = anulada ? 0 : roundMoney(medios.efectivo + medios.qr);
            const saldo = anulada ? 0 : roundMoney(total - cobrado);
            return [
                v.id,
                fmtFecha(v.fecha),
                v.cliente?.nombre || '-',
                total,
                medios.efectivo,
                medios.qr,
                cobrado,
                saldo,
                fmtFechaDia(v.fecha_vencimiento),
                esVentaVencida(v.fecha_vencimiento, saldo, estado) ? 'Vencida' : etiquetaEstadoVenta(estado)
            ];
        });
        const vigentes = filas.filter((f) => f[9] !== 'Anulada');
        const total = roundMoney(vigentes.reduce((acc, f) => acc + Number(f[3]), 0));
        const cobrado = roundMoney(vigentes.reduce((acc, f) => acc + Number(f[6]), 0));
        const efectivo = roundMoney(vigentes.reduce((acc, f) => acc + Number(f[4]), 0));
        const qr = roundMoney(vigentes.reduce((acc, f) => acc + Number(f[5]), 0));
        return {
            nombre: 'Ventas',
            titulo: 'Ventas',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(vigentes.length) },
                { label: 'Vendido', valor: total },
                { label: 'Cobrado efectivo', valor: efectivo },
                { label: 'Cobrado QR', valor: qr },
                { label: 'Cobrado', valor: cobrado },
                { label: 'Saldo pendiente', valor: roundMoney(vigentes.reduce((acc, f) => acc + Number(f[7]), 0)) }
            ],
            columnas: COLUMNAS_DOCUMENTOS.ventas,
            filas
        };
    }

    private static async hojaEgresos(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = hayPeriodoQuery(req.query) ? { fecha: { [Op.between]: [desde, hasta] } } : {};
        aplicarFiltroIn(where, 'tipo', valoresQuery(req.query, 'tipo_gasto'));
        aplicarFiltroIn(where, 'metodo_pago', valoresQuery(req.query, 'metodo'));
        aplicarFiltroIn(where, 'categoria', valoresQuery(req.query, 'categoria'));
        const gastos = await Gasto.findAll({
            where,
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = gastos.map((g: any) => [
            fmtFecha(g.fecha),
            etiquetaTipoGasto(g.tipo),
            etiquetaCategoriaMovimiento(g.categoria),
            g.concepto || '',
            g.persona || '',
            toMoney(g.monto),
            etiquetaMetodoDocumento(g),
            nombreVisible(g.usuario)
        ]);
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[5]), 0));
        return {
            nombre: 'Egresos',
            titulo: 'Gastos y retiros',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [{ label: 'Total', valor: total }],
            columnas: COLUMNAS_DOCUMENTOS.egresos,
            filas
        };
    }

    private static async hojaCaja(req: Request): Promise<HojaExport[]> {
        let caja = null;
        if (typeof req.query.id_caja === 'string' && req.query.id_caja) {
            caja = await Caja.findByPk(Number(req.query.id_caja), {
                include: [
                    { model: User, as: 'usuarioApertura', attributes: ['id', 'username', 'nombre'] },
                    { model: User, as: 'usuarioCierre', attributes: ['id', 'username', 'nombre'] }
                ]
            });
        } else {
            caja = await Caja.findOne({
                where: { estado: ESTADO_CAJA.ABIERTA, tipo: 'PRINCIPAL' },
                include: [
                    { model: User, as: 'usuarioApertura', attributes: ['id', 'username', 'nombre'] },
                    { model: User, as: 'usuarioCierre', attributes: ['id', 'username', 'nombre'] }
                ],
                order: [['id', 'DESC']]
            });
            if (!caja) {
                caja = await Caja.findOne({
                    include: [
                        { model: User, as: 'usuarioApertura', attributes: ['id', 'username', 'nombre'] },
                        { model: User, as: 'usuarioCierre', attributes: ['id', 'username', 'nombre'] }
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
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
            order: [['fecha', 'ASC'], ['id', 'ASC']]
        });
        const flujo = resumirMovimientos(movimientos);
        const ingresos = flujo.ingresos;
        const egresos = flujo.egresos;
        const filas = movimientos.map((item: any) => {
            const monto = toMoney(item.monto);
            return [
                fmtFecha(item.fecha),
                etiquetaTipoMovimiento(item.tipo),
                etiquetaCategoriaMovimiento(item.categoria),
                item.concepto || '',
                etiquetaMetodoPago(item.metodo_pago),
                nombreVisible(item.usuario),
                monto
            ];
        });
        const saldoInicial = toMoney(caja.get('saldo_inicial'));
        const saldoEsperado = roundMoney(saldoInicial + ingresos - egresos);
        const efectivoEsperado = roundMoney(saldoInicial + flujo.efectivo_ingresos - flujo.efectivo_egresos);
        const qrEsperado = roundMoney(flujo.qr_ingresos - flujo.qr_egresos);
        const saldoContado = caja.get('saldo_contado') != null ? toMoney(caja.get('saldo_contado')) : null;
        const diferencia = caja.get('diferencia') != null
            ? toMoney(caja.get('diferencia'))
            : (saldoContado != null ? roundMoney(saldoContado - efectivoEsperado) : null);
        return [{
            nombre: 'Caja',
            titulo: `Caja #${caja.get('id')} — ${etiquetaEstadoCaja(String(caja.get('estado')))}`,
            subtitulo: `Apertura ${fmtFecha(caja.get('fecha_apertura') as Date)} · Cierre ${fmtFecha(caja.get('fecha_cierre') as Date | null)}`,
            resumen: [
                { label: 'Saldo inicial (efectivo)', valor: saldoInicial },
                { label: 'Ingresos', valor: ingresos },
                { label: 'Egresos', valor: egresos },
                { label: 'Efectivo en caja', valor: efectivoEsperado },
                { label: 'Saldo QR / banco', valor: qrEsperado },
                { label: 'Cobros de clientes', valor: flujo.cobros_clientes },
                { label: 'Anulaciones / devoluciones', valor: flujo.anulaciones_venta },
                { label: 'Cobrado neto', valor: flujo.cobrado_neto },
                { label: 'Total esperado', valor: saldoEsperado },
                { label: 'Efectivo contado', valor: saldoContado == null ? '-' : saldoContado },
                { label: 'Diferencia (cajón)', valor: diferencia == null ? '-' : diferencia },
                { label: 'Arqueo', valor: diferencia == null ? '-' : clasificarDiferencia(diferencia) },
                { label: 'Usuario apertura', valor: nombreVisible((caja as any).usuarioApertura) }
            ],
            columnas: COLUMNAS_DOCUMENTOS.caja,
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
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ]
        });
        if (!venta) {
            return [];
        }
        const total = toMoney(venta.total);
        const pendiente = saldoVenta(venta.saldo_pendiente, venta.estado);
        const cobrado = cobradoVenta(total, venta.saldo_pendiente, venta.estado);
        const filas = (venta.detalles || []).map((linea: any) => [
            linea.descripcion || '',
            Number(linea.cantidad),
            toMoney(linea.precio_unitario),
            toMoney(linea.subtotal)
        ]);
        const cobros = (venta.cobranzas || []).map((c: any) => [
            fmtFecha(c.fecha),
            toMoney(c.monto),
            etiquetaMetodoDocumento(c),
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
                { label: 'Usuario', valor: nombreVisible(venta.usuario) }
            ],
            columnas: ['Descripción', 'Cantidad', 'P. unitario (Bs)', 'Subtotal (Bs)'],
            filas
        }];
        if (cobros.length) {
            hojas.push({
                nombre: 'Cobranzas',
                titulo: `Cobranzas de la venta #${venta.id}`,
                columnas: ['Fecha', 'Monto (Bs)', 'Método', 'Referencia'],
                filas: cobros
            });
        }
        return hojas;
    }

    private static async hojaCompras(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = hayPeriodoQuery(req.query) ? { fecha: { [Op.between]: [desde, hasta] } } : {};
        aplicarFiltroIn(where, 'estado', valoresQuery(req.query, 'estado'));
        aplicarFiltroIn(where, 'id_proveedor', idsQuery(req.query, 'id_proveedor'));
        const comprasRaw = await Compra.findAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                { model: CompraDetalle, as: 'detalles', attributes: ['id_producto'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const tiposCompra = valoresQuery(req.query, 'tipo_compra');
        const compras = tiposCompra.length
            ? comprasRaw.filter((c) => tiposCompra.includes(inferirTipoCompra(c.get({ plain: true }))))
            : comprasRaw;
        const filas = compras.map((c: any) => {
            const total = toMoney(c.total);
            const pendiente = toMoney(c.saldo_pendiente);
            return [
                c.id,
                fmtFecha(c.fecha),
                c.proveedor?.nombre || '-',
                etiquetaTipoCompra(inferirTipoCompra(c)),
                total,
                roundMoney(total - pendiente),
                pendiente,
                etiquetaEstadoVenta(c.estado)
            ];
        });
        const total = roundMoney(filas.reduce((acc, f) => acc + Number(f[4]), 0));
        const porPagar = roundMoney(filas.reduce((acc, f) => acc + Number(f[6]), 0));
        const nServicios = filas.filter((f) => String(f[3]).includes('servicios') || String(f[3]) === 'Servicio').length;
        return {
            nombre: 'Compras',
            titulo: 'Compras',
            subtitulo: periodoTexto(desde, hasta),
            resumen: [
                { label: 'Cantidad', valor: String(compras.length) },
                { label: 'Servicios', valor: String(nServicios) },
                { label: 'Total', valor: total },
                { label: 'Por pagar', valor: porPagar }
            ],
            columnas: COLUMNAS_DOCUMENTOS.compras,
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
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
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
            subtitulo: `${compra.proveedor?.nombre || 'Proveedor'} · ${fmtFecha(compra.fecha)} · ${etiquetaEstadoVenta(compra.estado)}`,
            resumen: [
                { label: 'Total', valor: total },
                { label: 'Pagado', valor: roundMoney(total - pendiente) },
                { label: 'Pendiente', valor: pendiente },
                { label: 'Usuario', valor: nombreVisible(compra.usuario) }
            ],
            columnas: ['Descripción', 'Cantidad', 'P. unitario (Bs)', 'Subtotal (Bs)'],
            filas
        }];
        const pagos = (compra.pagos || []).map((p: any) => [
            fmtFecha(p.fecha),
            toMoney(p.monto),
            etiquetaMetodoDocumento(p),
            p.referencia || '-'
        ]);
        if (pagos.length) {
            hojas.push({
                nombre: 'Pagos',
                titulo: `Pagos de la compra #${compra.id}`,
                columnas: ['Fecha', 'Monto (Bs)', 'Método', 'Referencia'],
                filas: pagos
            });
        }
        return hojas;
    }

    private static async hojaCobranzas(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = hayPeriodoQuery(req.query) ? { fecha: { [Op.between]: [desde, hasta] } } : {};
        aplicarFiltroIn(where, 'id_cliente', idsQuery(req.query, 'id_cliente'));
        aplicarFiltroIn(where, 'metodo_pago', valoresQuery(req.query, 'metodo'));
        const cobranzas = await Cobranza.findAll({
            where,
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = cobranzas.map((c: any) => [
            fmtFecha(c.fecha),
            c.id_venta,
            c.cliente?.nombre || '-',
            toMoney(c.monto),
            etiquetaMetodoDocumento(c),
            c.referencia || '-',
            nombreVisible(c.usuario)
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
            columnas: COLUMNAS_DOCUMENTOS.cobranzas,
            filas
        };
    }

    private static async hojaPagos(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = hayPeriodoQuery(req.query) ? { fecha: { [Op.between]: [desde, hasta] } } : {};
        aplicarFiltroIn(where, 'id_proveedor', idsQuery(req.query, 'id_proveedor'));
        aplicarFiltroIn(where, 'metodo_pago', valoresQuery(req.query, 'metodo'));
        const pagos = await PagoProveedor.findAll({
            where,
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = pagos.map((p: any) => [
            fmtFecha(p.fecha),
            p.id_compra,
            p.proveedor?.nombre || '-',
            toMoney(p.monto),
            etiquetaMetodoDocumento(p),
            p.referencia || '-',
            nombreVisible(p.usuario)
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
            columnas: COLUMNAS_DOCUMENTOS.pagos,
            filas
        };
    }

    private static async consolidadoPorPagar(req: Request): Promise<{
        corte: string | null;
        filas: { id: number; proveedor: string; telefono: string; notas: number; compras_bs: number; pagos_bs: number; saldo_bs: number; saldo_usd: number; fanegas: number }[];
        totales: { saldo_bs: number; saldo_usd: number; fanegas: number; compras_bs: number; pagos_bs: number };
    }> {
        const filtro = filtroCuentaDesdeQuery(req.query);
        const idsProveedor = idsQuery(req.query, 'id_proveedor');
        const donde = idsProveedor.length ? { id_proveedor: idsProveedor.length === 1 ? idsProveedor[0] : { [Op.in]: idsProveedor } } : {};
        const [proveedores, compras, pagos, acopios] = await Promise.all([
            Proveedor.findAll({ where: idsProveedor.length ? { id: idsProveedor.length === 1 ? idsProveedor[0] : { [Op.in]: idsProveedor } } : {}, order: [['nombre', 'ASC']] }),
            Compra.findAll({
                where: donde,
                include: [{ model: CompraDetalle, as: 'detalles', include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }] }]
            }),
            PagoProveedor.findAll({
                where: donde,
                include: [{ model: Compra, as: 'compra', attributes: ['id', 'total', 'tipo_compra', 'tipo_cambio', 'total_usd', 'fanegas', 'boleta', 'ordenante'] }]
            }),
            Acopio.findAll({
                where: donde,
                include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }]
            })
        ]);
        const corte = filtro.hasta || null;
        const filas: { id: number; proveedor: string; telefono: string; notas: number; compras_bs: number; pagos_bs: number; saldo_bs: number; saldo_usd: number; fanegas: number }[] = [];
        let totalBs = 0;
        let totalUsd = 0;
        let totalFanegas = 0;
        let totalCompras = 0;
        let totalPagos = 0;
        for (const proveedor of proveedores) {
            const id = Number(proveedor.get('id'));
            const cuenta = armarCuentaProveedor(
                compras.filter((c) => Number(c.get('id_proveedor')) === id),
                pagos.filter((p) => Number(p.get('id_proveedor')) === id),
                acopios.filter((a) => Number(a.get('id_proveedor')) === id),
                { hasta: corte, ordenante: filtro.ordenante, tipo_compra: filtro.tipo_compra }
            );
            if (!cuenta.kardex.length && !cuenta.resumen.saldo) {
                continue;
            }
            const fanegas = cuenta.kardex.reduce((acc, linea) => acc + Number(linea.fanegas || 0), 0);
            const notas = cuenta.kardex.filter((linea) => linea.tipo === 'COMPRA' || linea.tipo === 'SERVICIO').length;
            filas.push({
                id,
                proveedor: String(proveedor.get('nombre')),
                telefono: String(proveedor.get('telefono') || ''),
                notas,
                compras_bs: cuenta.resumen.compras,
                pagos_bs: cuenta.resumen.pagado_compras,
                saldo_bs: cuenta.resumen.saldo,
                saldo_usd: cuenta.resumen.saldo_usd,
                fanegas
            });
            totalBs = roundMoney(totalBs + cuenta.resumen.saldo);
            totalUsd = roundMoney(totalUsd + cuenta.resumen.saldo_usd);
            totalFanegas += fanegas;
            totalCompras = roundMoney(totalCompras + cuenta.resumen.compras);
            totalPagos = roundMoney(totalPagos + cuenta.resumen.pagado_compras);
        }
        return {
            corte: corte ? fmtFecha(corte) : null,
            filas,
            totales: { saldo_bs: totalBs, saldo_usd: totalUsd, fanegas: totalFanegas, compras_bs: totalCompras, pagos_bs: totalPagos }
        };
    }

    private static async detalleCuentaProveedor(id: number, req: Request) {
        const proveedor = await Proveedor.findByPk(id);
        if (!proveedor) {
            return null;
        }
        const filtro = filtroCuentaDesdeQuery(req.query);
        const [compras, pagos, acopios] = await Promise.all([
            Compra.findAll({
                where: { id_proveedor: id },
                include: [{ model: CompraDetalle, as: 'detalles', include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }] }],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            }),
            PagoProveedor.findAll({
                where: { id_proveedor: id },
                include: [{ model: Compra, as: 'compra', attributes: ['id', 'total', 'tipo_compra', 'tipo_cambio', 'total_usd', 'fanegas', 'boleta', 'ordenante'] }],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            }),
            Acopio.findAll({
                where: { id_proveedor: id },
                include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            })
        ]);
        const cuenta = armarCuentaProveedor(compras, pagos, acopios, filtro);
        return {
            proveedor: { id: Number(proveedor.get('id')), nombre: String(proveedor.get('nombre')) },
            resumen: cuenta.resumen,
            kardex: cuenta.kardex
        };
    }

    private static async hojaCuentasPorPagar(req: Request): Promise<HojaExport> {
        const data = await ReporteController.consolidadoPorPagar(req);
        const filas: (string | number)[][] = data.filas.map((fila) => [
            fila.proveedor,
            fila.telefono || '',
            fila.notas,
            fila.fanegas || '',
            fila.compras_bs,
            fila.pagos_bs,
            fila.saldo_bs,
            fila.saldo_usd
        ]);
        filas.push(['TOTAL', '', '', data.totales.fanegas || '', data.totales.compras_bs, data.totales.pagos_bs, data.totales.saldo_bs, data.totales.saldo_usd]);
        const partes = [
            data.corte ? `Saldo al ${data.corte}` : 'Saldo a la fecha',
            valoresQuery(req.query, 'tipo_compra').length
                ? `Tipo ${valoresQuery(req.query, 'tipo_compra').map((t) => etiquetaTipoCompra(t)).join(', ')}`
                : '',
            req.query.ordenante ? `Ordenante ${String(req.query.ordenante)}` : ''
        ].filter(Boolean);
        return {
            nombre: 'Cuentas por pagar',
            titulo: 'Cuentas por pagar',
            subtitulo: partes.join(' · '),
            columnas: COLUMNAS_DOCUMENTOS.cuentas_por_pagar,
            filas
        };
    }

    private static async hojasCuentaProveedor(req: Request): Promise<HojaExport[]> {
        const id = Number(req.query.id);
        const proveedor = id ? await Proveedor.findByPk(id) : null;
        const columnasKardex = COLUMNAS_DOCUMENTOS.cuenta_proveedor;
        if (!proveedor) {
            return [{
                nombre: 'Kardex',
                titulo: 'Estado de cuenta del proveedor',
                columnas: columnasKardex,
                filas: []
            }];
        }
        const filtro = filtroCuentaDesdeQuery(req.query);
        const [compras, pagos, acopios] = await Promise.all([
            Compra.findAll({
                where: { id_proveedor: id },
                include: [
                    {
                        model: CompraDetalle,
                        as: 'detalles',
                        include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }]
                    },
                    { model: Productor, as: 'productor', attributes: ['id', 'nombre'] }
                ],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            }),
            PagoProveedor.findAll({
                where: { id_proveedor: id },
                include: [{
                    model: Compra,
                    as: 'compra',
                    attributes: ['id', 'total', 'tipo_compra', 'tipo_cambio', 'total_usd', 'fanegas', 'boleta', 'ordenante'],
                    include: [{ model: Productor, as: 'productor', attributes: ['id', 'nombre'] }]
                }],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            }),
            Acopio.findAll({
                where: { id_proveedor: id },
                include: [{ model: Productos, as: 'producto', attributes: ['id', 'nombre', 'unidad_medida'] }],
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            })
        ]);
        const cuenta = armarCuentaProveedor(compras, pagos, acopios, filtro);
        const r = cuenta.resumen;
        const nombre = String(proveedor.get('nombre'));
        const productores = extraerProductores(compras);
        const filtroProductor = productores.find((p) => p.id === filtro.id_productor)?.nombre;
        const partesFiltro = [
            filtro.desde || filtro.hasta
                ? `Período ${filtro.desde ? fmtFecha(filtro.desde) : 'inicio'} a ${filtro.hasta ? fmtFecha(filtro.hasta) : 'hoy'}`
                : '',
            filtro.tipo_compra
                ? `Tipo ${(Array.isArray(filtro.tipo_compra) ? filtro.tipo_compra : [filtro.tipo_compra]).map((t) => etiquetaTipoCompra(t)).join(', ')}`
                : '',
            filtro.ordenante ? `Ordenante ${filtro.ordenante}` : ''
        ].filter(Boolean);
        const montoCuenta = (bs: number, usd?: number) => {
            if (!bs && !usd) {
                return '';
            }
            return usd ? `${formatBs(bs)} (${formatUsd(usd)})` : formatBs(bs);
        };
        return [
            {
                nombre: 'Kardex',
                titulo: `Estado de cuenta — ${nombre}`,
                subtitulo: [
                    'La deuda y los pagos son en Bs. El USD es referencial. El saldo se acumula por proveedor.',
                    partesFiltro.join(' · ')
                ].filter(Boolean).join(' '),
                resumen: [
                    { label: 'Saldo anterior', valor: r.saldo_anterior },
                    { label: 'Compras', valor: r.compras },
                    { label: 'Servicios', valor: r.servicios },
                    { label: 'Pagado', valor: r.pagado_compras },
                    { label: 'Cargo', valor: r.cargo },
                    { label: 'Abono', valor: r.abono },
                    { label: 'Saldo', valor: r.saldo }
                ],
                columnas: columnasKardex,
                filas: [
                    ...cuenta.kardex.map((linea) => [
                        fmtFecha(linea.fecha),
                        linea.ordenante || '',
                        etiquetaTipoOperacionProveedor(linea.tipo),
                        linea.detalle,
                        linea.boleta || '',
                        linea.chofer || '',
                        linea.placa || '',
                        linea.fanegas || '',
                        linea.precio ? linea.precio : '',
                        linea.precio_usd ? linea.precio_usd : '',
                        linea.cargo ? linea.cargo : '',
                        linea.cargo_usd ? linea.cargo_usd : '',
                        linea.abono ? linea.abono : '',
                        linea.abono_usd ? linea.abono_usd : '',
                        linea.saldo,
                        linea.saldo_usd
                    ]),
                    [
                        '',
                        '',
                        'TOTAL',
                        'Saldo final',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        r.cargo,
                        r.compras_usd ? r.compras_usd : '',
                        r.abono,
                        r.pagado_usd ? r.pagado_usd : '',
                        r.saldo,
                        r.saldo_usd
                    ]
                ]
            },
            {
                nombre: 'Entregas',
                titulo: `Entregas — ${nombre}`,
                subtitulo: 'Cantidad entregada en compras. El stock del almacén es único.',
                columnas: COLUMNAS_DOCUMENTOS.entregas_proveedor,
                filas: cuenta.inventario.map((linea) => [
                    linea.producto,
                    linea.unidad,
                    linea.compras,
                    linea.entregado
                ])
            }
        ];
    }

    private static async hojaInventario(req: Request): Promise<HojaExport> {
        const where: any = { eliminado: false };
        aplicarFiltroIn(where, 'id_categoria', idsQuery(req.query, 'id_categoria'));
        aplicarFiltroIn(where, 'disponible_en', valoresQuery(req.query, 'disponible_en'));
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (q) {
            where.nombre = { [Op.like]: `%${q}%` };
        }
        const productos = await Productos.findAll({
            where,
            include: [{ model: CategoriaProducto, as: 'categoria', attributes: ['id', 'nombre'] }],
            order: [['nombre', 'ASC']],
            limit: 2000
        });
        const reservas = new Map((await ReservaProducto.findAll()).map(r => [Number(r.get('id_producto')), Number(r.get('cantidad'))]));
        const filas = productos.map((p: any) => {
            const stock = Number(p.stock);
            const minimo = Number(p.stock_minimo);
            return [
                p.nombre,
                p.categoria?.nombre || '-',
                p.unidad_medida || '-',
                stock,
                reservas.get(p.id) || 0,
                stock - (reservas.get(p.id) || 0),
                minimo,
                toMoney(p.precio_venta),
                toMoney(p.precio_compra),
                stock - (reservas.get(p.id) || 0) <= minimo ? 'Bajo mínimo' : 'OK'
            ];
        });
        return {
            nombre: 'Inventario',
            titulo: 'Inventario de productos',
            subtitulo: [
                `Generado ${fmtFecha(new Date())}`,
                valoresQuery(req.query, 'id_categoria').length ? `Categoría ${valoresQuery(req.query, 'id_categoria').join(', ')}` : '',
                valoresQuery(req.query, 'disponible_en').length
                    ? `Disponible en ${valoresQuery(req.query, 'disponible_en').map((d) => etiquetaDisponibleEn(d)).join(', ')}`
                    : '',
                q ? `Búsqueda ${q}` : ''
            ].filter(Boolean).join(' · '),
            resumen: [{ label: 'Productos', valor: String(productos.length) }],
            columnas: COLUMNAS_DOCUMENTOS.inventario,
            filas
        };
    }

    private static async hojaClientes(req: Request): Promise<HojaExport> {
        const where: any = {};
        const activos = valoresQuery(req.query, 'activos');
        if (activos.length === 1 && activos[0] === 'inactivos') {
            where.activo = false;
        } else if (activos.length === 1 && activos[0] === 'activos') {
            where.activo = true;
        }
        aplicarFiltroIn(where, 'procedencia', valoresQuery(req.query, 'procedencia'));
        const clientes = await Cliente.findAll({ where, order: [['nombre', 'ASC']], limit: 4000 });
        const filas = clientes.map((c: any) => [
            c.nombre,
            c.nit_ci || '-',
            c.telefono || '-',
            c.procedencia || '-',
            c.direccion || '-',
            c.activo ? 'Activo' : 'Inactivo'
        ]);
        return {
            nombre: 'Clientes',
            titulo: 'Clientes',
            subtitulo: `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Registros', valor: String(clientes.length) }],
            columnas: COLUMNAS_DOCUMENTOS.clientes,
            filas
        };
    }

    private static async hojaProveedores(req: Request): Promise<HojaExport> {
        const where: any = {};
        const activosProv = valoresQuery(req.query, 'activos');
        if (activosProv.length === 1 && activosProv[0] === 'inactivos') {
            where.activo = false;
        } else if (activosProv.length === 1 && activosProv[0] === 'activos') {
            where.activo = true;
        }
        const proveedores = await Proveedor.findAll({ where, order: [['nombre', 'ASC']], limit: 4000 });
        const filas = proveedores.map((p: any) => [
            p.nombre,
            p.nit_ci || '-',
            p.telefono || '-',
            p.direccion || '-',
            p.activo ? 'Activo' : 'Inactivo'
        ]);
        return {
            nombre: 'Proveedores',
            titulo: 'Proveedores',
            subtitulo: `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Registros', valor: String(proveedores.length) }],
            columnas: COLUMNAS_DOCUMENTOS.proveedores,
            filas
        };
    }

    private static async hojaEmpaques(req: Request): Promise<HojaExport> {
        const productos = await Productos.findAll({
            where: { eliminado: false },
            include: [{ model: CategoriaProducto, as: 'categoria', attributes: ['id', 'nombre'] }],
            order: [['nombre', 'ASC']],
            limit: 4000
        });
        const estadosEmpaque = valoresQuery(req.query, 'estado');
        const bolsas = productos.filter((p: any) => {
            if (!esProductoEmpaque(p)) {
                return false;
            }
            const bajo = Number(p.stock) <= Number(p.stock_minimo);
            if (!estadosEmpaque.length) {
                return true;
            }
            return estadosEmpaque.some((estado) => (estado === 'BAJO' ? bajo : estado === 'OK' ? !bajo : true));
        });
        const filas = bolsas.map((p: any) => {
            const stock = Number(p.stock);
            const minimo = Number(p.stock_minimo);
            return [
                p.nombre,
                p.unidad_medida || '-',
                stock,
                minimo,
                stock <= minimo ? 'Bajo mínimo' : 'OK'
            ];
        });
        return {
            nombre: 'Empaques',
            titulo: 'Bolsas y empaques',
            subtitulo: `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Tipos', valor: String(bolsas.length) }],
            columnas: COLUMNAS_DOCUMENTOS.empaques,
            filas
        };
    }

    private static async hojaProduccion(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = hayPeriodoQuery(req.query) ? { fecha: { [Op.between]: [desde, hasta] } } : {};
        const items = await Produccion.findAll({
            where,
            include: [
                { model: Productos, as: 'productoOrigen', attributes: ['id', 'nombre'] },
                { model: Productos, as: 'productoDestino', attributes: ['id', 'nombre'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ],
            order: [['fecha', 'ASC']],
            limit: 2000
        });
        const filas = items.map((p: any) => [
            fmtFecha(p.fecha),
            p.productoOrigen?.nombre || '-',
            Number(p.cantidad_entrada),
            p.productoDestino?.nombre || '-',
            Number(p.cantidad_salida),
            Number(p.merma),
            nombreVisible(p.usuario)
        ]);
        return {
            nombre: 'Producción',
            titulo: 'Producción',
            subtitulo: hayPeriodoQuery(req.query) ? periodoTexto(desde, hasta) : `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Registros', valor: String(items.length) }],
            columnas: COLUMNAS_DOCUMENTOS.produccion,
            filas
        };
    }

    private static async hojaCampanas(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = {};
        aplicarFiltroIn(where, 'estado', valoresQuery(req.query, 'estado'));
        if (hayPeriodoQuery(req.query)) {
            where.fecha_inicio = { [Op.between]: [ymd(desde), ymd(hasta)] };
        }
        const campanas = await Campana.findAll({
            where,
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }],
            order: [['fecha_inicio', 'DESC']],
            limit: 2000
        });
        const filas = campanas.map((c: any) => [
            c.nombre,
            fmtFechaDia(c.fecha_inicio),
            c.fecha_fin ? fmtFechaDia(c.fecha_fin) : '-',
            Number(c.meta_cantidad || 0) || '-',
            etiquetaEstadoVenta(c.estado),
            nombreVisible(c.usuario)
        ]);
        return {
            nombre: 'Campañas',
            titulo: 'Campañas de acopio',
            subtitulo: hayPeriodoQuery(req.query) ? periodoTexto(desde, hasta) : `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Campañas', valor: String(campanas.length) }],
            columnas: COLUMNAS_DOCUMENTOS.campanas,
            filas
        };
    }

    private static async hojaCajas(req: Request, desde: Date, hasta: Date): Promise<HojaExport> {
        const where: any = {};
        aplicarFiltroIn(where, 'estado', valoresQuery(req.query, 'estado'));
        if (hayPeriodoQuery(req.query)) {
            where.fecha_apertura = { [Op.between]: [desde, hasta] };
        }
        const cajas = await Caja.findAll({
            where,
            include: [
                { model: User, as: 'usuarioApertura', attributes: ['id', 'username', 'nombre'] },
                { model: User, as: 'usuarioCierre', attributes: ['id', 'username', 'nombre'] }
            ],
            order: [['fecha_apertura', 'DESC']],
            limit: 2000
        });
        const ids = cajas.map((c: any) => c.id);
        const movimientos = ids.length
            ? await MovimientoCaja.findAll({ where: { id_caja: { [Op.in]: ids } } })
            : [];
        const flujoPorCaja = new Map<number, { ingresos: number; egresos: number }>();
        movimientos.forEach((m: any) => {
            const actual = flujoPorCaja.get(m.id_caja) || { ingresos: 0, egresos: 0 };
            const monto = toMoney(m.monto);
            if (m.tipo === TIPO_MOVIMIENTO.INGRESO) {
                actual.ingresos += monto;
            } else {
                actual.egresos += monto;
            }
            flujoPorCaja.set(m.id_caja, actual);
        });
        const filas = cajas.map((c: any) => {
            const flujo = flujoPorCaja.get(c.id) || { ingresos: 0, egresos: 0 };
            return [
                fmtFecha(c.fecha_apertura),
                nombreVisible(c.usuarioApertura),
                toMoney(c.saldo_inicial),
                roundMoney(flujo.ingresos),
                roundMoney(flujo.egresos),
                c.saldo_esperado != null ? toMoney(c.saldo_esperado) : '-',
                c.saldo_contado != null ? toMoney(c.saldo_contado) : '-',
                c.diferencia != null ? toMoney(c.diferencia) : '-',
                etiquetaEstadoCaja(c.estado)
            ];
        });
        return {
            nombre: 'Cajas',
            titulo: 'Historial de cajas',
            subtitulo: hayPeriodoQuery(req.query) ? periodoTexto(desde, hasta) : `Generado ${fmtFecha(new Date())}`,
            resumen: [{ label: 'Cajas', valor: String(cajas.length) }],
            columnas: COLUMNAS_DOCUMENTOS.cajas,
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
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'nit_ci', 'direccion', 'procedencia'] },
                { model: VentaDetalle, as: 'detalles' },
                { model: Cobranza, as: 'cobranzas' },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ]
        });
        if (!venta) {
            return null;
        }
        const total = toMoney(venta.total);
        const pendiente = saldoVenta(venta.saldo_pendiente, venta.estado);
        const cobrado = cobradoVenta(total, venta.saldo_pendiente, venta.estado);
        const medios = (venta.cobranzas || []).reduce((acc: { efectivo: number; qr: number }, cob: any) => {
            const parte = partesMontos(cob);
            acc.efectivo = roundMoney(acc.efectivo + parte.efectivo);
            acc.qr = roundMoney(acc.qr + parte.qr);
            return acc;
        }, { efectivo: 0, qr: 0 });
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
            procedencia: venta.cliente?.procedencia || '',
            vendedor: nombreVisible(venta.usuario),
            tipoPago: venta.estado === ESTADO_VENTA.ANULADA ? 'ANULADA' : ReporteController.tipoPagoPorSaldo(total, pendiente),
            fechaVencimiento: pendiente > 0 && venta.fecha_vencimiento ? fmtFechaDia(venta.fecha_vencimiento) : '',
            plazoDias: pendiente > 0 && venta.plazo_dias != null ? Number(venta.plazo_dias) : null,
            detalle: 'VENTA',
            lineas: ReporteController.lineasVoucher(venta.detalles),
            total,
            cobrado,
            pendiente,
            efectivo: medios.efectivo,
            qr: medios.qr
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
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
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
            vendedor: nombreVisible(compra.usuario),
            tipoPago: ReporteController.tipoPagoPorSaldo(total, pendiente),
            fechaVencimiento: pendiente > 0 && compra.fecha_vencimiento ? fmtFechaDia(compra.fecha_vencimiento) : '',
            plazoDias: pendiente > 0 && compra.plazo_dias != null ? Number(compra.plazo_dias) : null,
            detalle: ReporteController.detalleNotaCompra(compra),
            lineas: ReporteController.lineasVoucher(compra.detalles),
            total,
            cobrado: roundMoney(total - pendiente),
            pendiente
        };
    }

    private static detalleNotaCompra(compra: any): string {
        const tipo = inferirTipoCompra(compra);
        const partes = [etiquetaTipoCompra(tipo).toUpperCase()];
        if (compra.concepto) partes.push(String(compra.concepto));
        if (compra.boleta) partes.push(`Boleta ${compra.boleta}`);
        if (compra.fanegas) partes.push(`${compra.fanegas} fanegas`);
        if (tipo === TIPO_COMPRA.CHALA && compra.precio_usd != null) {
            partes.push(`${formatUsd(compra.precio_usd)}/fan`);
        }
        if (compra.tipo_cambio) {
            partes.push(`TC ${compra.tipo_cambio}`);
        }
        if (tipo === TIPO_COMPRA.CHALA && compra.total_usd != null) {
            partes.push(`Total ${formatUsd(compra.total_usd)}`);
        }
        return partes.join(' · ') || (esCompraServicio(compra) ? 'SERVICIO' : 'COMPRA');
    }

    private static fechaDoc(valor: unknown): Date {
        return valor instanceof Date ? valor : new Date(String(valor || ''));
    }

    private static tcEmpresa(extra?: number | null): number | null {
        if (extra && extra > 0) {
            return extra;
        }
        const tc = Number(datosEmpresa().tipo_cambio);
        return tc > 0 ? tc : null;
    }

    private static async datosReciboPago(req: Request): Promise<DatosReciboMovimiento | null> {
        const id = Number(req.query.id);
        return id ? ReporteController.reciboDesdePago(id) : null;
    }

    private static async datosReciboCobranza(req: Request): Promise<DatosReciboMovimiento | null> {
        const id = Number(req.query.id);
        return id ? ReporteController.reciboDesdeCobranza(id) : null;
    }

    private static async datosReciboGasto(req: Request): Promise<DatosReciboMovimiento | null> {
        const id = Number(req.query.id);
        return id ? ReporteController.reciboDesdeGasto(id) : null;
    }

    private static async datosReciboMovimiento(req: Request): Promise<DatosReciboMovimiento | null> {
        const id = Number(req.query.id);
        if (!id) {
            return null;
        }
        const mov: any = await MovimientoCaja.findByPk(id, {
            include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }]
        });
        if (!mov) {
            return null;
        }
        const origenId = Number(mov.origen_id || 0);
        if (mov.origen === 'COBRANZA' && origenId) {
            return ReporteController.reciboDesdeCobranza(origenId);
        }
        if ((mov.origen === 'PAGO_PROVEEDOR' || mov.origen === 'COMPRA') && origenId) {
            const pago = await ReporteController.reciboDesdePago(origenId);
            if (pago) {
                return pago;
            }
        }
        if (mov.origen === 'GASTO' && origenId) {
            return ReporteController.reciboDesdeGasto(origenId, toMoney(mov.monto), mov);
        }
        if (mov.origen === 'VENTA' && origenId) {
            return ReporteController.reciboDesdeVentaCaja(origenId, mov);
        }
        return ReporteController.reciboDesdeMovimientoManual(mov);
    }

    private static async reciboDesdeCobranza(id: number): Promise<DatosReciboMovimiento | null> {
        const item: any = await Cobranza.findByPk(id, {
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'nit_ci'] },
                { model: Venta, as: 'venta', attributes: ['id', 'total', 'saldo_pendiente', 'estado', 'fecha'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ]
        });
        if (!item) {
            return null;
        }
        const monto = toMoney(item.monto);
        const medios = partesMontos(item);
        const ventaFecha = item.venta?.fecha ? fmtFechaDia(item.venta.fecha) : '';
        return {
            tipoDocumento: 'COBRANZA',
            serie: 'VCRE',
            numero: item.id,
            fecha: ReporteController.fechaDoc(item.fecha),
            tipoCambio: ReporteController.tcEmpresa(),
            metodo: etiquetaMetodoDocumento(item),
            detalle: item.observacion?.trim() || 'COBRANZA',
            contraparteLabel: 'CLIENTE',
            contraparteNombre: item.cliente?.nombre || 'Cliente',
            nitCi: item.cliente?.nit_ci || '0',
            lineas: [{
                codigo: `VD / ${String(item.id_venta).padStart(6, '0')}`,
                descripcion: `VENTA${ventaFecha ? ` ${ventaFecha}` : ''}`,
                importe: monto
            }],
            total: monto,
            efectivo: medios.efectivo,
            qr: medios.qr,
            saldoPendiente: item.venta ? toMoney(item.venta.saldo_pendiente) : null,
            referencia: item.referencia || '',
            observacion: item.observacion || '',
            usuario: nombreVisible(item.usuario)
        };
    }

    private static async reciboDesdePago(id: number): Promise<DatosReciboMovimiento | null> {
        const pago: any = await PagoProveedor.findByPk(id, {
            include: [
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre', 'nit_ci'] },
                { model: Compra, as: 'compra', attributes: ['id', 'total', 'saldo_pendiente', 'tipo_cambio'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ]
        });
        if (!pago) {
            return null;
        }
        const monto = toMoney(pago.monto);
        const medios = partesMontos(pago);
        const tc = pago.compra?.tipo_cambio != null ? Number(pago.compra.tipo_cambio) : null;
        const detalle = pago.observacion?.trim() || `Pago a cuenta de compra #${pago.id_compra}`;
        return {
            tipoDocumento: 'COMPROBANTE DE EGRESO',
            serie: 'EG',
            numero: pago.id,
            fecha: ReporteController.fechaDoc(pago.fecha),
            tipoCambio: ReporteController.tcEmpresa(tc),
            metodo: etiquetaMetodoDocumento(pago),
            detalle,
            contraparteLabel: 'PROVEEDOR',
            contraparteNombre: pago.proveedor?.nombre || 'Proveedor',
            nitCi: pago.proveedor?.nit_ci || '0',
            lineas: [{
                codigo: `OC / ${String(pago.id_compra).padStart(6, '0')}`,
                descripcion: detalle,
                importe: monto
            }],
            total: monto,
            efectivo: medios.efectivo,
            qr: medios.qr,
            saldoPendiente: pago.compra ? toMoney(pago.compra.saldo_pendiente) : null,
            referencia: pago.referencia || '',
            observacion: pago.observacion || '',
            usuario: nombreVisible(pago.usuario)
        };
    }

    private static async reciboDesdeGasto(id: number, montoOverride?: number, mov?: any): Promise<DatosReciboMovimiento | null> {
        const gasto: any = await Gasto.findByPk(id, {
            include: [
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] },
                { model: PagoGasto, as: 'pagos', include: [{ model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }] }
            ]
        });
        if (!gasto) {
            return null;
        }
        const pagos = [...(gasto.pagos || [])].sort((a: any, b: any) => Number(b.id) - Number(a.id));
        const ultimo = pagos[0];
        const monto = montoOverride != null
            ? toMoney(montoOverride)
            : ultimo
                ? toMoney(ultimo.monto)
                : toMoney(gasto.monto);
        const metodoSrc = mov || ultimo || gasto;
        const esRetiro = gasto.tipo === 'RETIRO_PERSONAL';
        const detalle = (mov?.observacion || gasto.observacion || gasto.concepto || '').trim()
            || (esRetiro ? 'Retiro personal' : 'Gasto de empresa');
        return {
            tipoDocumento: 'COMPROBANTE DE EGRESO',
            serie: 'EG',
            numero: ultimo?.id || gasto.id,
            fecha: ReporteController.fechaDoc(mov?.fecha || ultimo?.fecha || gasto.fecha),
            tipoCambio: ReporteController.tcEmpresa(),
            metodo: etiquetaMetodoDocumento(metodoSrc),
            detalle,
            contraparteLabel: esRetiro ? 'PERSONA' : 'DOC',
            contraparteNombre: gasto.persona || (esRetiro ? 'Retiro personal' : 'Gasto de empresa'),
            nitCi: '',
            lineas: [{
                codigo: `GS / ${String(gasto.id).padStart(6, '0')}`,
                descripcion: gasto.concepto || detalle,
                importe: monto
            }],
            total: monto,
            efectivo: partesMontos({ ...metodoSrc, monto }).efectivo,
            qr: partesMontos({ ...metodoSrc, monto }).qr,
            saldoPendiente: toMoney(gasto.saldo_pendiente) || null,
            referencia: mov?.referencia || ultimo?.referencia || gasto.referencia || '',
            observacion: gasto.observacion || '',
            usuario: nombreVisible(mov?.usuario, ultimo?.usuario, gasto.usuario)
        };
    }

    private static async reciboDesdeVentaCaja(idVenta: number, mov: any): Promise<DatosReciboMovimiento | null> {
        const venta: any = await Venta.findByPk(idVenta, {
            include: [
                { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'nit_ci'] },
                { model: User, as: 'usuario', attributes: ['id', 'username', 'nombre'] }
            ]
        });
        const anula = String(mov.categoria || '') === 'ANULACION_VENTA' || mov.tipo === 'EGRESO';
        const monto = toMoney(mov.monto);
        const nombre = venta?.cliente?.nombre || 'Cliente';
        const detalle = (mov.observacion || mov.concepto || '').trim()
            || (anula ? `Anulación venta #${idVenta}` : `Pago al registrar venta #${idVenta}`);
        return {
            tipoDocumento: anula ? 'COMPROBANTE DE EGRESO' : 'COMPROBANTE DE INGRESO',
            serie: anula ? 'EG' : 'IN',
            numero: mov.id,
            fecha: ReporteController.fechaDoc(mov.fecha),
            tipoCambio: ReporteController.tcEmpresa(),
            metodo: etiquetaMetodoDocumento(mov),
            detalle,
            contraparteLabel: 'CLIENTE',
            contraparteNombre: nombre,
            nitCi: venta?.cliente?.nit_ci || '0',
            lineas: [{
                codigo: `VD / ${String(idVenta).padStart(6, '0')}`,
                descripcion: detalle,
                importe: monto
            }],
            total: monto,
            efectivo: partesMontos({ ...mov, monto }).efectivo,
            qr: partesMontos({ ...mov, monto }).qr,
            saldoPendiente: venta ? toMoney(venta.saldo_pendiente) : null,
            referencia: mov.referencia || '',
            observacion: mov.observacion || '',
            usuario: nombreVisible(mov.usuario, venta?.usuario)
        };
    }

    private static reciboDesdeMovimientoManual(mov: any): DatosReciboMovimiento {
        const ingreso = mov.tipo === TIPO_MOVIMIENTO.INGRESO;
        const monto = toMoney(mov.monto);
        const detalle = (mov.observacion || mov.concepto || '').trim() || (ingreso ? 'Ingreso de caja' : 'Egreso de caja');
        return {
            tipoDocumento: ingreso ? 'COMPROBANTE DE INGRESO' : 'COMPROBANTE DE EGRESO',
            serie: ingreso ? 'IN' : 'EG',
            numero: mov.id,
            fecha: ReporteController.fechaDoc(mov.fecha),
            tipoCambio: ReporteController.tcEmpresa(),
            metodo: etiquetaMetodoDocumento(mov),
            detalle,
            contraparteLabel: 'DOC',
            contraparteNombre: etiquetaCategoriaMovimiento(mov.categoria),
            nitCi: '',
            lineas: [{
                codigo: `${ingreso ? 'IN' : 'EG'} / ${String(mov.id).padStart(6, '0')}`,
                descripcion: mov.concepto || detalle,
                importe: monto
            }],
            total: monto,
            efectivo: partesMontos({ ...mov, monto }).efectivo,
            qr: partesMontos({ ...mov, monto }).qr,
            referencia: mov.referencia || '',
            observacion: mov.observacion || '',
            usuario: nombreVisible(mov.usuario)
        };
    }

    private static async hojaPago(req: Request): Promise<HojaExport[]> {
        const recibo = await ReporteController.datosReciboPago(req);
        if (!recibo) {
            return [];
        }
        return [{
            nombre: 'Recibo',
            titulo: `${recibo.tipoDocumento} ${recibo.serie}-${String(recibo.numero).padStart(6, '0')}`,
            subtitulo: recibo.contraparteNombre,
            resumen: [
                { label: 'Monto Bs', valor: recibo.total },
                { label: 'Saldo', valor: recibo.saldoPendiente ?? '-' }
            ],
            columnas: ['Campo', 'Valor'],
            filas: [
                ['Fecha', fmtFecha(recibo.fecha)],
                [recibo.contraparteLabel, recibo.contraparteNombre],
                ['Monto', recibo.total],
                ['Método', recibo.metodo],
                ['Tipo de cambio', recibo.tipoCambio ?? '-'],
                ['Saldo pendiente', recibo.saldoPendiente ?? '-'],
                ['Referencia', recibo.referencia || '-'],
                ['Usuario', recibo.usuario]
            ]
        }];
    }
}
