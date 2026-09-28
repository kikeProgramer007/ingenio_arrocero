import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { apiUrl } from '../../core/utils/api-url';

export type FormatoExport = 'pdf' | 'xlsx';
export type TipoExport = 'resumen' | 'movimientos' | 'ventas' | 'egresos' | 'caja' | 'venta' | 'compras' | 'compra' | 'cobranzas' | 'pagos' | 'inventario';

export interface ParamsExport {
    tipo: TipoExport;
    formato: FormatoExport;
    fecha_desde?: string;
    fecha_hasta?: string;
    id_cliente?: number | string;
    estado?: string;
    tipo_gasto?: string;
    id_caja?: number | string;
    id?: number | string;
}

@Injectable({ providedIn: 'root' })
export class ExportarService {
    constructor(private http: HttpClient) {}

    descargar(params: ParamsExport): Observable<void> {
        let httpParams = new HttpParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                httpParams = httpParams.set(key, String(value));
            }
        });
        return this.http
            .get(apiUrl('/api/reportes/exportar'), {
                params: httpParams,
                responseType: 'blob',
                observe: 'response'
            })
            .pipe(
                map((response) => {
                    const blob = response.body;
                    if (!blob) {
                        throw new Error('Archivo vacío');
                    }
                    const disposition = response.headers.get('content-disposition') || '';
                    const match = disposition.match(/filename="?([^"]+)"?/i);
                    const nombre = match?.[1] || `reporte.${params.formato === 'xlsx' ? 'xlsx' : 'pdf'}`;
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = nombre;
                    link.click();
                    window.URL.revokeObjectURL(url);
                }),
                catchError((err: HttpErrorResponse) => {
                    if (err.error instanceof Blob) {
                        return from(err.error.text()).pipe(
                            switchMap((text) => {
                                try {
                                    return throwError(() => ({ ...err, error: JSON.parse(text) }));
                                } catch {
                                    return throwError(() => err);
                                }
                            })
                        );
                    }
                    return throwError(() => err);
                })
            );
    }
}
