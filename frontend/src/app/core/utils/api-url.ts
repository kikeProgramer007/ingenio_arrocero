import { environment } from '../../../environments/environment';

export function getApiBase(): string {
    const base = environment.apiUrl || environment.endpoint || '';
    return base.replace(/\/$/, '');
}

export function apiUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${getApiBase()}${normalized}`;
}
