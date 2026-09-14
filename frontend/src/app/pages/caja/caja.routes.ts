import { Routes } from '@angular/router';
import { CajaActual } from './caja-actual';
import { CajaHistorial } from './caja-historial';

export default [
    { path: '', component: CajaActual },
    { path: 'historial', component: CajaHistorial }
] as Routes;
