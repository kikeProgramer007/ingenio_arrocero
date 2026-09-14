import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { AuthGuard } from './app/core/guard/auth.guard';

export const appRoutes: Routes = [
    { path: '', loadChildren: () => import('./app/pages/auth/auth.routes')},
    {
        path: '',
        component: AppLayout,
        children: [
            { path: 'dashboard', component: Dashboard, canActivate: [AuthGuard] },
            { path: 'caja', loadChildren: () => import('./app/pages/caja/caja.routes'), canActivate: [AuthGuard] },
            { path: 'clientes', loadChildren: () => import('./app/pages/ventas/clientes.routes'), canActivate: [AuthGuard] },
            { path: 'ventas', loadChildren: () => import('./app/pages/ventas/ventas.routes'), canActivate: [AuthGuard] },
            { path: 'cobranzas', loadChildren: () => import('./app/pages/ventas/cobranzas.routes'), canActivate: [AuthGuard] },
            { path: 'proveedores', loadChildren: () => import('./app/pages/compras/proveedores.routes'), canActivate: [AuthGuard] },
            { path: 'compras', loadChildren: () => import('./app/pages/compras/compras.routes'), canActivate: [AuthGuard] },
            { path: 'pagos', loadChildren: () => import('./app/pages/compras/pagos.routes'), canActivate: [AuthGuard] },
            { path: 'gastos', loadChildren: () => import('./app/pages/gastos/gastos.routes'), canActivate: [AuthGuard] },
            { path: 'retiros', loadChildren: () => import('./app/pages/gastos/retiros.routes'), canActivate: [AuthGuard] },
            { path: 'inventario', loadChildren: () => import('./app/pages/inventario/inventario.routes'), canActivate: [AuthGuard] },
            { path: 'campanas', loadChildren: () => import('./app/pages/campanas/campanas.routes'), canActivate: [AuthGuard] },
            { path: 'produccion', loadChildren: () => import('./app/pages/produccion/produccion.routes'), canActivate: [AuthGuard] },
            { path: 'reportes', loadChildren: () => import('./app/pages/reportes/reportes.routes'), canActivate: [AuthGuard] },
            { path: 'ingresos-egresos', loadChildren: () => import('./app/pages/finanzas/ingresos-egresos.routes'), canActivate: [AuthGuard] },
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') ,canActivate:[AuthGuard] },
            { path: 'documentation', component: Documentation,canActivate:[AuthGuard]  },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes'),canActivate:[AuthGuard] }
        ]
    },
    { path: 'landing', component: Landing, canActivate: [AuthGuard]  },
    { path: 'notfound', component: Notfound, canActivate: [AuthGuard] },
   
    { path: '**', redirectTo: '/notfound'}
];
