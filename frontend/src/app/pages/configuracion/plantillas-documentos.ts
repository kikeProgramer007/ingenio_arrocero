import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { Subscription } from 'rxjs';
import { AvisoService } from '../../shared/services/aviso.service';
import { PlantillaDocumento, PlantillasDocumentosService } from './plantillas-documentos.service';

@Component({
    selector: 'app-plantillas-documentos', standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, SelectModule, SkeletonModule, TableModule, InputTextModule],
    template: `
        <h1 class="text-2xl font-semibold mb-6">Plantillas de documentos</h1>
        <div class="card">
            <p-table #tabla [value]="plantillas" [paginator]="true" [rows]="10" [rowsPerPageOptions]="[10, 25, 50]"
                [globalFilterFields]="['nombre', 'descripcion', 'categoria']" [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} plantillas" responsiveLayout="scroll">
                <ng-template #caption><div class="flex justify-end">
                    <input pInputText type="search" placeholder="Buscar plantilla..." aria-label="Buscar plantilla" [(ngModel)]="busqueda" (ngModelChange)="tabla.filterGlobal($event, 'contains')" />
                </div></ng-template>
                <ng-template #header><tr><th>Plantilla</th><th>Tipo</th><th>Descripción</th><th style="width: 12rem">Acciones</th></tr></ng-template>
                <ng-template #body let-p><tr>
                    <td class="font-semibold">{{ p.nombre }}</td><td>{{ p.categoria }}</td><td>{{ p.descripcion }}</td>
                    <td><p-button label="Previsualizar" icon="pi pi-eye" [outlined]="true" (onClick)="abrir(p)" /></td>
                </tr></ng-template>
                <ng-template #emptymessage><tr><td colspan="4">
                    @if (cargandoListado) { <p-skeleton height="2rem" /> }
                    @else { <span>No hay plantillas disponibles.</span> }
                </td></tr></ng-template>
            </p-table>
        </div>
        <p-dialog [(visible)]="visible" [header]="seleccionada?.nombre || 'Previsualización'" [modal]="true"
            [maximizable]="true" [style]="{ width: '90vw', 'max-width': '1200px' }" (onHide)="cerrar()">
            <div class="flex flex-wrap items-center gap-3 mb-4">
                <label for="plantilla-paginas" class="font-medium">Cantidad de páginas</label>
                <p-select inputId="plantilla-paginas" [options]="opcionesPaginas" [(ngModel)]="paginas"
                    [disabled]="generando" (onChange)="generar()" appendTo="body" />
                <div class="flex flex-wrap gap-2 ml-auto">
                    <p-button label="Descargar" icon="pi pi-download" [outlined]="true" [disabled]="generando || !url" (onClick)="descargar()" />
                    <p-button label="Imprimir" icon="pi pi-print" [disabled]="generando || !url || !visorListo" (onClick)="imprimir()" />
                </div>
            </div>
            @if (generando) {
                <p-skeleton width="100%" height="65vh" />
            } @else if (urlSegura) {
                <iframe #visor [src]="urlSegura" [title]="(seleccionada?.nombre || 'Documento') + ' con datos ficticios'" (load)="visorListo = true"></iframe>
            } @else {
                <div class="py-8 text-center"><p-button label="Reintentar" icon="pi pi-refresh" (onClick)="generar()" /></div>
            }
        </p-dialog>
    `,
    styles: [`iframe { display: block; width: 100%; height: 65vh; min-height: 20rem; border: 1px solid var(--p-content-border-color); }`]
})
export class PlantillasDocumentosComponent implements OnInit, OnDestroy {
    @ViewChild('visor') visor?: ElementRef<HTMLIFrameElement>;
    plantillas: PlantillaDocumento[] = [];
    seleccionada?: PlantillaDocumento;
    opcionesPaginas = Array.from({ length: 10 }, (_, i) => i + 1);
    paginas = 1;
    busqueda = '';
    visible = false;
    cargandoListado = true;
    generando = false;
    visorListo = false;
    url: string | null = null;
    urlSegura: SafeResourceUrl | null = null;
    private listado?: Subscription;
    private solicitud?: Subscription;
    constructor(private servicio: PlantillasDocumentosService, private sanitizer: DomSanitizer, private aviso: AvisoService) {}
    ngOnInit() {
        this.listado = this.servicio.listar().subscribe({
            next: (plantillas) => { this.plantillas = plantillas; this.cargandoListado = false; },
            error: (error) => { this.cargandoListado = false; this.aviso.error(error, 'No se pudieron cargar las plantillas'); }
        });
    }
    abrir(plantilla: PlantillaDocumento) {
        this.seleccionada = plantilla;
        this.paginas = 1;
        this.visible = true;
        this.generar();
    }
    generar() {
        if (!this.seleccionada) return;
        this.solicitud?.unsubscribe();
        this.liberarPdf();
        this.generando = true;
        this.solicitud = this.servicio.previsualizar(this.seleccionada.id, this.paginas).subscribe({
            next: (blob) => {
                this.url = URL.createObjectURL(blob);
                this.urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
                this.generando = false;
            },
            error: (error) => { this.generando = false; this.aviso.error(error, 'No se pudo generar la previsualización'); }
        });
    }
    descargar() {
        if (!this.url) return;
        const link = document.createElement('a');
        link.href = this.url;
        link.download = `${this.seleccionada?.id}-prueba-${this.paginas}-paginas.pdf`;
        link.click();
    }
    imprimir() {
        try {
            const ventana = this.visor?.nativeElement.contentWindow;
            ventana?.focus();
            ventana?.print();
        } catch {
            this.aviso.errorTexto('No se pudo abrir la impresión', 'Utilice la opción de imprimir del visor PDF.');
        }
    }
    cerrar() {
        this.solicitud?.unsubscribe();
        this.generando = false;
        this.liberarPdf();
    }
    private liberarPdf() {
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = null;
        this.urlSegura = null;
        this.visorListo = false;
    }
    ngOnDestroy() { this.listado?.unsubscribe(); this.cerrar(); }
}
