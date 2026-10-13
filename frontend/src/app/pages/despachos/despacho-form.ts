import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService } from '../../shared/services/exportar.service';
import { LineaVenta, Venta } from '../ventas/ventas.models';
import { VentasService } from '../ventas/ventas.service';
import { colorDespacho, Despacho, DespachosService, etiquetaDespacho } from './despachos.service';

@Component({
    selector: 'app-despacho-form',
    standalone: true,
    imports: [CommonModule, FormsModule, DialogModule, TableModule, ButtonModule, InputTextModule, TextareaModule, CheckboxModule, TagModule, DatePickerModule, InputNumeroComponent],
    template: ` <p-dialog [header]="historia ? 'Historial de despachos' : 'Registrar despacho'" [(visible)]="visible" [modal]="true" [style]="{ width: '64rem' }" [breakpoints]="{ '960px': '95vw' }">
        <div *ngIf="cargando" class="py-8 text-center text-muted-color">Cargando...</div>
        <ng-container *ngIf="venta && !cargando">
            <div class="flex flex-wrap gap-4 mb-4">
                <strong>Venta #{{ venta.id }} · {{ venta.cliente?.nombre }}</strong
                ><p-tag [value]="venta.estado === 'PARCIAL' ? 'Pago parcial' : venta.estado" /><p-tag [value]="etiqueta(venta.estado_despacho)" [severity]="color(venta.estado_despacho)" />
            </div>
            <ng-container *ngIf="!historia">
                <div class="mb-4"><label class="block font-bold mb-2">Fecha y hora</label><p-datepicker [(ngModel)]="fecha" [showTime]="true" hourFormat="24" [showIcon]="true" appendTo="body" [minDate]="fechaVenta" [maxDate]="hoy" /></div>
                <p-table [value]="lineas" responsiveLayout="scroll">
                    <ng-template #header
                        ><tr>
                            <th>Producto</th>
                            <th>Unidad</th>
                            <th>Vendido</th>
                            <th>Entregado</th>
                            <th>Pendiente</th>
                            <th>Entregar ahora</th>
                        </tr></ng-template
                    >
                    <ng-template #body let-l
                        ><tr>
                            <td>{{ l.descripcion }}</td>
                            <td>{{ l.unidad }}</td>
                            <td>{{ l.cantidad }}</td>
                            <td>{{ l.entregado }}</td>
                            <td>{{ l.pendiente }}</td>
                            <td class="min-w-40"><app-input-numero tipo="cantidad" [(ngModel)]="l.entregar_ahora" [min]="0" /></td></tr
                    ></ng-template>
                </p-table>
                <div class="my-4 text-sm text-muted-color">Pendiente después de esta entrega: {{ pendienteTexto }}</div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label class="block font-bold mb-2">Persona que retira *</label><input pInputText class="w-full" [(ngModel)]="persona" maxlength="150" /></div>
                    <div><label class="block font-bold mb-2">Chofer</label><input pInputText class="w-full" [(ngModel)]="chofer" maxlength="150" /></div>
                    <div><label class="block font-bold mb-2">Placa</label><input pInputText class="w-full" [(ngModel)]="placa" maxlength="30" /></div>
                </div>
                <label class="block font-bold mt-4 mb-2">Observación</label><textarea pTextarea class="w-full" [(ngModel)]="observacion" rows="2" maxlength="4000"></textarea>
                <div class="flex items-center gap-2 mt-4"><p-checkbox [(ngModel)]="imprimir" [binary]="true" inputId="imprimirEntrega" /><label for="imprimirEntrega">Imprimir nota de entrega</label></div>
            </ng-container>
            <ng-container *ngIf="historia">
                <div *ngIf="!despachos.length" class="py-8 text-center text-muted-color">No hay despachos registrados.</div>
                <section *ngFor="let d of despachos" class="border-b border-surface py-4">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <strong>NE-{{ d.id }} · {{ d.fecha | date: 'short' }}</strong
                        ><p-button icon="pi pi-print" label="Nota de entrega" [outlined]="true" (onClick)="nota(d.id)" />
                    </div>
                    <div class="text-sm mb-3">
                        Retira: {{ d.persona_retira }} · Entrega: {{ d.usuario?.nombre || d.usuario?.username }}<span *ngIf="d.chofer"> · Chofer: {{ d.chofer }}</span
                        ><span *ngIf="d.placa"> · Placa: {{ d.placa }}</span>
                    </div>
                    <p-table [value]="d.lineas"
                        ><ng-template #header
                            ><tr>
                                <th>Producto</th>
                                <th>Unidad</th>
                                <th>Entregado</th>
                                <th>Pendiente posterior</th>
                            </tr></ng-template
                        ><ng-template #body let-l
                            ><tr>
                                <td>{{ l.descripcion }}</td>
                                <td>{{ l.unidad }}</td>
                                <td>{{ l.cantidad }}</td>
                                <td>{{ l.pendiente }}</td>
                            </tr></ng-template
                        ></p-table
                    >
                    <p *ngIf="d.observacion">{{ d.observacion }}</p>
                </section>
            </ng-container>
        </ng-container>
        <ng-template #footer
            ><p-button label="Cerrar" [text]="true" (onClick)="visible = false" [disabled]="guardando" /><p-button *ngIf="!historia && venta" label="Confirmar despacho" icon="pi pi-truck" [loading]="guardando" (onClick)="guardar()"
        /></ng-template>
    </p-dialog>`
})
export class DespachoFormComponent {
    @Output() confirmado = new EventEmitter<void>();
    visible = false;
    historia = false;
    cargando = false;
    guardando = false;
    venta: Venta | null = null;
    lineas: LineaVenta[] = [];
    despachos: Despacho[] = [];
    persona = '';
    chofer = '';
    placa = '';
    observacion = '';
    imprimir = true;
    fecha = new Date();
    hoy = new Date();
    fechaVenta = new Date();
    clave = '';
    etiqueta = etiquetaDespacho;
    color = colorDespacho;
    constructor(
        private servicio: DespachosService,
        private ventas: VentasService,
        private aviso: AvisoService,
        private exportar: ExportarService
    ) {}
    abrir(venta: Venta, historia = false) {
        this.historia = historia;
        this.venta = null;
        this.visible = true;
        this.cargando = true;
        this.clave = crypto.randomUUID();
        this.persona = '';
        this.chofer = '';
        this.placa = '';
        this.observacion = '';
        this.fecha = new Date();
        this.hoy = new Date();
        this.ventas.obtener(venta.id).subscribe({
            next: (v) => {
                this.venta = v;
                this.fechaVenta = new Date(v.fecha);
                this.cargando = false;
                this.lineas = (v.detalles || []).filter((l) => l.id_producto).map((l) => ({ ...l, entregar_ahora: Number(l.pendiente || 0) }));
                if (historia) {
                    this.cargando = true;
                    this.servicio.historial(v.id).subscribe({
                        next: (d) => {
                            this.despachos = d;
                            this.cargando = false;
                        },
                        error: (e) => {
                            this.cargando = false;
                            this.aviso.error(e, 'No se pudo cargar el historial');
                        }
                    });
                }
            },
            error: (e) => {
                this.cargando = false;
                this.visible = false;
                this.aviso.error(e, 'No se pudo cargar la venta');
            }
        });
    }
    get pendienteTexto() {
        return this.lineas.map((l) => `${Math.max(0, Math.round((Number(l.pendiente || 0) - Number(l.entregar_ahora || 0)) * 1000) / 1000)} ${l.unidad} de ${l.descripcion}`).join('; ');
    }
    guardar() {
        if (this.guardando || !this.venta) return;
        if (!this.persona.trim() || !this.lineas.some((l) => Number(l.entregar_ahora) > 0) || this.lineas.some((l) => !Number.isFinite(Number(l.entregar_ahora)) || Number(l.entregar_ahora) < 0 || Number(l.entregar_ahora) > Number(l.pendiente))) {
            this.aviso.aviso('Validación', 'Indique persona y cantidades entre cero y lo pendiente, con al menos una entrega.');
            return;
        }
        const visor = this.imprimir ? this.exportar.abrirVentanaEspera('Generando nota de entrega...') : null;
        this.guardando = true;
        this.servicio
            .crear(this.venta.id, {
                clave: this.clave,
                fecha: this.fecha.toISOString(),
                persona_retira: this.persona,
                chofer: this.chofer || undefined,
                placa: this.placa || undefined,
                observacion: this.observacion || undefined,
                lineas: this.lineas.map((l) => ({ id_detalle: l.id!, cantidad: Number(l.entregar_ahora || 0) }))
            })
            .subscribe({
                next: (r) => {
                    this.guardando = false;
                    this.visible = false;
                    this.confirmado.emit();
                    this.aviso.ok('Despacho', 'Entrega registrada');
                    if (this.imprimir) this.nota(r.data.id, visor);
                },
                error: (e) => {
                    this.guardando = false;
                    visor?.close();
                    this.aviso.error(e, 'No se pudo registrar la entrega');
                }
            });
    }
    nota(id: number, ventana?: Window | null) {
        const visor = ventana || this.exportar.abrirVentanaEspera('Generando nota de entrega...');
        this.servicio.nota(id).subscribe({
            next: (blob) => {
                const url = URL.createObjectURL(blob);
                if (visor) visor.location.replace(url);
                else this.servicio.descargar(blob, `nota-entrega-${id}.pdf`);
                setTimeout(() => URL.revokeObjectURL(url), 300000);
            },
            error: (e) => {
                visor?.close();
                this.aviso.error(e, 'No se pudo generar la nota');
            }
        });
    }
}
