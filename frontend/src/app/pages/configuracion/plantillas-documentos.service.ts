import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';

export interface PlantillaDocumento { id: string; nombre: string; descripcion: string; categoria: string; }

@Injectable({ providedIn: 'root' })
export class PlantillasDocumentosService {
    constructor(private http: HttpClient) {}
    listar() {
        return this.http.get<PlantillaDocumento[]>(apiUrl('/api/plantillas-documentos'));
    }
    previsualizar(id: string, paginas: number) {
        return this.http.get(apiUrl(`/api/plantillas-documentos/${encodeURIComponent(id)}/pdf`), {
            params: { paginas }, responseType: 'blob'
        }).pipe(catchError((error: HttpErrorResponse) => {
            if (!(error.error instanceof Blob)) return throwError(() => error);
            return from(error.error.text()).pipe(switchMap((text) => {
                let detalle: unknown = text;
                try { detalle = JSON.parse(text); } catch { /* respuesta no JSON */ }
                return throwError(() => new HttpErrorResponse({ error: detalle, status: error.status, statusText: error.statusText, url: error.url || undefined }));
            }));
        }));
    }
}
