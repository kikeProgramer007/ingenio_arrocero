import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import { comoLista, parametrosLista } from '../../shared/utils/filtro-lista';
import { ApiMensaje, Cliente, Cobranza, CrearVentaPayload, Venta } from './ventas.models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string; procedencia?: string | string[] }): Observable<Cliente[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
        httpParams = parametrosLista(httpParams, 'procedencia', Array.isArray(params?.procedencia) ? params?.procedencia : params?.procedencia ? [params.procedencia] : undefined);
        return this.http.get<Cliente[]>(apiUrl('/api/clientes'), { params: httpParams });
    }

    crear(payload: Partial<Cliente>): Observable<ApiMensaje<Cliente>> {
        return this.http.post<ApiMensaje<Cliente>>(apiUrl('/api/clientes'), payload);
    }

    actualizar(id: number, payload: Partial<Cliente>): Observable<ApiMensaje<Cliente>> {
        return this.http.put<ApiMensaje<Cliente>>(apiUrl(`/api/clientes/${id}`), payload);
    }
}

@Injectable({ providedIn: 'root' })
export class VentasService {
    constructor(private http: HttpClient) {}

    listar(filtros?: { estado?: string | string[]; id_cliente?: number | number[]; fecha_desde?: string; fecha_hasta?: string }): Observable<Venta[]> {
        let params = new HttpParams();
        params = parametrosLista(params, 'estado', comoLista(filtros?.estado));
        params = parametrosLista(params, 'id_cliente', comoLista(filtros?.id_cliente));
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        return this.http.get<Venta[]>(apiUrl('/api/ventas'), { params });
    }

    obtener(id: number): Observable<Venta> {
        return this.http.get<Venta>(apiUrl(`/api/ventas/${id}`));
    }

    crear(payload: CrearVentaPayload): Observable<ApiMensaje<Venta>> {
        return this.http.post<ApiMensaje<Venta>>(apiUrl('/api/ventas'), payload);
    }

    anular(id: number, motivo: string): Observable<ApiMensaje<Venta>> {
        return this.http.put<ApiMensaje<Venta>>(apiUrl(`/api/ventas/${id}/anular`), { motivo });
    }

    editar(id: number, payload: { motivo: string; lineas: any[]; a_credito?: boolean; plazo_dias?: number; cobrar_diferencia?: boolean; metodo_pago?: string; monto_efectivo?: number; monto_qr?: number }): Observable<ApiMensaje<Venta>> {
        return this.http.put<ApiMensaje<Venta>>(apiUrl(`/api/ventas/${id}`), payload);
    }

    listarCobranzas(filtros?: { id_venta?: number; id_cliente?: number | number[]; metodo?: string | string[]; fecha_desde?: string; fecha_hasta?: string }): Observable<Cobranza[]> {
        let params = new HttpParams();
        if (filtros?.id_venta) {
            params = params.set('id_venta', String(filtros.id_venta));
        }
        params = parametrosLista(params, 'id_cliente', comoLista(filtros?.id_cliente));
        params = parametrosLista(params, 'metodo', comoLista(filtros?.metodo));
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        return this.http.get<Cobranza[]>(apiUrl('/api/cobranzas'), { params });
    }

    crearCobranza(payload: { id_venta: number; monto: number; metodo_pago: string; monto_efectivo?: number; monto_qr?: number; referencia?: string; observacion?: string }): Observable<ApiMensaje<Cobranza>> {
        return this.http.post<ApiMensaje<Cobranza>>(apiUrl('/api/cobranzas'), payload);
    }
}
