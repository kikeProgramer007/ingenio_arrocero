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
    referencia?: string | null;
    observacion?: string | null;
    fecha: string;
    proveedor?: { id: number; nombre: string } | null;
    compra?: { id: number; total: number; saldo_pendiente?: number; pagado?: number; estado: string } | null;
    usuario?: { id: number; username: string } | null;
}

export interface CrearCompraPayload {
    id_proveedor: number;
    observacion?: string;
    lineas: { descripcion?: string; cantidad: number; precio_unitario: number; id_producto?: number }[];
    pago_inicial?: number;
    metodo_pago?: string;
    referencia?: string;
}

export interface ApiMensaje<T> {
    mensaje: string;
    data: T;
}
