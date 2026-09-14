export interface Cliente {
    id: number;
    nombre: string;
    nit_ci?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    observacion?: string | null;
    activo: boolean;
    path_imagen?: string | null;
}

export interface LineaVenta {
    id?: number;
    descripcion: string;
    id_producto?: number | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}

export interface Venta {
    id: number;
    id_cliente: number;
    fecha: string;
    total: number;
    saldo_pendiente: number;
    pagado: number;
    estado: string;
    observacion?: string | null;
    cliente: { id: number; nombre: string } | null;
    usuario: { id: number; username: string } | null;
    detalles?: LineaVenta[];
    cobranzas?: Cobranza[];
}

export interface Cobranza {
    id: number;
    id_venta: number;
    id_cliente: number;
    id_caja: number;
    monto: number;
    metodo_pago: string;
    referencia?: string | null;
    observacion?: string | null;
    fecha: string;
    cliente?: { id: number; nombre: string } | null;
    venta?: { id: number; total: number; saldo_pendiente?: number; estado: string } | null;
    usuario?: { id: number; username: string } | null;
}

export interface CrearVentaPayload {
    id_cliente: number;
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
