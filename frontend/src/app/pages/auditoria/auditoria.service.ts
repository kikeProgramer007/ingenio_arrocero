import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';

export interface FilaAuditoria {
    id: number;
    evento: string;
    evento_etiqueta: string;
    fecha: string;
    motivo: string | null;
    id_operacion: number | null;
    id_lote: number | null;
    codigo: string | null;
    lote_codigo: string | null;
    tipo: string | null;
    tipo_etiqueta: string;
    estado_documento: string | null;
    usuario: string | null;
    ruta: string | null;
}

export interface ListadoAuditoria {
    total: number;
    limit: number;
    offset: number;
    items: FilaAuditoria[];
    filtros: {
        eventos: { value: string; label: string }[];
        tipos: { value: string; label: string }[];
    };
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
    private base = apiUrl('/api/auditoria');
    constructor(private http: HttpClient) {}
    listar(params: Record<string, string | number | undefined | null>): Observable<ListadoAuditoria> {
        let httpParams = new HttpParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v === undefined || v === null || v === '') return;
            httpParams = httpParams.set(k, String(v));
        });
        return this.http.get<ListadoAuditoria>(this.base, { params: httpParams });
    }
}
