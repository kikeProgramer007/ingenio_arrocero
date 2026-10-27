import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ExportarService, FormatoExport, ParamsExport, TipoExport } from '../services/exportar.service';
import { AvisoService } from '../services/aviso.service';

@Component({
    selector: 'app-botones-exportar',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    template: `
        <div class="flex flex-wrap gap-2">
            <p-button
                label="PDF"
                icon="pi pi-file-pdf"
                [outlined]="true"
                severity="danger"
                pTooltip="Exportar a PDF"
                tooltipPosition="top"
                [loading]="cargando === 'pdf'"
                (onClick)="bajar('pdf')"
                [disabled]="disabled"
            />
            <p-button
                label="Excel"
                icon="pi pi-file-excel"
                [outlined]="true"
                severity="success"
                pTooltip="Exportar a Excel"
                tooltipPosition="top"
                [loading]="cargando === 'xlsx'"
                (onClick)="bajar('xlsx')"
                [disabled]="disabled"
            />
        </div>
    `
})
export class BotonesExportarComponent {
    @Input() tipo: TipoExport = 'resumen';
    @Input() fechaDesde?: string;
    @Input() fechaHasta?: string;
    @Input() idCliente?: number | number[] | null;
    @Input() estado?: string | string[];
    @Input() tipoGasto?: string | string[];
    @Input() idCaja?: number | null;
    @Input() id?: number | null;
    @Input() q?: string;
    @Input() tipoCompra?: string | string[];
    @Input() metodo?: string | string[];
    @Input() categoria?: string | string[];
    @Input() disponibleEn?: string | string[];
    @Input() idProveedor?: number | number[] | null;
    @Input() ordenante?: string;
    @Input() procedencia?: string | string[];
    @Input() activos?: string | string[];
    @Input() tipoMovimiento?: string | string[];
    @Input() origen?: string | string[];
    @Input() rol?: string;
    @Input() estadoDespacho?: string | string[];
    @Input() disabled = false;

    cargando: FormatoExport | null = null;

    constructor(
        private exportarService: ExportarService,
        private aviso: AvisoService
    ) {}

    private lista(valor?: string | number | Array<string | number> | null): string[] | undefined {
        if (valor == null || valor === '') {
            return undefined;
        }
        const valores = (Array.isArray(valor) ? valor : [valor]).map(String).filter((item) => item !== '');
        return valores.length ? valores : undefined;
    }

    bajar(formato: FormatoExport): void {
        this.cargando = formato;
        const params: ParamsExport = {
            tipo: this.tipo,
            formato,
            fecha_desde: this.fechaDesde,
            fecha_hasta: this.fechaHasta,
            id_cliente: this.lista(this.idCliente),
            estado: this.lista(this.estado),
            tipo_gasto: this.lista(this.tipoGasto),
            id_caja: this.idCaja || undefined,
            id: this.id || undefined,
            q: this.q?.trim() || undefined,
            tipo_compra: this.lista(this.tipoCompra),
            metodo: this.lista(this.metodo),
            categoria: this.lista(this.categoria),
            id_categoria: this.lista(this.categoria),
            disponible_en: this.lista(this.disponibleEn),
            id_proveedor: this.lista(this.idProveedor),
            ordenante: this.ordenante?.trim() || undefined,
            procedencia: this.lista(this.procedencia),
            activos: this.lista(this.activos),
            tipo_movimiento: this.lista(this.tipoMovimiento),
            origen: this.lista(this.origen),
            rol: this.rol || undefined,
            estado_despacho: this.lista(this.estadoDespacho)
        };
        this.exportarService.descargar(params).subscribe({
            next: () => {
                this.cargando = null;
            },
            error: (err) => {
                this.cargando = null;
                this.aviso.error(err, 'No se pudo generar el archivo');
            }
        });
    }
}
