import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { etiquetaPago, formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { nombreUsuario } from '../../shared/utils/usuario';
import { Compra, PagoProveedor, Proveedor } from './compras.models';
import { ComprasService, ProveedoresService } from './compras.service';
import { METODOS_DOCUMENTO_FILTRO, ymdDesdeRango, ymdHastaRango } from '../../shared/utils/fecha-filtro';
import { ExportarService } from '../../shared/services/exportar.service';
import { formatUsd } from '../../shared/utils/money';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
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
        DatePickerModule,
        SelectModule,
        MultiSelectModule,
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
        TablaBusquedaComponent,
        TooltipModule,
        MenuModule
    ],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Pagos a proveedores</div>
                <div class="text-muted-color">Amortiza una compra o servicio ya registrado. La entrega de chala no registra pago aquí.</div>
            </div>
            <p-button label="Registrar pago" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />

        <div class="card">
            <div class="barra-listado">
                <div class="campo-wide">
                    <label class="block font-bold mb-1 text-sm">Proveedor</label>
                    <p-multiselect [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroProveedor" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo">
                    <label class="block font-bold mb-1 text-sm">Método</label>
                    <p-multiselect [options]="metodosFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroMetodo" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-fecha">
                    <label class="block font-bold mb-1 text-sm">Período</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="pagos" [idProveedor]="filtroProveedor" [metodo]="filtroMetodo" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : pagos"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} pagos"
                [globalFilterFields]="['fecha', 'proveedor.nombre', 'id_compra', 'usuario.username', 'usuario.nombre']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
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
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.proveedor?.nombre || '-' }}</td>
                        <td>#{{ item.id_compra }}</td>
                        <td class="text-right">{{ formatBs(item.compra?.total) }}</td>
                        <td class="text-right">
                            <div>{{ formatBs(item.monto) }}</div>
                            <div class="text-xs text-muted-color" *ngIf="item.monto_usd">{{ formatUsd(item.monto_usd) }}</div>
                        </td>
                        <td class="text-right">{{ formatBs(item.compra?.saldo_pendiente) }}</td>
                        <td>{{ etiquetaPago(item) }}</td>
                        <td>{{ nombreUsuario(item.usuario) }}</td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del pago"
                                (onClick)="abrirAcciones($event, menuAcciones, item)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="9" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="9">
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
                    <p-select [options]="pendientesOpciones" [(ngModel)]="idCompra" optionLabel="etiqueta" optionValue="id" placeholder="Seleccione compra" [filter]="true" fluid appendTo="body" [baseZIndex]="2100" (onChange)="onCompra()" />
                    <small class="block text-muted-color mt-1" *ngIf="usdReferencialPago()">Equiv. {{ formatUsd(usdReferencialPago()) }} al TC {{ compraSeleccionada?.tipo_cambio }} de la compra. El pago se registra en Bs.</small>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="Se paga en bolivianos. No puede superar el saldo." posicion="right" /></label>
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
                    <label class="flex items-center gap-1 font-bold mb-2">Por lo siguiente <app-ayuda-campo texto="Texto que sale en el comprobante de egreso. Ej.: pago a cuenta de compra de arroz." posicion="top" /></label>
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
    proveedores: Proveedor[] = [];
    pendientes: Compra[] = [];
    filtroProveedor: number[] = [];
    filtroMetodo: string[] = [];
    rango: Date[] | null = null;
    metodosFiltro = METODOS_DOCUMENTO_FILTRO;
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
    nombreUsuario = nombreUsuario;
    formatUsd = formatUsd;
    formatFecha = formatFecha;
    etiquetaPago = etiquetaPago;
    itemsAcciones: MenuItem[] = [];

    get compraSeleccionada(): Compra | undefined {
        return this.pendientes.find((c) => c.id === this.idCompra);
    }

    get pendientesOpciones() {
        return this.pendientes.map((c) => ({
            ...c,
            etiqueta: `#${c.id} · ${c.proveedor?.nombre || '-'} · saldo ${formatBs(c.saldo_pendiente)}`
        }));
    }

    get kpis(): KpiItem[] {
        return [
            { label: 'Pagado hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'danger' },
            { label: 'Pagado este mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-send', tone: 'danger' },
            { label: 'Saldo pendiente', value: formatBs(this.saldoPendiente), icon: 'pi pi-clock', tone: 'warn' }
        ];
    }

    constructor(
        private comprasService: ComprasService,
        private proveedoresService: ProveedoresService,
        private exportarService: ExportarService,
        private aviso: AvisoService
    ) {}

    get fechaDesde(): string | undefined {
        return ymdDesdeRango(this.rango);
    }

    get fechaHasta(): string | undefined {
        return ymdHastaRango(this.rango);
    }

    ngOnInit(): void {
        this.proveedoresService.listar({ activos: 'todos' }).subscribe({ next: (data) => (this.proveedores = data) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.comprasService.listarPagos({
            id_proveedor: this.filtroProveedor.length ? this.filtroProveedor : undefined,
            metodo: this.filtroMetodo.length ? this.filtroMetodo : undefined,
            fecha_desde: this.fechaDesde,
            fecha_hasta: this.fechaHasta
        }).subscribe({
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
        const visor = this.exportarService.abrirVentanaEspera('Generando comprobante de egreso...');
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
                if (res.data?.id) {
                    this.exportarRecibo(res.data.id, visor);
                } else {
                    visor?.close();
                }
            },
            error: (err) => {
                visor?.close();
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.aviso.error(err, 'No se pudo registrar el pago');
            }
        });
    }

    abrirAcciones(event: Event, menu: Menu, pago: PagoProveedor): void {
        this.itemsAcciones = [
            {
                label: 'Reimprimir recibo',
                icon: 'pi pi-file-pdf menu-icon-pdf',
                iconStyle: { color: '#ef4444' },
                command: () => this.exportarRecibo(pago.id)
            }
        ];
        menu.toggle(event);
    }

    usdReferencialPago(): number {
        const tc = Number(this.compraSeleccionada?.tipo_cambio || 0);
        if (!(tc > 0) || !(this.monto > 0)) {
            return 0;
        }
        return Math.round((this.monto / tc) * 100) / 100;
    }

    private exportarRecibo(id: number, visor?: Window | null): void {
        const ventana = visor ?? this.exportarService.abrirVentanaEspera('Generando recibo de pago...');
        this.exportarService.mostrarPdf({ tipo: 'pago', formato: 'pdf', id }, ventana).subscribe({
            error: (err) => this.aviso.error(err, 'No se pudo generar el recibo')
        });
    }
}
