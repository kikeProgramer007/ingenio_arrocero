export interface Productor {
    id: number;
    id_proveedor?: number | null;
    nombre: string;
    nit_ci?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    observacion?: string | null;
    activo: boolean;
    path_imagen?: string | null;
}

export interface Proveedor {
    id: number;
    nombre: string;
    nit_ci?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    observacion?: string | null;
    activo: boolean;
    path_imagen?: string | null;
}

export type TipoCompra = 'CHALA' | 'BOLSAS' | 'OTROS';

export interface LineaCompra {
    id?: number;
    descripcion: string;
    id_producto?: number | null;
    unidad?: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}

export interface Compra {
    id: number;
    id_proveedor: number;
    fecha: string;
    total: number;
    saldo_pendiente: number;
    pagado: number;
    estado: string;
    observacion?: string | null;
    concepto?: string | null;
    boleta?: string | null;
    chofer?: string | null;
    placa?: string | null;
    fanegas?: number | null;
    tipo_compra?: TipoCompra | string | null;
    tipo_cambio?: number | null;
    total_usd?: number | null;
    precio_usd?: number | null;
    es_servicio?: boolean;
    id_productor?: number | null;
    plazo_dias?: number | null;
    fecha_vencimiento?: string | null;
    productor?: { id: number; nombre: string } | null;
    proveedor: { id: number; nombre: string } | null;
    usuario: { id: number; username: string; nombre?: string | null } | null;
    detalles?: LineaCompra[];
    pagos?: PagoProveedor[];
}

export interface PagoProveedor {
    id: number;
    id_compra: number;
    id_proveedor: number;
    id_caja: number;
    monto: number;
    metodo_pago: string;
    monto_efectivo?: number;
    monto_qr?: number;
    referencia?: string | null;
    observacion?: string | null;
    fecha: string;
    proveedor?: { id: number; nombre: string } | null;
    monto_usd?: number | null;
    compra?: {
        id: number;
        total: number;
        saldo_pendiente?: number;
        pagado?: number;
        estado: string;
        tipo_compra?: string | null;
        tipo_cambio?: number | null;
        total_usd?: number | null;
    } | null;
    usuario?: { id: number; username: string; nombre?: string | null } | null;
}

export interface CrearCompraPayload {
    id_proveedor: number;
    id_productor?: number;
    fecha?: string;
    observacion?: string;
    concepto?: string;
    tipo_compra?: TipoCompra;
    boleta?: string;
    chofer?: string;
    placa?: string;
    fanegas?: number;
    precio_usd?: number;
    tipo_cambio?: number;
    guardar_tipo_cambio_empresa?: boolean;
    lineas: { descripcion?: string; cantidad: number; precio_unitario: number; id_producto?: number; unidad?: string }[];
    plazo_dias?: number;
    fecha_vencimiento?: string;
    pago_inicial?: number;
    metodo_pago?: string;
    monto_efectivo?: number;
    monto_qr?: number;
    referencia?: string;
}

export interface ApiMensaje<T> {
    mensaje: string;
    data: T;
}

export interface LineaInventarioProveedor {
    id_producto: number | null;
    producto: string;
    unidad: string;
    compras: number;
    acopio: number;
    entregado: number;
}

export interface LineaKardexProveedor {
    fecha: string;
    tipo: string;
    documento: string;
    detalle: string;
    productor?: string;
    id_productor?: number | null;
    boleta?: string;
    chofer?: string;
    placa?: string;
    fanegas?: number;
    precio?: number;
    precio_usd?: number;
    tipo_cambio?: number;
    cargo: number;
    abono: number;
    cargo_usd?: number;
    abono_usd?: number;
    saldo: number;
    saldo_usd?: number;
}

export interface CuentaProveedor {
    proveedor: Proveedor;
    resumen: {
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
        compras_usd?: number;
        pagado_usd?: number;
        saldo_usd?: number;
        saldo_anterior?: number;
        saldo_anterior_usd?: number;
    };
    productores?: { id: number; nombre: string }[];
    kardex: LineaKardexProveedor[];
    inventario: LineaInventarioProveedor[];
    compras: { id: number; fecha: string; total: number; pagado: number; saldo_pendiente: number; estado: string; es_servicio?: boolean; observacion?: string | null }[];
    pagos: { id: number; fecha: string; id_compra: number; monto: number; metodo_pago: string; referencia?: string | null }[];
    acopios: { id: number; fecha: string; descripcion: string; cantidad: number; total: number; pago: number; saldo: number; campana: { id: number; nombre: string } | null }[];
}
