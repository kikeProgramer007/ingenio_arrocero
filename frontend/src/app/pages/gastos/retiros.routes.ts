import { Routes } from '@angular/router';
import { GastosPage } from './gastos';

export default [{ path: '', component: GastosPage, data: { tipo: 'RETIRO_PERSONAL', titulo: 'Retiros personales' } }] as Routes;
