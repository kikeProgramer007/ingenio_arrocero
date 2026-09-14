/**
 * URLs de programas/menú. Deben coincidir con frontend APP_ROUTES.
 */
export const APP_RUTAS = {
    DASHBOARD: '/dashboard',
    CAJA: '/caja',
    CAJA_HISTORIAL: '/caja/historial',
    CLIENTES: '/clientes',
    VENTAS: '/ventas',
    COBRANZAS: '/cobranzas',
    PROVEEDORES: '/proveedores',
    COMPRAS: '/compras',
    PAGOS: '/pagos',
    GASTOS: '/gastos',
    RETIROS: '/retiros',
    INGRESOS_EGRESOS: '/ingresos-egresos',
    INVENTARIO: '/inventario',
    CAMPANAS: '/campanas',
    PRODUCCION: '/produccion',
    REPORTES: '/reportes'
} as const;

export const PROGRAMAS_SEED = [
    {
        nombre_programa: 'Dashboard',
        url: APP_RUTAS.DASHBOARD,
        class_icon: 'pi pi-home',
        es_expandible: false,
        nro_posicion: 1
    },
    {
        nombre_programa: 'Ingresos y egresos',
        url: APP_RUTAS.INGRESOS_EGRESOS,
        class_icon: 'pi pi-arrows-h',
        es_expandible: false,
        nro_posicion: 10
    },
    {
        nombre_programa: 'Caja actual',
        url: APP_RUTAS.CAJA,
        class_icon: 'pi pi-wallet',
        es_expandible: false,
        nro_posicion: 20
    },
    {
        nombre_programa: 'Historial de cajas',
        url: APP_RUTAS.CAJA_HISTORIAL,
        class_icon: 'pi pi-history',
        es_expandible: false,
        nro_posicion: 21
    },
    {
        nombre_programa: 'Clientes',
        url: APP_RUTAS.CLIENTES,
        class_icon: 'pi pi-users',
        es_expandible: false,
        nro_posicion: 30
    },
    {
        nombre_programa: 'Ventas',
        url: APP_RUTAS.VENTAS,
        class_icon: 'pi pi-shopping-cart',
        es_expandible: false,
        nro_posicion: 31
    },
    {
        nombre_programa: 'Cobranzas',
        url: APP_RUTAS.COBRANZAS,
        class_icon: 'pi pi-money-bill',
        es_expandible: false,
        nro_posicion: 32
    },
    {
        nombre_programa: 'Proveedores',
        url: APP_RUTAS.PROVEEDORES,
        class_icon: 'pi pi-truck',
        es_expandible: false,
        nro_posicion: 40
    },
    {
        nombre_programa: 'Compras',
        url: APP_RUTAS.COMPRAS,
        class_icon: 'pi pi-box',
        es_expandible: false,
        nro_posicion: 41
    },
    {
        nombre_programa: 'Pagos a proveedores',
        url: APP_RUTAS.PAGOS,
        class_icon: 'pi pi-send',
        es_expandible: false,
        nro_posicion: 42
    },
    {
        nombre_programa: 'Gastos de empresa',
        url: APP_RUTAS.GASTOS,
        class_icon: 'pi pi-briefcase',
        es_expandible: false,
        nro_posicion: 50
    },
    {
        nombre_programa: 'Retiros personales',
        url: APP_RUTAS.RETIROS,
        class_icon: 'pi pi-user',
        es_expandible: false,
        nro_posicion: 51
    },
    {
        nombre_programa: 'Inventario',
        url: APP_RUTAS.INVENTARIO,
        class_icon: 'pi pi-th-large',
        es_expandible: false,
        nro_posicion: 60
    },
    {
        nombre_programa: 'Campañas de acopio',
        url: APP_RUTAS.CAMPANAS,
        class_icon: 'pi pi-sun',
        es_expandible: false,
        nro_posicion: 70
    },
    {
        nombre_programa: 'Producción',
        url: APP_RUTAS.PRODUCCION,
        class_icon: 'pi pi-cog',
        es_expandible: false,
        nro_posicion: 71
    },
    {
        nombre_programa: 'Reportes',
        url: APP_RUTAS.REPORTES,
        class_icon: 'pi pi-chart-bar',
        es_expandible: false,
        nro_posicion: 80
    }
];
