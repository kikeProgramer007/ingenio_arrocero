import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import { ApiMensaje, Cliente, Cobranza, CrearVentaPayload, Venta } from './ventas.models';

@Injectable({ providedIn: 'root' })
export class ClientesService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string }): Observable<Cliente[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
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

    listar(filtros?: { estado?: string; id_cliente?: number }): Observable<Venta[]> {
        let params = new HttpParams();
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        if (filtros?.id_cliente) {
            params = params.set('id_cliente', String(filtros.id_cliente));
        }
        return this.http.get<Venta[]>(apiUrl('/api/ventas'), { params });
    }

    obtener(id: number): Observable<Venta> {
        return this.http.get<Venta>(apiUrl(`/api/ventas/${id}`));
    }

    crear(payload: CrearVentaPayload): Observable<ApiMensaje<Venta>> {
        return this.http.post<ApiMensaje<Venta>>(apiUrl('/api/ventas'), payload);
    }

    listarCobranzas(filtros?: { id_venta?: number; id_cliente?: number }): Observable<Cobranza[]> {
        let params = new HttpParams();
        if (filtros?.id_venta) {
            params = params.set('id_venta', String(filtros.id_venta));
        }
        if (filtros?.id_cliente) {
            params = params.set('id_cliente', String(filtros.id_cliente));
        }
        return this.http.get<Cobranza[]>(apiUrl('/api/cobranzas'), { params });
    }

    crearCobranza(payload: { id_venta: number; monto: number; metodo_pago: string; referencia?: string; observacion?: string }): Observable<ApiMensaje<Cobranza>> {
        return this.http.post<ApiMensaje<Cobranza>>(apiUrl('/api/cobranzas'), payload);
    }
}
