import { Routes } from '@angular/router';
import { GastosPage } from './gastos';

export default [{ path: '', component: GastosPage, data: { tipo: 'GASTO_EMPRESA', titulo: 'Gastos de empresa' } }] as Routes;
