import { Table } from 'primeng/table';

export const FILAS_TABLA = [10, 20, 30];

export function filtrarTabla(tabla: Table, event: Event): void {
    tabla.filterGlobal((event.target as HTMLInputElement).value, 'contains');
}
