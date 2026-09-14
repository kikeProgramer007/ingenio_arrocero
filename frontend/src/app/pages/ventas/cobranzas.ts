import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { etiquetaMetodo, formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { Cobranza, Venta } from './ventas.models';
import { VentasService } from './ventas.service';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';

@Component({
    selector: 'app-cobranzas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule,
        EstadoVacioComponent,
        KpiGridComponent,
        DialogCajaCerradaComponent
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Cobranzas</div>
                <div class="text-muted-color">Registro de pagos recibidos de clientes</div>
            </div>
            <p-button label="Registrar cobranza" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />

        <div class="card">
            <p-table [value]="cobranzas" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Venta</th>
                        <th>Monto cobrado</th>
                        <th>Método</th>
                        <th>Saldo restante</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.cliente?.nombre || '-' }}</td>
                        <td>#{{ item.id_venta }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ etiquetaMetodo(item.metodo_pago) }}</td>
                        <td>{{ formatBs(item.venta?.saldo_pendiente) }}</td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="7">
                            <app-estado-vacio
                                icono="pi pi-money-bill"
                                titulo="No hay cobranzas registradas"
                                mensaje="Registra un pago de cliente para que el dinero ingrese a la empresa."
                            />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Registrar cobranza" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Venta pendiente</label>
                    <p-select [options]="pendientes" [(ngModel)]="idVenta" optionValue="id" placeholder="Seleccione venta" [filter]="true" fluid>
                        <ng-template #selectedItem let-sel>
                            <span *ngIf="sel">#{{ sel.id }} · {{ sel.cliente?.nombre }} · saldo {{ formatBs(sel.saldo_pendiente) }}</span>
                        </ng-template>
                        <ng-template #item let-opt>
                            <div>#{{ opt.id }} · {{ opt.cliente?.nombre }} · saldo {{ formatBs(opt.saldo_pendiente) }}</div>
                        </ng-template>
                    </p-select>
                </div>
                <div>
                    <label class="block font-bold mb-2">Monto</label>
                    <p-inputNumber [(ngModel)]="monto" mode="decimal" [min]="0.01" [minFractionDigits]="2" prefix="Bs " fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Método</label>
                    <p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="metodoPago" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Referencia</label>
                    <input pInputText class="w-full" [(ngModel)]="referencia" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Cobrar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class CobranzasPage implements OnInit {
    cobranzas: Cobranza[] = [];
    pendientes: Venta[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogCajaCerrada = false;
    idVenta: number | null = null;
    monto = 0;
    metodoPago = 'EFECTIVO';
    referencia = '';
    observacion = '';
    pendientePorCobrar = 0;
    metodos = METODOS_PAGO_OPTIONS;
    formatBs = formatBs;
    formatFecha = formatFecha;
    etiquetaMetodo = etiquetaMetodo;

    get kpis(): KpiItem[] {
        return [
            { label: 'Cobrado hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'success' },
            { label: 'Cobrado este mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-money-bill', tone: 'success' },
            { label: 'Pendiente por cobrar', value: formatBs(this.pendientePorCobrar), icon: 'pi pi-clock', tone: 'warn' }
        ];
    }

    constructor(private ventasService: VentasService, private messageService: MessageService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.ventasService.listarCobranzas().subscribe({
            next: (data) => {
                this.cobranzas = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudieron cargar cobranzas') });
            }
        });
        this.ventasService.listar().subscribe({
            next: (ventas) => {
                this.pendientePorCobrar = ventas
                    .filter((v) => v.estado === 'PENDIENTE' || v.estado === 'PARCIAL')
                    .reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
            }
        });
    }

    private sumaPeriodo(tipo: 'dia' | 'mes'): number {
        const ahora = new Date();
        return this.cobranzas
            .filter((c) => {
                const f = new Date(c.fecha);
                if (tipo === 'dia') {
                    return f.toDateString() === ahora.toDateString();
                }
                return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
            })
            .reduce((acc, c) => acc + Number(c.monto || 0), 0);
    }

    abrirNueva(): void {
        this.ventasService.listar().subscribe({
            next: (ventas) => {
                this.pendientes = ventas.filter((v) => v.estado === 'PENDIENTE' || v.estado === 'PARCIAL');
                this.idVenta = this.pendientes[0]?.id ?? null;
                const sel = this.pendientes[0];
                this.monto = sel ? sel.saldo_pendiente : 0;
                this.metodoPago = 'EFECTIVO';
                this.referencia = '';
                this.observacion = '';
                this.dialog = true;
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudieron cargar ventas pendientes') })
        });
    }

    guardar(): void {
        if (!this.idVenta || !this.monto) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione venta y monto' });
            return;
        }
        this.guardando = true;
        this.ventasService.crearCobranza({
            id_venta: this.idVenta,
            monto: this.monto,
            metodo_pago: this.metodoPago,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.messageService.add({ severity: 'success', summary: 'Cobranza', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo registrar la cobranza') });
            }
        });
    }

    private msg(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || err?.error?.errores?.[0] || fallback;
    }
}
