import { ESTADO_COMPRA, inferirTipoCompra, TIPO_COMPRA, TIPOS_COMPRA } from '../constants/compra.constants';
import { parseFechaLocal } from './fecha';
import { toQty } from './inventario';
import { roundMoney, toMoney } from './money';
import { normalizarUnidadMedida } from './unidad-medida';

export type TipoKardexProveedor = 'SALDO ANTERIOR' | 'COMPRA' | 'SERVICIO' | 'PAGO' | 'ACOPIO' | 'PAGO ACOPIO';

export interface FiltroCuentaProveedor {
    desde?: Date | null;
    hasta?: Date | null;
    id_productor?: number | null;
    tipo_compra?: string | null;
}

export interface LineaKardexProveedor {
    fecha: Date | string;
    tipo: TipoKardexProveedor;
    documento: string;
    detalle: string;
    productor: string;
    id_productor: number | null;
    boleta: string;
    chofer: string;
    placa: string;
    fanegas: number;
    precio: number;
    precio_usd: number;
    tipo_cambio: number;
    cargo: number;
    abono: number;
    cargo_usd: number;
    abono_usd: number;
    saldo: number;
    saldo_usd: number;
}

export interface LineaInventarioProveedor {
    id_producto: number | null;
    producto: string;
    unidad: string;
    compras: number;
    acopio: number;
    entregado: number;
}

export interface ResumenCuentaProveedor {
    compras: number;
    servicios: number;
    pagado_compras: number;
    por_pagar_compras: number;
    acopios: number;
    pagado_acopios: number;
    por_pagar_acopios: number;
    cargo: number;
    abono: number;
    saldo: number;
    compras_usd: number;
    pagado_usd: number;
    saldo_usd: number;
    saldo_anterior: number;
    saldo_anterior_usd: number;
}

/** Compra sin producto de inventario: flete, comisión u otro servicio. */
export function esCompraServicio(compra: any): boolean {
    const lineas = compra?.detalles || [];
    if (!lineas.length) {
        return false;
    }
    return lineas.every((d: any) => d.id_producto == null || d.id_producto === '');
}

function claveProducto(id: unknown, nombre: string): string {
    const pid = Number(id);
    if (Number.isFinite(pid) && pid > 0) {
        return `p:${pid}`;
    }
    return `n:${nombre.trim().toLowerCase() || 'producto'}`;
}

export function armarInventarioProveedor(compras: any[], acopios: any[]): LineaInventarioProveedor[] {
    const comprasVigentes = compras.filter((c) => String(c.estado) !== ESTADO_COMPRA.ANULADA);
    const mapa = new Map<string, LineaInventarioProveedor>();

    const fila = (id: unknown, nombre: string, unidad: string): LineaInventarioProveedor => {
        const producto = nombre.trim() || 'Producto';
        const clave = claveProducto(id, producto);
        let actual = mapa.get(clave);
        if (!actual) {
            const pid = Number(id);
            actual = {
                id_producto: Number.isFinite(pid) && pid > 0 ? pid : null,
                producto,
                unidad: normalizarUnidadMedida(unidad) || 'Kilo',
                compras: 0,
                acopio: 0,
                entregado: 0
            };
            mapa.set(clave, actual);
        }
        return actual;
    };

    for (const compra of comprasVigentes) {
        for (const detalle of compra.detalles || []) {
            if (detalle.id_producto == null || detalle.id_producto === '') {
                continue;
            }
            const nombre = String(detalle.producto?.nombre || detalle.descripcion || 'Producto');
            const unidad = String(detalle.unidad || detalle.producto?.unidad_medida || 'Kilo');
            const linea = fila(detalle.id_producto, nombre, unidad);
            linea.compras = toQty(linea.compras + toQty(detalle.cantidad));
        }
    }

    for (const acopio of acopios) {
        const nombre = String(acopio.producto?.nombre || acopio.descripcion || 'Acopio');
        const unidad = String(acopio.producto?.unidad_medida || 'Kilo');
        const linea = fila(acopio.id_producto, nombre, unidad);
        linea.acopio = toQty(linea.acopio + toQty(acopio.cantidad));
    }

    return [...mapa.values()]
        .map((linea) => ({ ...linea, entregado: toQty(linea.compras + linea.acopio) }))
        .sort((a, b) => a.producto.localeCompare(b.producto, 'es'));
}

