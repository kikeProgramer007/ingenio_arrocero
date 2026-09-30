import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Observable, catchError, of, tap } from 'rxjs';
import { EMPRESA_FALLBACK, Empresa } from '../constants/empresa';
import { apiUrl } from '../utils/api-url';
import { mediaUrl } from '../utils/media-url';

@Injectable({ providedIn: 'root' })
export class EmpresaService {
    private http = inject(HttpClient);
    private title = inject(Title);
    private datos = signal<Empresa>(EMPRESA_FALLBACK);

    readonly actual = this.datos.asReadonly();
    readonly nombreUi = computed(() => this.datos().nombre_corto || this.datos().nombre);
    readonly slogan = computed(() => this.datos().slogan);
    readonly logo = computed(() => this.logoUrl(this.datos().path_logo));

    cargar(): Observable<Empresa> {
        return this.http.get<Empresa>(apiUrl('/api/empresa')).pipe(
            tap((empresa) => this.aplicar(empresa)),
            catchError(() => of(this.datos()))
        );
    }

    guardar(payload: Partial<Empresa>): Observable<{ mensaje: string; data: Empresa }> {
        return this.http.put<{ mensaje: string; data: Empresa }>(apiUrl('/api/empresa'), payload).pipe(
            tap((res) => this.aplicar(res.data))
        );
    }

    logoUrl(path?: string | null): string {
        const valor = (path || '').trim();
        if (!valor || valor.startsWith('assets/')) {
            return valor || EMPRESA_FALLBACK.path_logo;
        }
        return mediaUrl(valor, 'empresa');
    }

    private aplicar(empresa: Empresa): void {
        const normalizada: Empresa = {
            ...EMPRESA_FALLBACK,
            ...empresa,
            nombre: (empresa?.nombre || '').trim() || EMPRESA_FALLBACK.nombre,
            nombre_corto: (empresa?.nombre_corto || '').trim() || EMPRESA_FALLBACK.nombre_corto,
            slogan: (empresa?.slogan || '').trim() || EMPRESA_FALLBACK.slogan,
            path_logo: (empresa?.path_logo || '').trim() || EMPRESA_FALLBACK.path_logo
        };
        this.datos.set(normalizada);
        const nombre = normalizada.nombre_corto || normalizada.nombre;
        this.title.setTitle(nombre);
        const icon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
        if (icon) {
            icon.href = this.logoUrl(normalizada.path_logo);
        }
    }
}
