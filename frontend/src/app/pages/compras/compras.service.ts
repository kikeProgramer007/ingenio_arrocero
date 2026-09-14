import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import { ApiMensaje, Compra, CrearCompraPayload, PagoProveedor, Proveedor } from './compras.models';

@Injectable({ providedIn: 'root' })
export class ProveedoresService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string }): Observable<Proveedor[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
        return this.http.get<Proveedor[]>(apiUrl('/api/proveedores'), { params: httpParams });
    }

    crear(payload: Omit<Proveedor, 'id'>): Observable<ApiMensaje<Proveedor>> {
        return this.http.post<ApiMensaje<Proveedor>>(apiUrl('/api/proveedores'), payload);
    }

    actualizar(id: number, payload: Omit<Proveedor, 'id'>): Observable<ApiMensaje<Proveedor>> {
        return this.http.put<ApiMensaje<Proveedor>>(apiUrl(`/api/proveedores/${id}`), payload);
    }
}

@Injectable({ providedIn: 'root' })
export class ComprasService {
    constructor(private http: HttpClient) {}

    listar(filtros?: { estado?: string; id_proveedor?: number }): Observable<Compra[]> {
        let params = new HttpParams();
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        if (filtros?.id_proveedor) {
            params = params.set('id_proveedor', String(filtros.id_proveedor));
        }
        return this.http.get<Compra[]>(apiUrl('/api/compras'), { params });
    }

    obtener(id: number): Observable<Compra> {
        return this.http.get<Compra>(apiUrl(`/api/compras/${id}`));
    }

    crear(payload: CrearCompraPayload): Observable<ApiMensaje<Compra>> {
        return this.http.post<ApiMensaje<Compra>>(apiUrl('/api/compras'), payload);
    }

    listarPagos(filtros?: { id_compra?: number; id_proveedor?: number }): Observable<PagoProveedor[]> {
        let params = new HttpParams();
        if (filtros?.id_compra) {
            params = params.set('id_compra', String(filtros.id_compra));
        }
        if (filtros?.id_proveedor) {
            params = params.set('id_proveedor', String(filtros.id_proveedor));
        }
        return this.http.get<PagoProveedor[]>(apiUrl('/api/pagos'), { params });
    }

    crearPago(payload: { id_compra: number; monto: number; metodo_pago: string; referencia?: string; observacion?: string }): Observable<ApiMensaje<PagoProveedor>> {
        return this.http.post<ApiMensaje<PagoProveedor>>(apiUrl('/api/pagos'), payload);
    }
}
