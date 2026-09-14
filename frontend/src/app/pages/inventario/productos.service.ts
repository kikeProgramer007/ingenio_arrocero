import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/utils/api-url';

export interface ProductoLista {
    id: number;
    nombre: string;
    precio_venta: number;
    precio_compra: number;
    stock: number;
    unidad_medida: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
    constructor(private http: HttpClient) {}

    listar(): Observable<ProductoLista[]> {
        return this.http.get<ProductoLista[]>(apiUrl('/api/productos'));
    }
}
