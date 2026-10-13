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
    reservado?: number;
    disponible?: number;
    unidad_medida: string;
    path_imagen?: string | null;
    id_categoria?: number | null;
    categoria?: { id: number; nombre: string } | null;
}

export interface CategoriaProducto {
    id: number;
    nombre: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
    constructor(private http: HttpClient) {}

    listar(): Observable<ProductoLista[]> {
        return this.http.get<ProductoLista[]>(apiUrl('/api/productos'));
    }

    categorias(): Observable<CategoriaProducto[]> {
        return this.http.get<CategoriaProducto[]>(apiUrl('/api/productos/categorias'));
    }

    unidadesInvalidas(): Observable<{ mensaje: string; data: { origen: string; id: number; nombre: string; unidad: string; detalle: string }[] }> {
        return this.http.get<{ mensaje: string; data: { origen: string; id: number; nombre: string; unidad: string; detalle: string }[] }>(apiUrl('/api/productos/unidades-invalidas'));
    }

    crear(payload: {
        nombre: string;
        descripcion?: string;
        precio_venta?: number;
        precio_compra?: number;
        stock?: number;
        stock_minimo?: number;
        unidad_medida?: string;
        path_imagen?: string;
        id_categoria?: number;
    }): Observable<{ mensaje: string; data: ProductoLista }> {
        return this.http.post<{ mensaje: string; data: ProductoLista }>(apiUrl('/api/productos'), payload);
    }
}
