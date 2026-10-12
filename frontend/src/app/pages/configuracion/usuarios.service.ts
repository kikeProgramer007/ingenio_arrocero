import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';
import { ApiMensaje } from '../ventas/ventas.models';

export interface PerfilLista {
    id: number;
    nombre: string;
}

export interface Usuario {
    id: number;
    username: string;
    nombre: string;
    ci?: string | null;
    telefono?: string | null;
    email?: string | null;
    cargo?: string | null;
    activo: boolean;
    id_perfil: number | null;
    perfil?: PerfilLista | null;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
    constructor(private http: HttpClient) {}

    listar(params?: { q?: string; activos?: string }): Observable<Usuario[]> {
        let httpParams = new HttpParams();
        if (params?.q) {
            httpParams = httpParams.set('q', params.q);
        }
        if (params?.activos) {
            httpParams = httpParams.set('activos', params.activos);
        }
        return this.http.get<Usuario[]>(apiUrl('/api/users'), { params: httpParams });
    }

    listarPerfiles(): Observable<PerfilLista[]> {
        return this.http.get<PerfilLista[]>(apiUrl('/api/users/perfiles'));
    }

    crear(payload: Partial<Usuario> & { password: string }): Observable<ApiMensaje<Usuario>> {
        return this.http.post<ApiMensaje<Usuario>>(apiUrl('/api/users'), payload);
    }

    actualizar(id: number, payload: Partial<Usuario> & { password?: string }): Observable<ApiMensaje<Usuario>> {
        return this.http.put<ApiMensaje<Usuario>>(apiUrl(`/api/users/${id}`), payload);
    }
}
