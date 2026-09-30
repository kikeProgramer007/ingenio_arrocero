import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { apiUrl } from '../../core/utils/api-url';
import { formatBs } from '../caja/caja.utils';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

@Component({
    selector: 'app-campanas',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, TablaEsqueletoComponent, AyudaCampoComponent, MetodoPagoComponent, InputNumeroComponent, TablaBusquedaComponent, TooltipModule, MenuModule],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Campañas de acopio</div>
                <div class="text-muted-color">Compra de arroz en chala por campaña</div>
            </div>
            <p-button label="Nueva campaña" icon="pi pi-plus" (onClick)="dialogCampana = true" />
        </div>
        <div class="card">
            <p-table
                #dt
                [value]="cargando ? [] : campanas"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} campañas"
                [globalFilterFields]="['nombre', 'fecha_inicio', 'estado']"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #caption>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="font-semibold">Listado de campañas</span>
                        <app-tabla-busqueda (buscar)="filtrarTabla(dt, $event)" />
                    </div>
                </ng-template>
                <ng-template #header>
                    <tr><th>Nombre</th><th>Inicio</th><th>Acopiado</th><th>Meta</th><th>Monto</th><th>Estado</th><th></th></tr>
                </ng-template>
                <ng-template #body let-c>
                    <tr>
                        <td>{{ c.nombre }}</td>
                        <td>{{ c.fecha_inicio }}</td>
                        <td>{{ c.total_cantidad }}</td>
                        <td>{{ c.meta_cantidad ?? '-' }}</td>
                        <td>{{ formatBs(c.total_monto) }}</td>
                        <td><p-tag [value]="c.estado" [severity]="c.estado === 'ABIERTA' ? 'success' : 'secondary'" /></td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones de la campaña"
                                (onClick)="abrirAcciones($event, menuAcciones, c)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="7" [fila]="f"></tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog header="Nueva campaña" [(visible)]="dialogCampana" [modal]="true" [style]="{ width: '30rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div><label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Ej.: Campaña zafra 2026." posicion="right" /></label><input pInputText class="w-full" [(ngModel)]="campana.nombre" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Fecha inicio (YYYY-MM-DD) <app-ayuda-campo texto="Ej.: 2026-03-15. Día en que empieza el acopio." posicion="right" /></label><input pInputText class="w-full" [(ngModel)]="campana.fecha_inicio" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Meta (kg) <app-ayuda-campo texto="Cantidad de chala que se quiere acopiar. Referencia, no bloquea." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="campana.meta_cantidad" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Zona, precio de referencia, etc." posicion="top" /></label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="campana.observacion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogCampana = false" />
                <p-button label="Crear" [loading]="guardando" (onClick)="crearCampana()" />
            </ng-template>
        </p-dialog>
        <p-dialog header="Registrar acopio" [(visible)]="dialogAcopio" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div><label class="flex items-center gap-1 font-bold mb-2">Proveedor <app-ayuda-campo texto="Productor o intermediario que entrega la chala." posicion="right" /></label><p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="acopio.id_proveedor" [filter]="true" fluid /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Producto (opcional) <app-ayuda-campo texto="Si eliges un producto, entra al inventario. Si no, solo queda el acopio." posicion="right" /></label><p-select [options]="productos" optionLabel="nombre" optionValue="id" [(ngModel)]="acopio.id_producto" [showClear]="true" fluid /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Descripción <app-ayuda-campo texto="Ej.: Chala húmeda, lote de comunidad X." posicion="right" /></label><input pInputText class="w-full" [(ngModel)]="acopio.descripcion" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Cantidad <app-ayuda-campo texto="Kilos acopiados en esta entrega." posicion="right" /></label><app-input-numero tipo="cantidad" [(ngModel)]="acopio.cantidad" [min]="0" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Precio unitario <app-ayuda-campo texto="Bs por kilo o unidad. El total es cantidad × precio." posicion="right" /></label><app-input-numero [(ngModel)]="acopio.precio_unitario" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Pago ahora <app-ayuda-campo texto="Lo que pagas ahora sale de caja. 0 = queda por pagar." posicion="right" /></label><app-input-numero [(ngModel)]="acopio.pago" /></div>
                <div *ngIf="acopio.pago > 0"><label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR sale del banco. Efectivo del cajón. Mixto parte el pago." posicion="top" /></label><app-metodo-pago [(ngModel)]="acopio.metodo_pago" [montoTotal]="acopio.pago" [(montoEfectivo)]="acopio.monto_efectivo" [(montoQr)]="acopio.monto_qr" /></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAcopio = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="crearAcopio()" />
            </ng-template>
        </p-dialog>
    `
})
export class CampanasPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    campanas: any[] = [];
    proveedores: any[] = [];
    productos: any[] = [];
    cargando = false;
    guardando = false;
    dialogCampana = false;
    dialogAcopio = false;
    campana: any = { nombre: '', fecha_inicio: new Date().toISOString().slice(0, 10), meta_cantidad: 0, observacion: '' };
    acopio: any = {};
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;

    constructor(private http: HttpClient, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.http.get<any[]>(apiUrl('/api/proveedores')).subscribe({ next: (d) => (this.proveedores = d) });
        this.http.get<any[]>(apiUrl('/api/productos')).subscribe({ next: (d) => (this.productos = d) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/campanas')).subscribe({
            next: (d) => { this.campanas = d; this.cargando = false; },
            error: (e) => { this.cargando = false; this.aviso.error(e, 'No se pudo cargar'); }
        });
    }

    crearCampana(): void {
        if (!this.campana.nombre || !this.campana.fecha_inicio) {
            this.aviso.aviso('Validación', 'Nombre y fecha son obligatorios');
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/campanas'), this.campana).subscribe({
            next: (res) => { this.guardando = false; this.dialogCampana = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo crear'); }
        });
    }

    abrirAcciones(event: Event, menu: Menu, c: any): void {
        const abierta = c.estado === 'ABIERTA';
        this.itemsAcciones = [
            {
                label: 'Registrar acopio',
                icon: 'pi pi-inbox menu-icon-acopio',
                iconStyle: { color: '#22c55e' },
                disabled: !abierta,
                command: () => this.abrirAcopio(c)
            },
            {
                label: 'Cerrar campaña',
                icon: 'pi pi-lock menu-icon-anular',
                iconStyle: { color: '#f97316' },
                disabled: !abierta,
                command: () => this.cerrar(c)
            }
        ];
        menu.toggle(event);
    }

    abrirAcopio(c: any): void {
        this.acopio = { id_campana: c.id, id_proveedor: null, id_producto: null, descripcion: 'Arroz en chala', cantidad: 0, precio_unitario: 0, pago: 0, metodo_pago: 'EFECTIVO', monto_efectivo: 0, monto_qr: 0 };
        this.dialogAcopio = true;
    }

    crearAcopio(): void {
        const mixto = this.acopio.pago > 0 ? mensajePagoMixto(this.acopio.metodo_pago, this.acopio.pago, this.acopio.monto_efectivo, this.acopio.monto_qr) : null;
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        const payload = {
            ...this.acopio,
            id_producto: this.acopio.id_producto || undefined,
            metodo_pago: this.acopio.pago > 0 ? this.acopio.metodo_pago : undefined,
            ...(this.acopio.pago > 0 ? extrasPagoMixto(this.acopio.metodo_pago, this.acopio.monto_efectivo, this.acopio.monto_qr) : {})
        };
        this.http.post<{ mensaje: string }>(apiUrl('/api/campanas/acopios'), payload).subscribe({
            next: (res) => { this.guardando = false; this.dialogAcopio = false; this.aviso.ok('Listo', res.mensaje); this.cargar(); },
            error: (e) => { this.guardando = false; this.aviso.error(e, 'No se pudo registrar acopio'); }
        });
    }

    cerrar(c: any): void {
        this.http.put<{ mensaje: string }>(apiUrl(`/api/campanas/${c.id}/cerrar`), {}).subscribe({
            next: (res) => { this.aviso.ok('Listo', res.mensaje); this.cargar(); },
            error: (e) => this.aviso.error(e, 'No se pudo cerrar')
        });
    }
}
