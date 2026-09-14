import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import {
    AbrirCajaRequest,
    ApiMensaje,
    CajaDetalle,
    CerrarCajaRequest,
    ControlIngresosEgresos,
    CrearMovimientoRequest,
    DashboardResumen,
    MovimientoCaja
} from './caja.models';

@Injectable({
    providedIn: 'root'
})
export class CajaService {
    constructor(private http: HttpClient) {}

    obtenerAbierta(): Observable<CajaDetalle | null> {
        return this.http.get<CajaDetalle | null>(apiUrl('/api/cajas/abierta'));
    }

    abrir(payload: AbrirCajaRequest): Observable<ApiMensaje<CajaDetalle>> {
        return this.http.post<ApiMensaje<CajaDetalle>>(apiUrl('/api/cajas'), payload);
    }

    historial(filtros?: { fecha_desde?: string; fecha_hasta?: string; estado?: string }): Observable<CajaDetalle[]> {
        let params = new HttpParams();
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        return this.http.get<CajaDetalle[]>(apiUrl('/api/cajas/historial'), { params });
    }

    obtenerPorId(id: number): Observable<CajaDetalle> {
        return this.http.get<CajaDetalle>(apiUrl(`/api/cajas/${id}`));
    }

    cerrar(id: number, payload: CerrarCajaRequest): Observable<ApiMensaje<CajaDetalle>> {
        return this.http.put<ApiMensaje<CajaDetalle>>(apiUrl(`/api/cajas/${id}/cerrar`), payload);
    }

    listarMovimientos(id: number): Observable<MovimientoCaja[]> {
        return this.http.get<MovimientoCaja[]>(apiUrl(`/api/cajas/${id}/movimientos`));
    }

    crearMovimiento(id: number, payload: CrearMovimientoRequest): Observable<ApiMensaje<MovimientoCaja>> {
        return this.http.post<ApiMensaje<MovimientoCaja>>(apiUrl(`/api/cajas/${id}/movimientos`), payload);
    }

    resumenDashboard(): Observable<DashboardResumen> {
        return this.http.get<DashboardResumen>(apiUrl('/api/dashboard/resumen'));
    }

    controlIngresosEgresos(filtros?: { fecha_desde?: string; fecha_hasta?: string }): Observable<ControlIngresosEgresos> {
        let params = new HttpParams();
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        return this.http.get<ControlIngresosEgresos>(apiUrl('/api/dashboard/movimientos'), { params });
    }
}
