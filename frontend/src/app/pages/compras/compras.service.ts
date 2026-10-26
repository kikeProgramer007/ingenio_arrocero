import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import { ApiMensaje, Compra, CrearCompraPayload, CuentaProveedor, PagoProveedor, Productor, Proveedor } from './compras.models';

@Injectable({ providedIn: 'root' })
export class ProveedoresService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string; rol?: string }): Observable<Proveedor[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
        if (params?.rol) {
            httpParams = httpParams.set('rol', params.rol);
        }
        return this.http.get<Proveedor[]>(apiUrl('/api/proveedores'), { params: httpParams });
    }

    crear(payload: Omit<Proveedor, 'id'>): Observable<ApiMensaje<Proveedor>> {
        return this.http.post<ApiMensaje<Proveedor>>(apiUrl('/api/proveedores'), payload);
    }

    actualizar(id: number, payload: Omit<Proveedor, 'id'>): Observable<ApiMensaje<Proveedor>> {
        return this.http.put<ApiMensaje<Proveedor>>(apiUrl(`/api/proveedores/${id}`), payload);
    }

    cuenta(id: number, filtros?: { fecha_desde?: string; fecha_hasta?: string; tipo_compra?: string; ordenante?: string }): Observable<CuentaProveedor> {
        let httpParams = new HttpParams();
        if (filtros?.fecha_desde) {
            httpParams = httpParams.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            httpParams = httpParams.set('fecha_hasta', filtros.fecha_hasta);
        }
        if (filtros?.tipo_compra) {
            httpParams = httpParams.set('tipo_compra', filtros.tipo_compra);
        }
        if (filtros?.ordenante) {
            httpParams = httpParams.set('ordenante', filtros.ordenante);
        }
        return this.http.get<CuentaProveedor>(apiUrl(`/api/proveedores/${id}/cuenta`), { params: httpParams });
    }
}

@Injectable({ providedIn: 'root' })
export class ProductoresService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string; id_proveedor?: number; libres?: boolean }): Observable<Productor[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
        if (params?.id_proveedor) {
            httpParams = httpParams.set('id_proveedor', String(params.id_proveedor));
        }
        if (params?.libres === false) {
            httpParams = httpParams.set('libres', '0');
        }
        return this.http.get<Productor[]>(apiUrl('/api/productores'), { params: httpParams });
    }

    crear(payload: Omit<Productor, 'id'>): Observable<ApiMensaje<Productor>> {
        return this.http.post<ApiMensaje<Productor>>(apiUrl('/api/productores'), payload);
    }

    actualizar(id: number, payload: Omit<Productor, 'id'>): Observable<ApiMensaje<Productor>> {
        return this.http.put<ApiMensaje<Productor>>(apiUrl(`/api/productores/${id}`), payload);
    }

    eliminar(id: number): Observable<{ mensaje: string }> {
        return this.http.delete<{ mensaje: string }>(apiUrl(`/api/productores/${id}`));
    }
}

@Injectable({ providedIn: 'root' })
export class ComprasService {
    constructor(private http: HttpClient) {}

    listar(filtros?: { estado?: string; id_proveedor?: number; tipo_compra?: string; fecha_desde?: string; fecha_hasta?: string }): Observable<Compra[]> {
        let params = new HttpParams();
        if (filtros?.estado) {
            params = params.set('estado', filtros.estado);
        }
        if (filtros?.id_proveedor) {
            params = params.set('id_proveedor', String(filtros.id_proveedor));
        }
        if (filtros?.tipo_compra) {
            params = params.set('tipo_compra', filtros.tipo_compra);
        }
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        return this.http.get<Compra[]>(apiUrl('/api/compras'), { params });
    }

    obtener(id: number): Observable<Compra> {
        return this.http.get<Compra>(apiUrl(`/api/compras/${id}`));
    }

    crear(payload: CrearCompraPayload): Observable<ApiMensaje<Compra>> {
        return this.http.post<ApiMensaje<Compra>>(apiUrl('/api/compras'), payload);
    }

    recibir(id: number, lineas: { id_detalle?: number; cantidad: number }[]): Observable<ApiMensaje<Compra>> {
        return this.http.post<ApiMensaje<Compra>>(apiUrl(`/api/compras/${id}/recepciones`), { lineas });
    }

    listarPagos(filtros?: { id_compra?: number; id_proveedor?: number; metodo?: string; fecha_desde?: string; fecha_hasta?: string }): Observable<PagoProveedor[]> {
        let params = new HttpParams();
        if (filtros?.id_compra) {
            params = params.set('id_compra', String(filtros.id_compra));
        }
        if (filtros?.id_proveedor) {
            params = params.set('id_proveedor', String(filtros.id_proveedor));
        }
        if (filtros?.metodo) {
            params = params.set('metodo', filtros.metodo);
        }
        if (filtros?.fecha_desde) {
            params = params.set('fecha_desde', filtros.fecha_desde);
        }
        if (filtros?.fecha_hasta) {
            params = params.set('fecha_hasta', filtros.fecha_hasta);
        }
        return this.http.get<PagoProveedor[]>(apiUrl('/api/pagos'), { params });
    }

    crearPago(payload: { id_compra: number; monto: number; metodo_pago: string; monto_efectivo?: number; monto_qr?: number; referencia?: string; observacion?: string }): Observable<ApiMensaje<PagoProveedor>> {
        return this.http.post<ApiMensaje<PagoProveedor>>(apiUrl('/api/pagos'), payload);
    }
}
