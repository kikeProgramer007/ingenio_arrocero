import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { apiUrl } from '../utils/api-url';

export interface LoginResponse {
    token: string;
    user: {
        id: number;
        username: string;
        programas?: unknown[];
    };
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    constructor(private http: HttpClient) {}

    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(apiUrl('/api/users/login'), { username, password }).pipe(
            tap((res) => this.persistSession(res))
        );
    }

    persistSession(res: LoginResponse): void {
        localStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
        localStorage.setItem(STORAGE_KEYS.USER_MENU, JSON.stringify(res.user?.programas || []));
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user || {}));
    }

    clearSession(): void {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_MENU);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem('userApp');
        localStorage.removeItem('token');
        localStorage.removeItem('userMenu');
    }

    getToken(): string | null {
        return localStorage.getItem(STORAGE_KEYS.TOKEN);
    }

    getUser(): LoginResponse['user'] | null {
        const raw = localStorage.getItem(STORAGE_KEYS.USER);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
}
