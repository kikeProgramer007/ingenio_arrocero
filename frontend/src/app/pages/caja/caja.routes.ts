import { Routes } from '@angular/router';
import { CajaActual } from './caja-actual';
import { CajaChica } from './caja-chica';
import { CajaHistorial } from './caja-historial';

export default [
    { path: '', component: CajaActual },
    { path: 'historial', component: CajaHistorial },
    { path: 'chica', component: CajaChica }
] as Routes;
