import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ExportarService, FormatoExport, ParamsExport, TipoExport } from '../services/exportar.service';

@Component({
    selector: 'app-botones-exportar',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule],
    template: `
        <div class="flex gap-2">
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
    @Input() idCliente?: number | null;
    @Input() estado?: string;
    @Input() tipoGasto?: string;
    @Input() idCaja?: number | null;
    @Input() id?: number | null;
    @Input() disabled = false;

    cargando: FormatoExport | null = null;

    constructor(
        private exportarService: ExportarService,
        private messageService: MessageService
    ) {}

    bajar(formato: FormatoExport): void {
        this.cargando = formato;
        const params: ParamsExport = {
            tipo: this.tipo,
            formato,
            fecha_desde: this.fechaDesde,
            fecha_hasta: this.fechaHasta,
            id_cliente: this.idCliente || undefined,
            estado: this.estado || undefined,
            tipo_gasto: this.tipoGasto || undefined,
            id_caja: this.idCaja || undefined,
            id: this.id || undefined
        };
        this.exportarService.descargar(params).subscribe({
            next: () => {
                this.cargando = null;
            },
            error: () => {
                this.cargando = null;
                this.messageService.add({ severity: 'error', summary: 'Exportar', detail: 'No se pudo generar el archivo' });
            }
        });
    }
}
