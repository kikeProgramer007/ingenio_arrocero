import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
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

interface ArchivoExport {
    blob: Blob;
    nombre: string;
}

@Injectable({ providedIn: 'root' })
export class ExportarService {
    constructor(private http: HttpClient) {}

    /**
     * Ventana flotante centrada (no pestaña). Hay que abrirla en el gesto del clic
     * para que el navegador no la bloquee.
     */
    abrirVentanaEspera(mensaje = 'Generando documento...'): Window | null {
        const ventana = window.open('', `visorPdf_${Date.now()}`, this.featuresVentanaEmergente());
        if (!ventana) {
            return null;
        }
        ventana.document.write(
            `<!doctype html><html><head><title>${mensaje}</title></head><body style="margin:0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#555;background:#f4f4f4">${mensaje}</body></html>`
        );
        ventana.document.close();
        ventana.focus();
        return ventana;
    }

    mostrarPdf(params: ParamsExport, visor?: Window | null): Observable<void> {
        const ventana = visor && !visor.closed ? visor : this.abrirVentanaEspera();
        return this.obtenerArchivo({ ...params, formato: 'pdf' }).pipe(
            tap(({ blob, nombre }) => {
                const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
                const url = URL.createObjectURL(pdf);
                if (ventana && !ventana.closed) {
                    ventana.location.replace(url);
                    ventana.focus();
                    try {
                        ventana.document.title = nombre;
                    } catch {
                        /* el visor nativo no siempre permite título */
                    }
                } else {
                    const fallback = window.open(url, `visorPdf_${Date.now()}`, this.featuresVentanaEmergente());
                    fallback?.focus();
                }
            }),
            map(() => undefined),
            catchError((err) => {
                ventana?.close();
                return this.errorBlob(err);
            })
        );
    }

    /** Sin width/height Chrome abre pestaña; con geometría abre popup centrado. */
    private featuresVentanaEmergente(): string {
        const ancho = Math.min(920, Math.max(560, Math.round((window.screen.availWidth || 1280) * 0.42)));
        const alto = Math.min(980, Math.max(680, Math.round((window.screen.availHeight || 800) * 0.86)));
        const origenX = typeof window.screenLeft === 'number' ? window.screenLeft : window.screenX;
        const origenY = typeof window.screenTop === 'number' ? window.screenTop : window.screenY;
        const left = Math.max(0, Math.round(origenX + (window.outerWidth - ancho) / 2));
        const top = Math.max(0, Math.round(origenY + (window.outerHeight - alto) / 2));
        return [
            'popup=yes',
            `width=${ancho}`,
            `height=${alto}`,
            `left=${left}`,
            `top=${top}`,
            'scrollbars=yes',
            'resizable=yes',
            'toolbar=no',
            'menubar=no',
            'status=no'
        ].join(',');
    }

    descargar(params: ParamsExport): Observable<void> {
        return this.obtenerArchivo(params).pipe(
            map(({ blob, nombre }) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = nombre;
                link.click();
                window.URL.revokeObjectURL(url);
            })
        );
    }

    private obtenerArchivo(params: ParamsExport): Observable<ArchivoExport> {
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
                    return { blob, nombre };
                }),
                catchError((err: HttpErrorResponse) => this.errorBlob(err))
            );
    }

    private errorBlob(err: HttpErrorResponse | unknown): Observable<never> {
        if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
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
    }
}
