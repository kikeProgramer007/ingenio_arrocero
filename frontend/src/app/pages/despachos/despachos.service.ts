import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../../core/utils/api-url';
import { Venta } from '../ventas/ventas.models';

export interface LineaDespacho {
    id_detalle: number;
    descripcion: string;
    unidad: string;
    cantidad: number;
    pendiente: number;
}
export interface Despacho {
    id: number;
    id_venta: number;
    fecha: string;
    persona_retira: string;
    chofer?: string;
    placa?: string;
    observacion?: string;
    usuario?: { nombre?: string; username?: string };
    lineas: LineaDespacho[];
}
export interface FiltroDespachos {
    id_cliente?: number;
    numero?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    estado_despacho?: string;
    sortField?: string;
    sortOrder?: 1 | -1;
}
export function etiquetaDespacho(estado?: string): string {
    return ({ PENDIENTE: 'Despacho pendiente', PARCIAL: 'Despacho parcial', COMPLETO: 'Completo', NO_APLICA: 'No aplica', ANULADA: 'Anulada', ANTERIOR: 'Anterior: por revisar' } as Record<string, string>)[estado || 'ANTERIOR'] || estado || '';
}
export function colorDespacho(estado?: string): 'success' | 'warn' | 'info' | 'secondary' {
    return estado === 'COMPLETO' ? 'success' : estado === 'PARCIAL' ? 'info' : estado === 'PENDIENTE' ? 'warn' : 'secondary';
}
@Injectable({ providedIn: 'root' })
export class DespachosService {
    constructor(private http: HttpClient) {}
    config() {
        return this.http.get<{ habilitado: boolean }>(apiUrl('/api/despachos/config'));
    }
    private params(filtros: object) {
        let params = new HttpParams();
        Object.entries(filtros).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
        });
        return params;
    }
    listar(filtros: FiltroDespachos, pagina = 1, limite = 10) {
        return this.http.get<{ data: Venta[]; total: number }>(apiUrl('/api/despachos'), { params: this.params({ ...filtros, pagina, limite }) });
    }
    crear(id: number, payload: object) {
        return this.http.post<{ data: Despacho; mensaje: string }>(apiUrl(`/api/despachos/ventas/${id}`), payload);
    }
    historial(id: number) {
        return this.http.get<Despacho[]>(apiUrl(`/api/despachos/ventas/${id}`));
    }
    reservas(id: number) {
        return this.http.get<any[]>(apiUrl(`/api/despachos/productos/${id}/reservas`));
    }
    nota(id: number) {
        return this.http.get(apiUrl(`/api/despachos/${id}/nota`), { responseType: 'blob' });
    }
    exportar(filtros: FiltroDespachos, formato: 'pdf' | 'xlsx') {
        return this.http.get(apiUrl('/api/despachos/exportar'), { params: this.params({ ...filtros, formato }), responseType: 'blob' });
    }
    descargar(blob: Blob, nombre: string) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
