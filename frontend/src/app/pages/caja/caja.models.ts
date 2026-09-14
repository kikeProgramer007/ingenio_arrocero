export interface UsuarioCaja {
    id: number;
    username: string;
}

export interface MovimientoCaja {
    id: number;
    id_caja: number;
    tipo: 'INGRESO' | 'EGRESO';
    categoria: string;
    concepto: string;
    monto: number;
    ingreso: number;
    egreso: number;
    metodo_pago: string;
    referencia?: string | null;
    observacion?: string | null;
    origen: string;
    origen_id?: number | null;
    fecha: string;
    usuario: UsuarioCaja | null;
}

export interface CajaDetalle {
    id: number;
    fecha_apertura: string;
    fecha_cierre: string | null;
    estado: 'ABIERTA' | 'CERRADA';
    observacion?: string | null;
    saldo_inicial: number;
    ingresos: number;
    egresos: number;
    saldo_esperado: number;
    desglose?: {
        cobrado_clientes: number;
        otros_ingresos: number;
        pagos_proveedor: number;
        gastos_empresa: number;
        retiros: number;
        otros_egresos: number;
    };
    por_cobrar?: number;
    por_pagar?: number;
    saldo_contado: number | null;
    diferencia: number | null;
    resultado_arqueo: 'CUADRE' | 'FALTANTE' | 'SOBRANTE' | null;
    usuario_apertura: UsuarioCaja | null;
    usuario_cierre: UsuarioCaja | null;
    movimientos?: MovimientoCaja[];
}

export interface AbrirCajaRequest {
    saldo_inicial: number;
    observacion?: string;
}

export interface CerrarCajaRequest {
    saldo_contado: number;
    observacion?: string;
}

export interface CrearMovimientoRequest {
    tipo: string;
    categoria: string;
    concepto: string;
    monto: number;
    metodo_pago: string;
    referencia?: string;
    observacion?: string;
}

export interface MovimientoResumen {
    id: number;
    fecha: string;
    tipo: 'INGRESO' | 'EGRESO';
    origen: string;
    categoria: string;
    concepto: string;
    contraparte?: string;
    metodo_pago?: string;
    ingreso?: number;
    egreso?: number;
    monto: number;
    usuario: UsuarioCaja | null;
}

export interface DashboardResumen {
    ventas_hoy: number;
    cobrado_hoy: number;
    por_cobrar: number;
    por_pagar: number;
    ingresos_hoy: number;
    egresos_hoy: number;
    saldo_neto: number;
    saldo_inicial: number;
    saldo_esperado: number;
    egresos_por_tipo: Record<string, number>;
    caja: {
        id: number | null;
        estado: 'ABIERTA' | 'CERRADA';
        fecha_apertura: string | null;
        usuario_apertura: UsuarioCaja | null;
    };
    cuentas_pendientes: Array<{
        id: number;
        fecha: string;
        cliente: { id: number; nombre: string } | null;
        total: number;
        cobrado: number;
        pendiente: number;
        estado: string;
    }>;
    ingresos_recientes: MovimientoResumen[];
    egresos_recientes: MovimientoResumen[];
    movimientos_recientes: MovimientoResumen[];
}

export interface ControlIngresosEgresos {
    fecha_desde: string;
    fecha_hasta: string;
    total_ingresos: number;
    total_egresos: number;
    saldo_neto: number;
    cobrado: number;
    por_cobrar: number;
    movimientos: MovimientoResumen[];
}

export interface ApiMensaje<T> {
    mensaje: string;
    data: T;
}
