import { ESTADO_COMPRA } from '../constants/compra.constants';
import { toQty } from './inventario';
import { roundMoney, toMoney } from './money';

export type TipoKardexProveedor = 'COMPRA' | 'SERVICIO' | 'PAGO' | 'ACOPIO' | 'PAGO ACOPIO';

export interface LineaKardexProveedor {
    fecha: Date | string;
    tipo: TipoKardexProveedor;
    documento: string;
    detalle: string;
    boleta: string;
    chofer: string;
    placa: string;
    fanegas: number;
    precio: number;
    cargo: number;
    abono: number;
    saldo: number;
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
                unidad: unidad.trim() || 'kg',
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
            const unidad = String(detalle.producto?.unidad_medida || 'kg');
            const linea = fila(detalle.id_producto, nombre, unidad);
            linea.compras = toQty(linea.compras + toQty(detalle.cantidad));
        }
    }

    for (const acopio of acopios) {
        const nombre = String(acopio.producto?.nombre || acopio.descripcion || 'Acopio');
        const unidad = String(acopio.producto?.unidad_medida || 'kg');
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

export function armarCuentaProveedor(compras: any[], pagos: any[], acopios: any[]): {
    resumen: ResumenCuentaProveedor;
    kardex: LineaKardexProveedor[];
    inventario: LineaInventarioProveedor[];
} {
    const comprasVigentes = compras.filter((c) => String(c.estado) !== ESTADO_COMPRA.ANULADA);
    const eventos: Omit<LineaKardexProveedor, 'saldo'>[] = [];

    let comprasTotal = 0;
    let serviciosTotal = 0;
    let comprasPorPagar = 0;
    for (const compra of comprasVigentes) {
        const total = toMoney(compra.total);
        const saldo = toMoney(compra.saldo_pendiente);
        const servicio = esCompraServicio(compra);
        if (servicio) {
            serviciosTotal = roundMoney(serviciosTotal + total);
        } else {
            comprasTotal = roundMoney(comprasTotal + total);
        }
        comprasPorPagar = roundMoney(comprasPorPagar + saldo);
        eventos.push({
            fecha: fechaEvento(compra.fecha),
            tipo: servicio ? 'SERVICIO' : 'COMPRA',
            documento: `#${compra.id}`,
            detalle: detalleCompra(compra),
            boleta: textoCampo(compra.boleta),
            chofer: textoCampo(compra.chofer),
            placa: textoCampo(compra.placa),
            fanegas: fanegasDeCompra(compra),
            precio: precioDeCompra(compra),
            cargo: total,
            abono: 0
        });
    }

    let pagadoCompras = 0;
    for (const pago of pagos) {
        const monto = toMoney(pago.monto);
        pagadoCompras = roundMoney(pagadoCompras + monto);
        eventos.push({
            fecha: fechaEvento(pago.fecha),
            tipo: 'PAGO',
            documento: pago.id_compra ? `Compra #${pago.id_compra}` : `#${pago.id}`,
            detalle: String(pago.observacion || pago.referencia || 'Pago').trim(),
            boleta: '',
            chofer: '',
            placa: '',
            fanegas: 0,
            precio: 0,
            cargo: 0,
            abono: monto
        });
    }

    let acopiosTotal = 0;
    let acopiosPagado = 0;
    for (const acopio of acopios) {
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
            boleta: textoCampo(acopio.boleta),
            chofer: textoCampo(acopio.chofer),
            placa: textoCampo(acopio.placa),
            fanegas: toQty(acopio.fanegas != null && Number(acopio.fanegas) > 0 ? acopio.fanegas : acopio.cantidad),
            precio: toMoney(acopio.precio_unitario),
            cargo: total,
            abono: 0
        });
        if (pagado > 0) {
            eventos.push({
                fecha: fechaEvento(acopio.fecha),
                tipo: 'PAGO ACOPIO',
                documento: `Acopio #${acopio.id}`,
                detalle: desc,
                boleta: '',
                chofer: '',
                placa: '',
                fanegas: 0,
                precio: 0,
                cargo: 0,
                abono: pagado
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

    let saldo = 0;
    const kardex: LineaKardexProveedor[] = eventos.map((linea) => {
        saldo = roundMoney(saldo + linea.cargo - linea.abono);
        return { ...linea, saldo };
    });

    const cargo = roundMoney(comprasTotal + serviciosTotal + acopiosTotal);
    const abono = roundMoney(pagadoCompras + acopiosPagado);
    const porPagarAcopios = roundMoney(acopiosTotal - acopiosPagado);

    return {
        resumen: {
            compras: comprasTotal,
            servicios: serviciosTotal,
            pagado_compras: pagadoCompras,
            por_pagar_compras: comprasPorPagar,
            acopios: acopiosTotal,
            pagado_acopios: acopiosPagado,
            por_pagar_acopios: porPagarAcopios,
            cargo,
            abono,
            saldo: roundMoney(cargo - abono)
        },
        kardex,
        inventario: armarInventarioProveedor(compras, acopios)
    };
}
