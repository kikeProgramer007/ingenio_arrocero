import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { etiquetaPago, formatBs, formatFecha, formatFechaCorta, esErrorCajaCerrada } from '../caja/caja.utils';
import { nombreUsuario } from '../../shared/utils/usuario';
import { Cliente, Cobranza, Venta } from './ventas.models';
import { ClientesService, VentasService } from './ventas.service';
import { METODOS_DOCUMENTO_FILTRO, ymdDesdeRango, ymdHastaRango } from '../../shared/utils/fecha-filtro';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { ExportarService } from '../../shared/services/exportar.service';
import { AvisoService } from '../../shared/services/aviso.service';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { coincideFiltro } from '../../shared/utils/filtro-lista';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-cobranzas',
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
        TagModule,
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
        TooltipModule
    ],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Cobranzas</div>
                <div class="text-muted-color">Registro de pagos recibidos de clientes</div>
            </div>
            <p-button label="Registrar cobranza" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />

        <div class="flex gap-2 mb-4">
            <p-button label="Por cobrar" [outlined]="vista !== 'por-cobrar'" (onClick)="vista = 'por-cobrar'" />
            <p-button label="Cobros realizados" [outlined]="vista !== 'realizados'" (onClick)="vista = 'realizados'" />
        </div>

        <div class="card" *ngIf="vista === 'por-cobrar'">
            <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div class="min-w-0">
                    <div class="font-semibold text-lg">Por cobrar</div>
                    <div class="text-muted-color text-sm">Quién debe, cuánto y cuándo vence. "Por vencer" = faltan {{ diasAviso }} días o menos.</div>
                </div>
                <div class="w-full sm:w-[14rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Cliente</label>
                    <p-multiselect [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroClientePorCobrar" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="w-full sm:w-[10rem]">
                    <label class="block font-bold mb-1 text-sm">Desde</label>
                    <input class="p-inputtext w-full" type="date" [(ngModel)]="desdePorCobrar" />
                </div>
                <div class="w-full sm:w-[10rem]">
                    <label class="block font-bold mb-1 text-sm">Hasta</label>
                    <input class="p-inputtext w-full" type="date" [(ngModel)]="hastaPorCobrar" />
                </div>
                <div class="w-full sm:w-[14rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Ver</label>
                    <p-multiselect [options]="filtrosSituacion" optionLabel="label" optionValue="value" [(ngModel)]="filtroSituacion" placeholder="Todas" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <app-botones-exportar tipo="cuentas_por_cobrar" [estado]="estadoPorCobrar" [idCliente]="filtroClientePorCobrar" [fechaDesde]="desdePorCobrar" [fechaHasta]="hastaPorCobrar" />
            </div>
            <p-table
                #dtPendientes
                [value]="porCobrar"
                [paginator]="porCobrar.length > 8"
                [rows]="8"
                [rowsPerPageOptions]="filasTabla"
                [globalFilterFields]="['id', 'cliente.nombre', 'situacion']"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #caption>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="font-semibold">Saldo total: {{ formatBs(saldoFiltrado) }}</span>
                        <app-tabla-busqueda placeholder="Buscar cliente" (buscar)="filtrarTabla(dtPendientes, $event)" />
                    </div>
                </ng-template>
                <ng-template #header>
                    <tr>
                        <th>Venta</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Cobrado</th>
                        <th>Saldo</th>
                        <th>Vence</th>
                        <th>Días</th>
                        <th>Situación</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-v>
                    <tr>
                        <td>#{{ v.id }}</td>
                        <td>{{ v.cliente?.nombre || '-' }}</td>
                        <td>{{ formatFecha(v.fecha) }}</td>
                        <td>{{ formatBs(v.total) }}</td>
                        <td>{{ formatBs(v.pagado) }}</td>
                        <td class="font-medium">{{ formatBs(v.saldo_pendiente) }}</td>
                        <td>{{ v.fecha_vencimiento ? formatFechaCorta(v.fecha_vencimiento) : '-' }}</td>
                        <td>{{ textoDias(v) }}</td>
                        <td><p-tag [value]="etiquetaSituacion(v.situacion)" [severity]="severidadSituacion(v.situacion)" /></td>
                        <td><p-tag [value]="v.estado" [severity]="v.estado === 'PARCIAL' ? 'warn' : 'info'" /></td>
                        <td>
                            <p-button label="Cobrar" size="small" [outlined]="true" (onClick)="abrirCobro(v)" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="11">
                            <div class="text-center py-6 text-muted-color">No hay ventas con saldo en este filtro.</div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <div class="card" *ngIf="vista === 'realizados'">
            <div class="barra-listado">
                <div class="campo-wide">
                    <label class="block font-bold mb-1 text-sm">Cliente</label>
                    <p-multiselect [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroCliente" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
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
                <app-botones-exportar tipo="cobranzas" [idCliente]="filtroCliente" [metodo]="filtroMetodo" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : cobranzas"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} cobranzas"
                [globalFilterFields]="['fecha', 'cliente.nombre', 'id_venta', 'usuario.username', 'usuario.nombre']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Venta</th>
                        <th>Monto cobrado</th>
                        <th>Método</th>
                        <th>Saldo restante</th>
                        <th>Usuario</th>
                        <th>Situación</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.cliente?.nombre || '-' }}</td>
                        <td>#{{ item.id_venta }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ etiquetaPago(item) }}</td>
                        <td>{{ formatBs(item.venta?.saldo_pendiente) }}</td>
                        <td>{{ nombreUsuario(item.usuario) }}</td>
                        <td><p-tag *ngIf="item.revertido || item.venta?.estado === 'ANULADA'" value="Revertido" severity="warn" /><span *ngIf="!(item.revertido || item.venta?.estado === 'ANULADA')">Vigente</span></td>
                        <td>
                            <p-button icon="pi pi-file-pdf" [rounded]="true" [outlined]="true" severity="danger" pTooltip="Ver boleta" tooltipPosition="left" (onClick)="exportarCobranza(item.id)" />
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
                    <label class="flex items-center gap-1 font-bold mb-2">Venta pendiente <app-ayuda-campo texto="Solo ventas con saldo. El cobro entra a caja; la venta no es ingreso por sí sola." posicion="right" /></label>
                    <p-select [options]="pendientes" [(ngModel)]="idVenta" optionValue="id" placeholder="Seleccione venta" [filter]="true" fluid appendTo="body" [baseZIndex]="2100">
                        <ng-template #selectedItem let-sel>
                            <span *ngIf="sel">#{{ sel.id }} · {{ sel.cliente?.nombre }} · saldo {{ formatBs(sel.saldo_pendiente) }}</span>
                        </ng-template>
                        <ng-template #item let-opt>
                            <div>#{{ opt.id }} · {{ opt.cliente?.nombre }} · saldo {{ formatBs(opt.saldo_pendiente) }}</div>
                        </ng-template>
                    </p-select>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="No puede superar el saldo de esa venta. Puedes cobrar una parte." posicion="right" /></label>
                    <app-input-numero [(ngModel)]="monto" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR va al banco. Efectivo al cajón. Mixto parte el cobro." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="monto" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" [mostrarCambio]="true" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia o QR. Opcional en efectivo." posicion="top" /></label>
                    <input pInputText class="w-full" [(ngModel)]="referencia" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Por lo siguiente <app-ayuda-campo texto="Texto que sale en la boleta. Ej.: cobranza de depósito, abono a la venta." posicion="top" /></label>
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
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    cobranzas: Cobranza[] = [];
    clientes: Cliente[] = [];
    pendientes: Venta[] = [];
    filtroCliente: number[] = [];
    filtroMetodo: string[] = [];
    rango: Date[] | null = null;
    metodosFiltro = METODOS_DOCUMENTO_FILTRO;
    diasAviso = 7;
    filtroSituacion: string[] = [];
    filtroClientePorCobrar: number[] = [];
    desdePorCobrar = '';
    hastaPorCobrar = '';
    vista: 'por-cobrar' | 'realizados' = 'por-cobrar';
    filtrosSituacion = [
        { label: 'Vencidas', value: 'VENCIDA' },
        { label: 'Vencen hoy', value: 'VENCE HOY' },
        { label: 'Próximo a vencer', value: 'POR VENCER' },
        { label: 'Al día', value: 'AL DIA' },
        { label: 'Sin plazo', value: 'SIN PLAZO' }
    ];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogCajaCerrada = false;
    idVenta: number | null = null;
    monto = 0;
    metodoPago = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    referencia = '';
    observacion = '';
    pendientePorCobrar = 0;
    formatBs = formatBs;
    nombreUsuario = nombreUsuario;
    formatFecha = formatFecha;
    formatFechaCorta = formatFechaCorta;
    etiquetaPago = etiquetaPago;

    get porCobrar(): Venta[] {
        const ordenSituacion: Record<string, number> = { 'VENCIDA': 0, 'VENCE HOY': 1, 'POR VENCER': 2, 'AL DIA': 3, 'SIN PLAZO': 4 };
        return this.pendientes
            .filter((v) => coincideFiltro(v.situacion, this.filtroSituacion))
            .filter((v) => coincideFiltro(v.id_cliente, this.filtroClientePorCobrar))
            .filter((v) => {
                const dia = String(v.fecha || '').slice(0, 10);
                if (this.desdePorCobrar && dia < this.desdePorCobrar) return false;
                if (this.hastaPorCobrar && dia > this.hastaPorCobrar) return false;
                return true;
            })
            .sort((a, b) => (ordenSituacion[a.situacion || ''] ?? 9) - (ordenSituacion[b.situacion || ''] ?? 9));
    }

    get estadoPorCobrar(): string | string[] {
        if (!this.filtroSituacion.length) {
            return 'CON_SALDO';
        }
        const mapa: Record<string, string> = {
            VENCIDA: 'VENCIDAS',
            'POR VENCER': 'POR_VENCER',
            'VENCE HOY': 'POR_VENCER'
        };
        return [...new Set(this.filtroSituacion.map((s) => mapa[s] || 'CON_SALDO'))];
    }

    get saldoFiltrado(): number {
        return this.porCobrar.reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
    }

    etiquetaSituacion(situacion?: string): string {
        if (situacion === 'VENCIDA') return 'Vencido';
        if (situacion === 'VENCE HOY') return 'Vence hoy';
        if (situacion === 'POR VENCER') return 'Próximo a vencer';
        if (situacion === 'AL DIA') return 'Al día';
        if (situacion === 'PAGADA') return 'Pagado';
        if (situacion === 'SIN PLAZO') return 'Sin plazo';
        return situacion || '-';
    }

    textoDias(venta: Venta): string {
        const dias = venta.dias_vencimiento;
        if (dias === null || dias === undefined) {
            return '-';
        }
        if (dias < 0) {
            return `${Math.abs(dias)} vencidos`;
        }
        if (dias === 0) {
            return 'hoy';
        }
        return `faltan ${dias}`;
    }

    severidadSituacion(situacion?: string): 'danger' | 'warn' | 'success' | 'info' | 'secondary' {
        if (situacion === 'VENCIDA') return 'danger';
        if (situacion === 'VENCE HOY') return 'warn';
        if (situacion === 'POR VENCER') return 'warn';
        if (situacion === 'AL DIA') return 'success';
        if (situacion === 'PAGADA') return 'success';
        return 'secondary';
    }

    get kpis(): KpiItem[] {
        return [
            { label: 'Cobrado hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'success' },
            { label: 'Cobrado este mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-money-bill', tone: 'success' },
            { label: 'Pendiente por cobrar', value: formatBs(this.pendientePorCobrar), icon: 'pi pi-clock', tone: 'warn' }
        ];
    }

    constructor(private ventasService: VentasService, private clientesService: ClientesService, private aviso: AvisoService, private exportarService: ExportarService) {}

    get fechaDesde(): string | undefined {
        return ymdDesdeRango(this.rango);
    }

    get fechaHasta(): string | undefined {
        return ymdHastaRango(this.rango);
    }

    ngOnInit(): void {
        this.clientesService.listar({ activos: 'todos' }).subscribe({ next: (data) => (this.clientes = data) });
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.ventasService.listarCobranzas({
            id_cliente: this.filtroCliente.length ? this.filtroCliente : undefined,
            metodo: this.filtroMetodo.length ? this.filtroMetodo : undefined,
            fecha_desde: this.fechaDesde,
            fecha_hasta: this.fechaHasta
        }).subscribe({
            next: (data) => {
                this.cobranzas = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudieron cargar cobranzas');
            }
        });
        this.ventasService.listar().subscribe({
            next: (ventas) => {
                this.pendientes = ventas.filter((v) => v.estado === 'PENDIENTE' || v.estado === 'PARCIAL');
                this.pendientePorCobrar = this.pendientes.reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
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
                this.prepararCobro(this.pendientes[0]);
            },
            error: (err) => this.aviso.error(err, 'No se pudieron cargar ventas pendientes')
        });
    }

    abrirCobro(venta: Venta): void {
        this.prepararCobro(venta);
    }

    private prepararCobro(venta?: Venta): void {
        this.idVenta = venta?.id ?? null;
        this.monto = venta ? venta.saldo_pendiente : 0;
        this.metodoPago = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
        this.referencia = '';
        this.observacion = '';
        this.dialog = true;
    }

    guardar(): void {
        if (!this.idVenta || !this.monto) {
            this.aviso.aviso('Validación', 'Seleccione venta y monto');
            return;
        }
        const mixto = mensajePagoMixto(this.metodoPago, this.monto, this.montoEfectivo, this.montoQr);
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando boleta de cobranza...');
        this.ventasService.crearCobranza({
            id_venta: this.idVenta,
            monto: this.monto,
            metodo_pago: this.metodoPago,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined,
            ...extrasPagoMixto(this.metodoPago, this.montoEfectivo, this.montoQr)
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Cobranza', 'Cobro registrado. Se abre la boleta.');
                this.cargar();
                const id = res.data?.id;
                if (id) {
                    this.exportarCobranza(id, visor);
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
                this.aviso.error(err, 'No se pudo registrar la cobranza');
            }
        });
    }

    exportarCobranza(id: number, visor?: Window | null): void {
        const ventana = visor ?? this.exportarService.abrirVentanaEspera('Generando boleta de cobranza...');
        this.exportarService.mostrarPdf({ tipo: 'cobranza', formato: 'pdf', id }, ventana).subscribe({
            error: (err) => this.aviso.error(err, 'No se pudo generar la boleta de cobranza')
        });
    }
}

