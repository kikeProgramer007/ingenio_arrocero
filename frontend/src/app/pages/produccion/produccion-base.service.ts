import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../../core/utils/api-url';

export interface ConsultaProduccion {
    fecha_desde?: string; fecha_hasta?: string; modalidad?: string; id_productor?: number;
    tipo?: string; buscar?: string; offset?: number; limit?: number; orden?: string; direccion?: number;
}
export interface FilaProduccion {
    id: number; codigo: string; fecha: string; tipo?: string; modalidad: string; estado: string;
    productor: string | null; propietario: string | null; cantidades?: { cantidad: number; unidad: string }[];
    producto?: string; variedad?: string | null; cantidad_inicial?: number; cantidad_disponible?: number;
    unidad?: string; etapa?: string; ubicacion?: string | null; ubicacion_detalle?: string | null;
}
export interface ResumenProduccion {
    indicadores: { descarguios_por_secar: number; secados_por_guardar: number; lotes_almacenados: number; procesados: number; pendientes: number };
    chala: { modalidad: string; unidad: string; cantidad: number }[];
}
@Injectable({ providedIn: 'root' })
export class ProduccionBaseService {
    constructor(private http: HttpClient) {}
    private parametros(consulta: ConsultaProduccion): HttpParams {
        let params = new HttpParams();
        for (const [key, value] of Object.entries(consulta)) if (value != null && value !== '') params = params.set(key, String(value));
        return params;
    }
    listado(consulta: ConsultaProduccion, lotes = false) {
        return this.http.get<{ total: number; items: FilaProduccion[] }>(apiUrl(`/api/produccion/${lotes ? 'lotes' : 'operaciones'}`), { params: this.parametros(consulta) });
    }
    resumen(consulta: ConsultaProduccion) {
        return this.http.get<ResumenProduccion>(apiUrl('/api/produccion/resumen'), { params: this.parametros(consulta) });
    }
    catalogos() {
        return this.http.get<{ productores: { id: number; nombre: string }[] }>(apiUrl('/api/produccion/catalogos'));
    }
}
