import { Routes } from '@angular/router';
import { ProduccionBasePage } from './produccion-base';

export default [
    { path: '', pathMatch: 'full', redirectTo: 'resumen' },
    { path: 'descarguios', loadComponent: () => import('./descarguios').then(m => m.DescarguiosPage) },
    { path: 'descarguios/nuevo', loadComponent: () => import('./descarguio-form').then(m => m.DescarguioFormPage) },
    { path: 'descarguios/:id', loadComponent: () => import('./descarguio-form').then(m => m.DescarguioFormPage) },
    ...['secados','guardados'].flatMap(etapa => [
        { path: etapa, loadComponent: () => import('./produccion-etapas').then(m => m.ProduccionEtapasPage), data: { etapa } },
        { path: etapa+'/nuevo', loadComponent: () => import('./produccion-etapa-form').then(m => m.ProduccionEtapaFormPage), data: { etapa } },
        { path: etapa+'/:id', loadComponent: () => import('./produccion-etapa-form').then(m => m.ProduccionEtapaFormPage), data: { etapa } }
    ]),
    ...['procesados','envasados'].flatMap(etapa => [
        {path:etapa,loadComponent:()=>import('./produccion-transformaciones').then(m=>m.ProduccionTransformacionesPage),data:{etapa}},
        {path:etapa+'/nuevo',loadComponent:()=>import('./produccion-transformacion-form').then(m=>m.ProduccionTransformacionFormPage),data:{etapa}},
        {path:etapa+'/:id',loadComponent:()=>import('./produccion-transformacion-form').then(m=>m.ProduccionTransformacionFormPage),data:{etapa}}
    ]),
    {path:'lotes',loadComponent:()=>import('./produccion-consultas').then(m=>m.ProduccionConsultasPage)},
    {path:'lotes/:id',loadComponent:()=>import('./produccion-consultas').then(m=>m.ProduccionConsultasPage)},
    ...['resumen'].map(vista => ({
        path: vista, component: ProduccionBasePage, data: { vista }
    }))
] as Routes;
