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

export interface LineaCompra {
    id?: number;
    descripcion: string;
    id_producto?: number | null;
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
    es_servicio?: boolean;
    proveedor: { id: number; nombre: string } | null;
    usuario: { id: number; username: string } | null;
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
    compra?: { id: number; total: number; saldo_pendiente?: number; pagado?: number; estado: string } | null;
    usuario?: { id: number; username: string } | null;
}

export interface CrearCompraPayload {
    id_proveedor: number;
    fecha?: string;
    observacion?: string;
    concepto?: string;
    boleta?: string;
    chofer?: string;
    placa?: string;
    fanegas?: number;
    lineas: { descripcion?: string; cantidad: number; precio_unitario: number; id_producto?: number }[];
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
    boleta?: string;
    chofer?: string;
    placa?: string;
    fanegas?: number;
    precio?: number;
    cargo: number;
    abono: number;
    saldo: number;
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
    };
    kardex: LineaKardexProveedor[];
    inventario: LineaInventarioProveedor[];
    compras: { id: number; fecha: string; total: number; pagado: number; saldo_pendiente: number; estado: string; es_servicio?: boolean; observacion?: string | null }[];
    pagos: { id: number; fecha: string; id_compra: number; monto: number; metodo_pago: string; referencia?: string | null }[];
    acopios: { id: number; fecha: string; descripcion: string; cantidad: number; total: number; pago: number; saldo: number; campana: { id: number; nombre: string } | null }[];
}