function fechaEvento(valor: unknown): Date {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return valor;
    }
    const parsed = new Date(String(valor || ''));
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function detalleCompra(compra: any): string {
    const concepto = String(compra.concepto || '').trim();
    if (concepto) {
        return concepto;
    }
    const obs = String(compra.observacion || '').trim();
    if (obs) {
        return obs;
    }
    const lineas = (compra.detalles || [])
        .map((d: any) => String(d.descripcion || '').trim())
        .filter(Boolean);
    return lineas[0] || (esCompraServicio(compra) ? 'Servicio' : 'Compra');
}

function textoCampo(valor: unknown): string {
    return String(valor || '').trim();
}

function fanegasDeCompra(compra: any): number {
    if (compra.fanegas != null && Number(compra.fanegas) > 0) {
        return toQty(compra.fanegas);
    }
    if (esCompraServicio(compra)) {
        return 0;
    }
    const linea = (compra.detalles || [])[0];
    return linea ? toQty(linea.cantidad) : 0;
}

function precioDeCompra(compra: any): number {
    const linea = (compra.detalles || [])[0];
    return linea ? toMoney(linea.precio_unitario) : 0;
}

function tipoCambioDe(valor: unknown): number {
    const tc = Number(valor);
    return Number.isFinite(tc) && tc > 0 ? tc : 0;
}

function idProductorDe(origen: any): number | null {
    const directo = Number(origen?.id_productor);
    if (Number.isFinite(directo) && directo > 0) {
        return directo;
    }
    const deCompra = Number(origen?.compra?.id_productor);
    if (Number.isFinite(deCompra) && deCompra > 0) {
        return deCompra;
    }
    return null;
}

function nombreProductorDe(origen: any): string {
    return String(
        origen?.productor?.nombre
        || origen?.compra?.productor?.nombre
        || origen?.proveedor?.nombre
        || origen?.compra?.proveedor?.nombre
        || ''
    ).trim();
}

function pasaFiltroProductor(idProductor: number | null, filtro?: number | null): boolean {
    if (!filtro) {
        return true;
    }
    return idProductor === filtro;
}

function pasaFiltroTipo(compraLike: any, filtro?: string | null): boolean {
    if (!filtro) {
        return true;
    }
    return inferirTipoCompra(compraLike || {}) === filtro;
}

export function filtroCuentaDesdeQuery(query: { fecha_desde?: unknown; fecha_hasta?: unknown; id_productor?: unknown; tipo_compra?: unknown }): FiltroCuentaProveedor {
    const desdeRaw = typeof query.fecha_desde === 'string' ? query.fecha_desde.trim() : '';
    const hastaRaw = typeof query.fecha_hasta === 'string' ? query.fecha_hasta.trim() : '';
    let desde: Date | null = null;
    let hasta: Date | null = null;
    if (desdeRaw) {
        const parsed = parseFechaLocal(desdeRaw);
        if (!Number.isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            desde = parsed;
        }
    }
    if (hastaRaw) {
        const parsed = parseFechaLocal(hastaRaw);
        if (!Number.isNaN(parsed.getTime())) {
            parsed.setHours(23, 59, 59, 999);
            hasta = parsed;
        }
    }
    const idProductor = Number(query.id_productor);
    const tipo = String(query.tipo_compra || '').toUpperCase();
    return {
        desde,
        hasta,
        id_productor: Number.isFinite(idProductor) && idProductor > 0 ? idProductor : null,
        tipo_compra: (TIPOS_COMPRA as string[]).includes(tipo) ? tipo : null
    };
}

