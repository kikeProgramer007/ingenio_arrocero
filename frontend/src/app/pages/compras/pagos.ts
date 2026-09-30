import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { etiquetaPago, formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { Compra, PagoProveedor } from './compras.models';
import { ComprasService } from './compras.service';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

@Component({
    selector: 'app-pagos',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TextareaModule,
        EstadoVacioComponent,
        KpiGridComponent,
        DialogCajaCerradaComponent,
        BotonesExportarComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        MetodoPagoComponent,
        InputNumeroComponent,
        TablaBusquedaComponent
    ],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Pagos a proveedores</div>
                <div class="text-muted-color">El dinero sale de caja al pagar. Una compra pendiente no es un egreso.</div>
            </div>
            <p-button label="Registrar pago" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />

        <div class="card">
            <div class="flex flex-wrap items-end gap-2 mb-4">
                <div class="ml-auto flex items-end gap-2 shrink-0">
                    <app-botones-exportar tipo="pagos" />
                </div>
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : pagos"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} pagos"
                [globalFilterFields]="['fecha', 'proveedor.nombre', 'id_compra', 'usuario.username']"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #caption>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="font-semibold">Listado de pagos</span>
                        <app-tabla-busqueda (buscar)="filtrarTabla(dt, $event)" />
                    </div>
                </ng-template>
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
                        <td>{{ etiquetaPago(item) }}</td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="8" [fila]="f"></tr>
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
                    <label class="flex items-center gap-1 font-bold mb-2">Compra pendiente <app-ayuda-campo texto="Solo compras con saldo. El pago sale de caja; la compra no es egreso hasta pagar." posicion="right" /></label>
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
                    <label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="No puede superar el saldo. Puedes pagar una parte." posicion="right" /></label>
                    <app-input-numero [(ngModel)]="monto" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR sale del banco. Efectivo del cajón. Mixto parte el pago." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="monto" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia o comprobante. Opcional en efectivo." posicion="top" /></label>
                    <input pInputText class="w-full" [(ngModel)]="referencia" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna del pago." posicion="top" /></label>
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
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    pagos: PagoProveedor[] = [];
    pendientes: Compra[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogCajaCerrada = false;
    idCompra: number | null = null;
    monto = 0;
    metodoPago = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    referencia = '';
    observacion = '';
    saldoPendiente = 0;
    formatBs = formatBs;
    formatFecha = formatFecha;
    etiquetaPago = etiquetaPago;

    get kpis(): KpiItem[] {
        return [
            { label: 'Pagado hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'danger' },
            { label: 'Pagado este mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-send', tone: 'danger' },
            { label: 'Saldo pendiente', value: formatBs(this.saldoPendiente), icon: 'pi pi-clock', tone: 'warn' }
        ];
    }

    constructor(private comprasService: ComprasService, private aviso: AvisoService) {}

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
                this.aviso.error(err, 'No se pudieron cargar pagos');
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
                this.montoEfectivo = 0;
                this.montoQr = 0;
                this.referencia = '';
                this.observacion = '';
                this.dialog = true;
            },
            error: (err) => this.aviso.error(err, 'No se pudieron cargar compras pendientes')
        });
    }

    onCompra(): void {
        const sel = this.pendientes.find((c) => c.id === this.idCompra);
        this.monto = sel?.saldo_pendiente || 0;
    }

    guardar(): void {
        if (!this.idCompra || !this.monto) {
            this.aviso.aviso('Validación', 'Seleccione compra y monto');
            return;
        }
        const mixto = mensajePagoMixto(this.metodoPago, this.monto, this.montoEfectivo, this.montoQr);
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        this.comprasService.crearPago({
            id_compra: this.idCompra,
            monto: this.monto,
            metodo_pago: this.metodoPago,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined,
            ...extrasPagoMixto(this.metodoPago, this.montoEfectivo, this.montoQr)
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Pago', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.aviso.error(err, 'No se pudo registrar el pago');
            }
        });
    }
}
