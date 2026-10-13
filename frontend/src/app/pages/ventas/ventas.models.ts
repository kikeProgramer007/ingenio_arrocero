export const PROCEDENCIAS_CLIENTE = ['La Paz', 'Cochabamba', 'Oruro', 'Otras'] as const;

export interface Cliente {
    id: number;
    nombre: string;
    nit_ci?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    procedencia?: string | null;
    observacion?: string | null;
    activo: boolean;
    path_imagen?: string | null;
}

export interface LineaVenta {
    unidad?: string;
    entregado?: number | null;
    pendiente?: number | null;
    entregar_ahora?: number;
    id?: number;
    descripcion: string;
    id_producto?: number | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}

export interface Venta {
    estado_despacho?: string;
    id: number;
    id_cliente: number;
    fecha: string;
    total: number;
    saldo_pendiente: number;
    pagado: number;
    estado: string;
    observacion?: string | null;
    plazo_dias?: number | null;
    fecha_vencimiento?: string | null;
    vencida?: boolean;
    dias_vencimiento?: number | null;
    dias_atraso?: number | null;
    situacion?: string;
    cliente: { id: number; nombre: string } | null;
    usuario: { id: number; username: string; nombre?: string | null } | null;
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
    monto_efectivo?: number;
    monto_qr?: number;
    referencia?: string | null;
    observacion?: string | null;
    fecha: string;
    cliente?: { id: number; nombre: string } | null;
    venta?: { id: number; total: number; saldo_pendiente?: number; estado: string } | null;
    usuario?: { id: number; username: string; nombre?: string | null } | null;
}

export interface CrearVentaPayload {
    entrega?: string;
    clave?: string;
    persona_retira?: string;
    id_cliente: number;
    observacion?: string;
    lineas: { descripcion?: string; cantidad: number; precio_unitario: number; id_producto?: number; entregar_ahora?: number }[];
    pago_inicial?: number;
    metodo_pago?: string;
    monto_efectivo?: number;
    monto_qr?: number;
    referencia?: string;
    plazo_dias?: number;
    fecha_vencimiento?: string;
}

export interface ApiMensaje<T> {
    mensaje: string;
    data: T;
}
