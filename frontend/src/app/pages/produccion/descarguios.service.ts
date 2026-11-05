import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../../core/utils/api-url';

export interface OpcionDescarguio {
    id: number; nombre: string; nit_ci?: string; unidad_medida?: string; categoria?: string; estado?: string;
    id_compra?: number; id_producto?: number; id_productor?: number | null; producto?: string; productor?: string;
    unidad?: string; descripcion?: string; boleta?: string; chofer?: string; placa?: string; disponible?: number; cantidad_recibida?: number; etiqueta?: string;
}
export interface Descarguio {
    id: number; codigo: string; fecha: string; modalidad: 'COMPRA' | 'SERVICIO'; estado: string; version: number;
    id_productor: number | null; id_producto: number | null; id_compra_detalle: number | null; id_recepcion_compra: number | null;
    id_campana: number | null; id_ubicacion: number | null; id_lote: number | null;
    boleta: string | null; chofer: string | null; placa: string | null; procedencia: string | null; localidad: string | null;
    variedad: string | null; cantidad: number | null; unidad: string | null; humedad_entrada: number | null; impurezas_entrada: number | null;
    impurezas_salida: number | null; peso_real_kg: number | null; punto_descarga: string | null; ubicacion_detalle: string | null;
    responsable: string | null; observacion: string | null; motivo_anulacion?: string; productor_nombre?: string; producto_nombre?: string;
    productor?: string; ubicacion?: string; lote_codigo?: string;
    historial: { id: number; evento: string; fecha: string; usuario: string; motivo: string | null }[];
}
export interface FiltroDescarguios {
    fecha_desde?: string; fecha_hasta?: string; id_productor?: number; modalidad?: string; variedad?: string; estado?: string;
    buscar?: string; orden?: string; direccion?: number; limit?: number; offset?: number;
}
export interface ListadoDescarguios {
    items: Descarguio[]; total: number;
    resumen: { borradores: number; confirmados: number; anulados: number; cantidades: { modalidad: string; estado: string; unidad: string; cantidad: number }[] };
}
@Injectable({ providedIn: 'root' })
export class DescarguiosService {
    private base = apiUrl('/api/produccion/descarguios');
    constructor(private http: HttpClient) {}
    private params(valores: object) {
        let params = new HttpParams();
        for (const [campo, valor] of Object.entries(valores)) if (valor != null && valor !== '') params = params.set(campo, String(valor));
        return params;
    }
    listar(filtro: FiltroDescarguios) { return this.http.get<ListadoDescarguios>(this.base, { params: this.params(filtro) }); }
    obtener(id: number) { return this.http.get<Descarguio>(`${this.base}/${id}`); }
    opciones(grupo: string, q = '', id?: number) { return this.http.get<OpcionDescarguio[]>(`${this.base}/opciones`, { params: this.params({ grupo, q, id }) }); }
    recepciones(detalle: number) { return this.http.get<{ id: number; fecha: string; cantidad: number; disponible: number }[]>(`${this.base}/recepciones`, { params: this.params({ id_detalle: detalle }) }); }
    crear(datos: object) { return this.http.post<Descarguio>(this.base, datos); }
    editar(id: number, datos: object) { return this.http.put<Descarguio>(`${this.base}/${id}`, datos); }
    confirmar(id: number, version: number, clave: string) { return this.http.post<Descarguio>(`${this.base}/${id}/confirmar`, { version, clave_confirmacion: clave }); }
    anular(id: number, version: number, motivo: string) { return this.http.post<Descarguio>(`${this.base}/${id}/anular`, { version, motivo }); }
    crearProductor(datos: object) { return this.http.post<OpcionDescarguio>(`${this.base}/productores`, datos); }
}
