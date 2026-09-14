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
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { etiquetaMetodo, formatBs, formatFecha } from '../caja/caja.utils';
import { Compra, PagoProveedor } from './compras.models';
import { ComprasService } from './compras.service';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';

@Component({
    selector: 'app-pagos',
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
        TextareaModule,
        ToastModule,
        EstadoVacioComponent,
        KpiGridComponent
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Pagos a proveedores</div>
                <div class="text-muted-color">Control de pagos realizados y saldos pendientes</div>
            </div>
            <p-button label="Registrar pago" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />

        <div class="card">
            <p-table [value]="pagos" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Compra</th>
                        <th>Total compra</th>
                        <th>Pagado</th>
                        <th>Saldo pendiente</th>
                        <th>Método</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.proveedor?.nombre || '-' }}</td>
                        <td>#{{ item.id_compra }}</td>
                        <td>{{ formatBs(item.compra?.total) }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ formatBs(item.compra?.saldo_pendiente) }}</td>
                        <td>{{ etiquetaMetodo(item.metodo_pago) }}</td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8">
                            <app-estado-vacio
                                icono="pi pi-send"
                                titulo="No hay pagos registrados"
                                mensaje="Registra un pago a proveedor para que salga como egreso."
                            />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Registrar pago" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Compra pendiente</label>
                    <p-select [options]="pendientes" [(ngModel)]="idCompra" optionValue="id" placeholder="Seleccione compra" [filter]="true" fluid (onChange)="onCompra()">
                        <ng-template #selectedItem let-sel>
                            <span *ngIf="sel">#{{ sel.id }} · {{ sel.proveedor?.nombre }} · saldo {{ formatBs(sel.saldo_pendiente) }}</span>
                        </ng-template>
                        <ng-template #item let-opt>
                            <div>#{{ opt.id }} · {{ opt.proveedor?.nombre }} · saldo {{ formatBs(opt.saldo_pendiente) }}</div>
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
                <p-button label="Pagar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class PagosPage implements OnInit {
    pagos: PagoProveedor[] = [];
    pendientes: Compra[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    idCompra: number | null = null;
    monto = 0;
    metodoPago = 'EFECTIVO';
    referencia = '';
    observacion = '';
    saldoPendiente = 0;
    metodos = METODOS_PAGO_OPTIONS;
    formatBs = formatBs;
    formatFecha = formatFecha;
    etiquetaMetodo = etiquetaMetodo;

    get kpis(): KpiItem[] {
        return [
            { label: 'Pagado hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'danger' },
            { label: 'Pagado este mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-send', tone: 'danger' },
            { label: 'Saldo pendiente', value: formatBs(this.saldoPendiente), icon: 'pi pi-clock', tone: 'warn' }
        ];
    }

    constructor(private comprasService: ComprasService, private messageService: MessageService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.comprasService.listarPagos().subscribe({
            next: (data) => {
                this.pagos = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudieron cargar pagos') });
            }
        });
        this.comprasService.listar().subscribe({
            next: (compras) => {
                this.saldoPendiente = compras
                    .filter((c) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
                    .reduce((acc, c) => acc + Number(c.saldo_pendiente || 0), 0);
            }
        });
    }

    private sumaPeriodo(tipo: 'dia' | 'mes'): number {
        const ahora = new Date();
        return this.pagos
            .filter((p) => {
                const f = new Date(p.fecha);
                if (tipo === 'dia') {
                    return f.toDateString() === ahora.toDateString();
                }
                return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
            })
            .reduce((acc, p) => acc + Number(p.monto || 0), 0);
    }

    abrirNueva(): void {
        this.comprasService.listar().subscribe({
            next: (compras) => {
                this.pendientes = compras.filter((c) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL');
                this.idCompra = this.pendientes[0]?.id ?? null;
                this.monto = this.pendientes[0]?.saldo_pendiente || 0;
                this.metodoPago = 'EFECTIVO';
                this.referencia = '';
                this.observacion = '';
                this.dialog = true;
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudieron cargar compras pendientes') })
        });
    }

    onCompra(): void {
        const sel = this.pendientes.find((c) => c.id === this.idCompra);
        this.monto = sel?.saldo_pendiente || 0;
    }

    guardar(): void {
        if (!this.idCompra || !this.monto) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione compra y monto' });
            return;
        }
        this.guardando = true;
        this.comprasService.crearPago({
            id_compra: this.idCompra,
            monto: this.monto,
            metodo_pago: this.metodoPago,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.messageService.add({ severity: 'success', summary: 'Pago', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo registrar el pago') });
            }
        });
    }

    private msg(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || err?.error?.errores?.[0] || fallback;
    }
}