export function extraerProductores(compras: any[]): { id: number; nombre: string }[] {
    const mapa = new Map<number, string>();
    for (const compra of compras) {
        const id = idProductorDe(compra);
        const nombre = nombreProductorDe(compra);
        if (id && nombre) {
            mapa.set(id, nombre);
        }
    }
    return [...mapa.entries()]
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function usdDe(montoBs: number, tipoCambio: number): number {
    if (!tipoCambio) {
        return 0;
    }
    return roundMoney(toMoney(montoBs) / tipoCambio);
}

export function armarCuentaProveedor(compras: any[], pagos: any[], acopios: any[], filtro: FiltroCuentaProveedor = {}): {
    resumen: ResumenCuentaProveedor;
    kardex: LineaKardexProveedor[];
    inventario: LineaInventarioProveedor[];
} {
    const filtroProductor = filtro.id_productor && Number(filtro.id_productor) > 0 ? Number(filtro.id_productor) : null;
    const filtroTipo = filtro.tipo_compra ? String(filtro.tipo_compra).toUpperCase() : null;
    const comprasVigentes = compras.filter((c) => {
        if (String(c.estado) === ESTADO_COMPRA.ANULADA) {
            return false;
        }
        return pasaFiltroProductor(idProductorDe(c), filtroProductor) && pasaFiltroTipo(c, filtroTipo);
    });
    const pagosFiltrados = pagos.filter((p) => {
        const compra = p.compra || compras.find((c) => Number(c.id) === Number(p.id_compra)) || {};
        const idProductorPago = idProductorDe({ ...p, compra });
        if (!pasaFiltroProductor(idProductorPago, filtroProductor)) {
            return false;
        }
        return pasaFiltroTipo(compra, filtroTipo);
    });
    const acopiosFiltrados = (filtroProductor || filtroTipo) ? [] : acopios;
    const eventos: Omit<LineaKardexProveedor, 'saldo' | 'saldo_usd'>[] = [];

    let comprasTotal = 0;
    let serviciosTotal = 0;
    let comprasPorPagar = 0;
    let comprasUsd = 0;
    for (const compra of comprasVigentes) {
        const total = toMoney(compra.total);
        const saldo = toMoney(compra.saldo_pendiente);
        const servicio = esCompraServicio(compra);
        const tipoCompra = inferirTipoCompra(compra);
        const tipoCambio = tipoCambioDe(compra.tipo_cambio);
        const cargoUsd = tipoCompra === TIPO_COMPRA.CHALA
            ? (compra.total_usd != null ? toMoney(compra.total_usd) : usdDe(total, tipoCambio))
            : 0;
        if (servicio) {
            serviciosTotal = roundMoney(serviciosTotal + total);
        } else {
            comprasTotal = roundMoney(comprasTotal + total);
        }
        comprasPorPagar = roundMoney(comprasPorPagar + saldo);
        comprasUsd = roundMoney(comprasUsd + cargoUsd);
        eventos.push({
            fecha: fechaEvento(compra.fecha),
            tipo: servicio ? 'SERVICIO' : 'COMPRA',
            documento: `#${compra.id}`,
            detalle: detalleCompra(compra),
            productor: nombreProductorDe(compra),
            id_productor: idProductorDe(compra),
            boleta: textoCampo(compra.boleta),
            chofer: textoCampo(compra.chofer),
            placa: textoCampo(compra.placa),
            fanegas: tipoCompra === TIPO_COMPRA.CHALA ? fanegasDeCompra(compra) : 0,
            precio: precioDeCompra(compra),
            precio_usd: compra.precio_usd != null ? Number(compra.precio_usd) : 0,
            tipo_cambio: tipoCambio,
            cargo: total,
            abono: 0,
            cargo_usd: cargoUsd,
            abono_usd: 0
        });
    }

    let pagadoCompras = 0;
    let pagadoUsd = 0;
    for (const pago of pagosFiltrados) {
        const compraPago = pago.compra || compras.find((c) => c.id === pago.id_compra);
        const monto = toMoney(pago.monto);
        const tcPago = tipoCambioDe(compraPago?.tipo_cambio);
        const abonoUsd = usdDe(monto, tcPago);
        pagadoCompras = roundMoney(pagadoCompras + monto);
        pagadoUsd = roundMoney(pagadoUsd + abonoUsd);
        eventos.push({
            fecha: fechaEvento(pago.fecha),
            tipo: 'PAGO',
            documento: pago.id_compra ? `Compra #${pago.id_compra}` : `#${pago.id}`,
            detalle: String(pago.observacion || pago.referencia || 'Pago / amortización').trim(),
            productor: nombreProductorDe({ ...pago, compra: compraPago }),
            id_productor: idProductorDe({ ...pago, compra: compraPago }),
            boleta: '',
            chofer: '',
            placa: '',
            fanegas: 0,
            precio: 0,
            precio_usd: 0,
            tipo_cambio: tcPago,
            cargo: 0,
            abono: monto,
            cargo_usd: 0,
            abono_usd: abonoUsd
        });
    }

    let acopiosTotal = 0;
    let acopiosPagado = 0;
    for (const acopio of acopiosFiltrados) {
        const total = toMoney(acopio.total);
        const pagado = toMoney(acopio.pago);
        acopiosTotal = roundMoney(acopiosTotal + total);
        acopiosPagado = roundMoney(acopiosPagado + pagado);
        const desc = String(acopio.descripcion || 'Acopio').trim();
        eventos.push({
            fecha: fechaEvento(acopio.fecha),
            tipo: 'ACOPIO',
            documento: `#${acopio.id}`,
            detalle: desc,
            productor: '',
            id_productor: null,
            boleta: textoCampo(acopio.boleta),
            chofer: textoCampo(acopio.chofer),
            placa: textoCampo(acopio.placa),
            fanegas: toQty(acopio.fanegas != null && Number(acopio.fanegas) > 0 ? acopio.fanegas : acopio.cantidad),
            precio: toMoney(acopio.precio_unitario),
            precio_usd: 0,
            tipo_cambio: 0,
            cargo: total,
            abono: 0,
            cargo_usd: 0,
            abono_usd: 0
        });
        if (pagado > 0) {
            eventos.push({
                fecha: fechaEvento(acopio.fecha),
                tipo: 'PAGO ACOPIO',
                documento: `Acopio #${acopio.id}`,
                detalle: desc,
                productor: '',
                id_productor: null,
                boleta: '',
                chofer: '',
                placa: '',
                fanegas: 0,
                precio: 0,
                precio_usd: 0,
                tipo_cambio: 0,
                cargo: 0,
                abono: pagado,
                cargo_usd: 0,
                abono_usd: 0
            });
        }
    }

    eventos.sort((a, b) => {
        const ta = fechaEvento(a.fecha).getTime();
        const tb = fechaEvento(b.fecha).getTime();
        if (ta !== tb) {
            return ta - tb;
        }
        if (a.cargo !== b.cargo) {
            return b.cargo - a.cargo;
        }
        return a.tipo.localeCompare(b.tipo, 'es');
    });

    const hayPeriodo = Boolean(filtro.desde);
    const desdeMs = filtro.desde ? fechaEvento(filtro.desde).getTime() : null;
    const hastaMs = filtro.hasta ? fechaEvento(filtro.hasta).getTime() : null;
    const anteriores = hayPeriodo && desdeMs != null
        ? eventos.filter((e) => fechaEvento(e.fecha).getTime() < desdeMs)
        : [];
    const delPeriodo = eventos.filter((e) => {
        const t = fechaEvento(e.fecha).getTime();
        if (desdeMs != null && t < desdeMs) {
            return false;
        }
        if (hastaMs != null && t > hastaMs) {
            return false;
        }
        return true;
    });

    const saldoAnterior = roundMoney(anteriores.reduce((acc, e) => acc + e.cargo - e.abono, 0));
    const saldoAnteriorUsd = roundMoney(anteriores.reduce((acc, e) => acc + e.cargo_usd - e.abono_usd, 0));

    let saldo = saldoAnterior;
    let saldoUsd = saldoAnteriorUsd;
    const kardex: LineaKardexProveedor[] = [];
    if (hayPeriodo) {
        kardex.push({
            fecha: filtro.desde || new Date(),
            tipo: 'SALDO ANTERIOR',
            documento: '',
            detalle: 'Saldo anterior',
            productor: '',
            id_productor: null,
            boleta: '',
            chofer: '',
            placa: '',
            fanegas: 0,
            precio: 0,
            precio_usd: 0,
            tipo_cambio: 0,
            cargo: 0,
            abono: 0,
            cargo_usd: 0,
            abono_usd: 0,
            saldo: saldoAnterior,
            saldo_usd: saldoAnteriorUsd
        });
    }
    for (const linea of delPeriodo) {
        saldo = roundMoney(saldo + linea.cargo - linea.abono);
        saldoUsd = roundMoney(saldoUsd + linea.cargo_usd - linea.abono_usd);
        kardex.push({ ...linea, saldo, saldo_usd: saldoUsd });
    }

    const cargoPeriodo = roundMoney(delPeriodo.reduce((acc, e) => acc + e.cargo, 0));
    const abonoPeriodo = roundMoney(delPeriodo.reduce((acc, e) => acc + e.abono, 0));
    const comprasPeriodo = roundMoney(delPeriodo.filter((e) => e.tipo === 'COMPRA').reduce((acc, e) => acc + e.cargo, 0));
    const serviciosPeriodo = roundMoney(delPeriodo.filter((e) => e.tipo === 'SERVICIO').reduce((acc, e) => acc + e.cargo, 0));
    const pagosPeriodo = roundMoney(delPeriodo.filter((e) => e.tipo === 'PAGO').reduce((acc, e) => acc + e.abono, 0));
    const acopiosPeriodo = roundMoney(delPeriodo.filter((e) => e.tipo === 'ACOPIO').reduce((acc, e) => acc + e.cargo, 0));
    const acopiosPagadoPeriodo = roundMoney(delPeriodo.filter((e) => e.tipo === 'PAGO ACOPIO').reduce((acc, e) => acc + e.abono, 0));
    const comprasUsdPeriodo = roundMoney(delPeriodo.reduce((acc, e) => acc + e.cargo_usd, 0));
    const pagadoUsdPeriodo = roundMoney(delPeriodo.reduce((acc, e) => acc + e.abono_usd, 0));
    const porPagarAcopios = roundMoney(acopiosTotal - acopiosPagado);

    return {
        resumen: {
            compras: hayPeriodo ? comprasPeriodo : comprasTotal,
            servicios: hayPeriodo ? serviciosPeriodo : serviciosTotal,
            pagado_compras: hayPeriodo ? pagosPeriodo : pagadoCompras,
            por_pagar_compras: comprasPorPagar,
            acopios: hayPeriodo ? acopiosPeriodo : acopiosTotal,
            pagado_acopios: hayPeriodo ? acopiosPagadoPeriodo : acopiosPagado,
            por_pagar_acopios: porPagarAcopios,
            cargo: cargoPeriodo,
            abono: abonoPeriodo,
            saldo: roundMoney(saldoAnterior + cargoPeriodo - abonoPeriodo),
            compras_usd: hayPeriodo ? comprasUsdPeriodo : comprasUsd,
            pagado_usd: hayPeriodo ? pagadoUsdPeriodo : pagadoUsd,
            saldo_usd: roundMoney(saldoAnteriorUsd + delPeriodo.reduce((acc, e) => acc + e.cargo_usd - e.abono_usd, 0)),
            saldo_anterior: saldoAnterior,
            saldo_anterior_usd: saldoAnteriorUsd
        },
        kardex,
        inventario: armarInventarioProveedor(comprasVigentes, acopiosFiltrados)
    };
}
