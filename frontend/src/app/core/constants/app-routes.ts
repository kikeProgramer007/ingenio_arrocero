/**
 * URLs de menú / Angular. Deben coincidir con backend/src/constants/app-rutas.ts
 * y con el seed de programas.
 */
export const APP_ROUTES = {
    login: '/',
    dashboard: '/dashboard',
    caja: '/caja',
    cajaHistorial: '/caja/historial',
    clientes: '/clientes',
    ventas: '/ventas',
    cobranzas: '/cobranzas',
    proveedores: '/proveedores',
    compras: '/compras',
    pagos: '/pagos',
    gastos: '/gastos',
    retiros: '/retiros',
    ingresosEgresos: '/ingresos-egresos',
    inventario: '/inventario',
    campanas: '/campanas',
    produccion: '/produccion',
    reportes: '/reportes'
} as const;
