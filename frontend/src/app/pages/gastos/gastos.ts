import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { etiquetaPago, formatBs, formatFecha, formatFechaCorta, esErrorCajaCerrada } from '../caja/caja.utils';
import { apiUrl } from '../../core/utils/api-url';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

const CATEGORIAS = ['Combustible', 'Transporte', 'Energía', 'Mantenimiento', 'Repuestos', 'Servicios', 'Alimentación', 'Otros'];

@Component({
    selector: 'app-gastos',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ChartModule, CheckboxModule, DatePickerModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, EstadoVacioComponent, KpiGridComponent, DialogCajaCerradaComponent, BotonesExportarComponent, TablaEsqueletoComponent, AyudaCampoComponent, MetodoPagoComponent, InputNumeroComponent, TablaBusquedaComponent],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">{{ titulo }}</div>
                <div class="text-muted-color">{{ subtitulo }}</div>
            </div>
            <p-button [label]="esRetiro ? 'Registrar retiro' : 'Registrar gasto'" icon="pi pi-plus" (onClick)="abrir()" />
        </div>
        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />
        <div class="card mb-4">
            <div class="flex flex-wrap items-end gap-3">
                <div class="w-full sm:w-[14rem] min-w-0">
                    <label class="flex items-center gap-1 font-bold mb-1 text-sm">Ver <app-ayuda-campo texto="Empresa: gastos operativos. Personal: retiros. Todo: ambos." posicion="bottom" /></label>
                    <p-select [options]="tiposFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipo" placeholder="Tipo" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="ml-auto flex items-end gap-2 shrink-0">
                    <app-botones-exportar tipo="egresos" [tipoGasto]="filtroTipo || undefined" />
                </div>
            </div>
        </div>
        <div class="card mb-4" *ngIf="porPagar.length">
            <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div class="min-w-0">
                    <div class="font-semibold text-lg">Cuentas por pagar</div>
                    <div class="text-muted-color text-sm">Lo que debemos por gastos y servicios registrados a crédito. Cada pago que registres sí sale de caja.</div>
                </div>
                <span class="font-semibold">Total pendiente: {{ formatBs(totalPorPagar) }}</span>
                <div class="w-full sm:w-[18rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar persona o concepto" (buscar)="filtrarTabla(dtPorPagar, $event)" />
                </div>
            </div>
            <p-table
                #dtPorPagar
                [value]="porPagar"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="8"
                [rowsPerPageOptions]="filasTabla"
                [globalFilterFields]="['concepto', 'persona', 'categoria']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>A quién debemos</th>
                        <th>Concepto</th>
                        <th>Importe</th>
                        <th>Pagado</th>
                        <th>Pendiente</th>
                        <th>Vence</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.persona || '-' }}</td>
                        <td>{{ item.concepto }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ formatBs(item.pagado) }}</td>
                        <td class="font-medium">{{ formatBs(item.saldo_pendiente) }}</td>
                        <td>{{ item.fecha_vencimiento ? formatFechaCorta(item.fecha_vencimiento) : '-' }}</td>
                        <td>
                            <p-tag [value]="item.vencido ? 'VENCIDO' : item.estado" [severity]="item.vencido ? 'danger' : item.estado === 'PARCIAL' ? 'warn' : 'info'" />
                        </td>
                        <td><p-button label="Pagar" size="small" [outlined]="true" (onClick)="abrirPago(item)" /></td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="9"><div class="text-center py-6 text-muted-color">No hay cuentas por pagar.</div></td></tr>
                </ng-template>
            </p-table>
        </div>
        <div class="grid grid-cols-12 gap-4 mb-4 min-w-0" *ngIf="listandoEmpresa">
            <div class="col-span-12 xl:col-span-5 min-w-0">
                <div class="card">
                    <div class="font-semibold text-xl mb-3">Por categoría</div>
                    <p-chart type="doughnut" [data]="chartData" [options]="chartOptions" *ngIf="items.length" />
                    <app-estado-vacio *ngIf="!items.length && !cargando" icono="pi pi-chart-pie" titulo="Sin gastos para graficar" mensaje="Registra gastos operativos para ver el resumen." />
                </div>
            </div>
            <div class="col-span-12 xl:col-span-7 min-w-0">
                <div class="card">
                    <div class="flex flex-wrap items-end gap-3 mb-4">
                        <div class="w-full sm:w-[18rem] min-w-0 sm:ml-auto">
                            <label class="block font-bold mb-1 text-sm">Buscar</label>
                            <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dtEmpresa, $event)" />
                        </div>
                    </div>
                    <p-table
                        #dtEmpresa
                        [value]="cargando ? [] : items"
                        [loading]="cargando"
                        [showLoader]="false"
                        [paginator]="true"
                        [alwaysShowPaginator]="true"
                        [rows]="10"
                        [rowsPerPageOptions]="filasTabla"
                        [showCurrentPageReport]="true"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} gastos"
                        [globalFilterFields]="['fecha', 'categoria', 'concepto', 'usuario.username']"
                        [rowHover]="true"
                        sortMode="single"
                        responsiveLayout="scroll"
                    >
                        <ng-template #header>
                            <tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Persona</th><th>Monto</th><th>Pendiente</th><th>Estado</th></tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>{{ formatFecha(item.fecha) }}</td>
                                <td>{{ item.categoria || 'Otros' }}</td>
                                <td>{{ item.concepto }}</td>
                                <td>{{ item.persona || '-' }}</td>
                                <td>{{ formatBs(item.monto) }}</td>
                                <td>{{ item.saldo_pendiente ? formatBs(item.saldo_pendiente) : '-' }}</td>
                                <td>
                                    <p-tag [value]="etiquetaEstado(item)" [severity]="severidadEstado(item)" />
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #loadingbody>
                            <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="7" [fila]="f"></tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr><td colspan="7"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>
        </div>
        <div class="card" *ngIf="!listandoEmpresa">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dtLista, $event)" />
                </div>
            </div>
            <p-table
                #dtLista
                [value]="cargando ? [] : items"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                [globalFilterFields]="['fecha', 'concepto', 'tipo', 'usuario.username']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th *ngIf="filtroTipo === ''">Tipo</th>
                        <th>Concepto</th>
                        <th>Persona</th>
                        <th>Monto</th>
                        <th>Pendiente</th>
                        <th>Caja</th>
                        <th>Estado</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td *ngIf="filtroTipo === ''">{{ etiquetaTipo(item.tipo) }}</td>
                        <td>{{ item.concepto }}</td>
                        <td>{{ item.persona || '-' }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ item.saldo_pendiente ? formatBs(item.saldo_pendiente) : '-' }}</td>
                        <td><p-tag [value]="item.descontar_caja ? 'Descontado' : 'Sin descontar'" [severity]="item.descontar_caja ? 'danger' : 'secondary'" /></td>
                        <td><p-tag [value]="etiquetaEstado(item)" [severity]="severidadEstado(item)" /></td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="columnasLista" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td [attr.colspan]="columnasLista"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog [header]="titulo" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <p class="text-muted-color text-sm" *ngIf="esEmpresa">Al contado sale de caja al guardar. A crédito solo queda como cuenta por pagar y la caja no se mueve hasta que registres el pago. Los servicios de un productor (flete, trilla) van en Compras para que carguen a su cuenta.</p>
                <div *ngIf="esEmpresa">
                    <label class="flex items-center gap-1 font-bold mb-2">Categoría <app-ayuda-campo texto="Clasifica el gasto (combustible, energía, etc.) para el reporte." posicion="right" /></label>
                    <p-select [options]="categorias" [(ngModel)]="categoria" placeholder="Categoría" fluid />
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Concepto <app-ayuda-campo texto="Ej.: Combustible camión, almuerzo cuadrilla, luz planta." posicion="right" /></label><input pInputText class="w-full" [(ngModel)]="concepto" /></div>
                <div *ngIf="esEmpresa">
                    <label class="flex items-center gap-1 font-bold mb-2">Persona o proveedor <app-ayuda-campo texto="A quién le pagamos: taller, mecánico, electricista. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="persona" />
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="Importe total del gasto, aunque lo paguemos después." posicion="right" /></label><app-input-numero [(ngModel)]="monto" /></div>
                <div *ngIf="esEmpresa">
                    <label class="flex items-center gap-1 font-bold mb-2">¿Cómo se paga? <app-ayuda-campo texto="Contado: sale de caja ahora. Crédito: queda por pagar y no mueve caja." posicion="right" /></label>
                    <p-select [options]="condiciones" optionLabel="label" optionValue="value" [(ngModel)]="condicion" fluid />
                </div>
                <div *ngIf="aCredito">
                    <label class="flex items-center gap-1 font-bold mb-2">Plazo de pago <app-ayuda-campo texto="Hasta cuándo tenemos para pagar. Opcional." posicion="right" /></label>
                    <p-select [options]="plazosCredito" optionLabel="label" optionValue="value" [(ngModel)]="plazoDias" fluid />
                    <small class="block text-muted-color mt-1" *ngIf="plazoDias > 0">Vence el {{ vencimientoEstimado }}</small>
                </div>
                <div *ngIf="aCredito && plazoDias === -1">
                    <label class="flex items-center gap-1 font-bold mb-2">Fecha de vencimiento <app-ayuda-campo texto="Día en que debemos cancelar el saldo." posicion="right" /></label>
                    <p-datepicker [(ngModel)]="fechaVencimiento" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [minDate]="hoy" [readonlyInput]="true" fluid />
                </div>
                <small class="text-muted-color" *ngIf="aCredito">No sale dinero de caja ahora. Queda en Cuentas por pagar por {{ formatBs(monto) }}.</small>
                <div class="flex items-center gap-2" *ngIf="esRetiro">
                    <p-checkbox [(ngModel)]="descontarCaja" [binary]="true" inputId="descontarCaja" />
                    <label for="descontarCaja">Descontar de la caja</label>
                    <app-ayuda-campo texto="Si está marcado, el retiro sale de la caja abierta. Si no, solo se anota." posicion="right" />
                </div>
                <small class="text-muted-color" *ngIf="esRetiro && !descontarCaja">Se registra el retiro, pero no sale dinero de caja.</small>
                <div *ngIf="descuentaCaja">
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR sale del banco. Efectivo del cajón. Mixto parte el egreso." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="metodo" [montoTotal]="monto" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" />
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia o factura. Opcional." posicion="top" /></label><input pInputText class="w-full" [(ngModel)]="referencia" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Detalle interno del gasto o retiro." posicion="top" /></label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
        <p-dialog header="Pagar cuenta" [(visible)]="dialogPago" [modal]="true" [style]="{ width: '30rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4" *ngIf="gastoPago">
                <div class="text-sm">
                    <div class="font-semibold">{{ gastoPago.concepto }}</div>
                    <div class="text-muted-color">{{ gastoPago.persona || 'Sin persona registrada' }} · Pendiente {{ formatBs(gastoPago.saldo_pendiente) }}</div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Monto a pagar <app-ayuda-campo texto="Puede ser un pago parcial. No puede superar el pendiente." posicion="right" /></label>
                    <app-input-numero [(ngModel)]="montoPago" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Este pago sí sale de caja. Debe haber caja abierta." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="metodoPagoCuenta" [montoTotal]="montoPago" [(montoEfectivo)]="efectivoPago" [(montoQr)]="qrPago" />
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Nro. de transferencia o recibo. Opcional." posicion="top" /></label><input pInputText class="w-full" [(ngModel)]="referenciaPago" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Detalle interno del pago." posicion="top" /></label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacionPago"></textarea></div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogPago = false" />
                <p-button label="Registrar pago" [loading]="pagando" (onClick)="pagar()" />
            </ng-template>
        </p-dialog>
    `
})
export class GastosPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    tipo = 'GASTO_EMPRESA';
    filtroTipo = 'GASTO_EMPRESA';
    tiposFiltro = [
        { label: 'Empresa', value: 'GASTO_EMPRESA' },
        { label: 'Personal', value: 'RETIRO_PERSONAL' },
        { label: 'Todos', value: '' }
    ];
    titulo = 'Gastos de empresa';
    subtitulo = 'Gastos y servicios al contado o a crédito. A crédito la caja no se mueve hasta que registres el pago.';
    items: any[] = [];
    cargando = false;
    guardando = false;
    dialogCajaCerrada = false;
    dialog = false;
    concepto = '';
    categoria = 'Otros';
    persona = '';
    monto = 0;
    condicion = 'CONTADO';
    condiciones = [
        { label: 'Al contado (sale de caja ahora)', value: 'CONTADO' },
        { label: 'A crédito (queda por pagar)', value: 'CREDITO' }
    ];
    plazosCredito = [
        { label: 'Sin plazo', value: 0 },
        { label: '7 días', value: 7 },
        { label: '15 días', value: 15 },
        { label: '30 días', value: 30 },
        { label: 'Fecha exacta', value: -1 }
    ];
    plazoDias = 0;
    fechaVencimiento: Date | null = null;
    hoy = new Date();
    metodo = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    descontarCaja = true;
    referencia = '';
    observacion = '';
    categorias = CATEGORIAS;
    dialogPago = false;
    pagando = false;
    gastoPago: any = null;
    montoPago = 0;
    metodoPagoCuenta = 'EFECTIVO';
    efectivoPago = 0;
    qrPago = 0;
    referenciaPago = '';
    observacionPago = '';
    chartData: any;
    chartOptions: any = { plugins: { legend: { position: 'bottom' } } };
    formatBs = formatBs;
    formatFecha = formatFecha;
    formatFechaCorta = formatFechaCorta;
    etiquetaPago = etiquetaPago;

    constructor(private route: ActivatedRoute, private http: HttpClient, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.tipo = this.route.snapshot.data['tipo'] || 'GASTO_EMPRESA';
        this.filtroTipo = this.tipo;
        this.titulo = this.route.snapshot.data['titulo'] || this.titulo;
        if (this.esRetiro) {
            this.subtitulo = 'Dinero retirado de la empresa para uso personal. No se mezcla con gastos operativos.';
        }
        this.cargar();
    }

    get listandoEmpresa(): boolean {
        return this.filtroTipo === 'GASTO_EMPRESA';
    }

    get esEmpresa(): boolean {
        return this.tipo === 'GASTO_EMPRESA';
    }

    get aCredito(): boolean {
        return this.esEmpresa && this.condicion === 'CREDITO';
    }

    /** Solo un gasto al contado (o un retiro marcado) mueve la caja al registrarse. */
    get descuentaCaja(): boolean {
        if (this.aCredito) {
            return false;
        }
        return this.esEmpresa || this.descontarCaja;
    }

    get columnasLista(): number {
        return this.filtroTipo === '' ? 9 : 8;
    }

    get porPagar(): any[] {
        return this.items.filter((item) => item.condicion === 'CREDITO' && Number(item.saldo_pendiente || 0) > 0);
    }

    get totalPorPagar(): number {
        return this.porPagar.reduce((acc, item) => acc + Number(item.saldo_pendiente || 0), 0);
    }

    get vencimientoEstimado(): string {
        if (this.plazoDias <= 0) {
            return '';
        }
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + this.plazoDias);
        return formatFechaCorta(fecha);
    }

    etiquetaEstado(item: any): string {
        if (item.condicion !== 'CREDITO') {
            return 'Contado';
        }
        return item.vencido ? 'VENCIDO' : item.estado;
    }

    severidadEstado(item: any): 'success' | 'danger' | 'warn' | 'info' {
        if (item.condicion !== 'CREDITO') {
            return 'success';
        }
        if (item.vencido) {
            return 'danger';
        }
        if (item.estado === 'PAGADO') {
            return 'success';
        }
        return item.estado === 'PARCIAL' ? 'warn' : 'info';
    }

    etiquetaTipo(tipo: string): string {
        return tipo === 'RETIRO_PERSONAL' ? 'Personal' : 'Empresa';
    }

    get esRetiro(): boolean {
        return this.tipo === 'RETIRO_PERSONAL';
    }

    get iconoVacio(): string {
        return this.esRetiro ? 'pi pi-user' : 'pi pi-briefcase';
    }

    get tituloVacio(): string {
        return this.esRetiro ? 'No hay retiros personales' : 'No hay gastos de empresa';
    }

    get mensajeVacio(): string {
        return this.esRetiro
            ? 'Los retiros salen como egreso solo si marcas descontar de la caja.'
            : 'Registra combustible, energía u otros gastos operativos.';
    }

    get kpis(): KpiItem[] {
        const mayor = this.categoriaMayor;
        return [
            { label: this.esRetiro ? 'Retiros hoy' : 'Gastos hoy', value: formatBs(this.sumaPeriodo('dia')), icon: 'pi pi-calendar', tone: 'danger' },
            { label: this.esRetiro ? 'Retiros del mes' : 'Gastos del mes', value: formatBs(this.sumaPeriodo('mes')), icon: 'pi pi-wallet', tone: 'danger' },
            {
                label: this.esRetiro ? 'Cantidad de retiros' : 'Categoría con mayor gasto',
                value: this.esRetiro ? String(this.items.length) : mayor.label,
                icon: 'pi pi-chart-bar',
                tone: 'warn',
                hint: this.esRetiro ? undefined : formatBs(mayor.monto)
            }
        ];
    }

    get categoriaMayor(): { label: string; monto: number } {
        const acc: Record<string, number> = {};
        for (const item of this.items) {
            const cat = item.categoria || 'Otros';
            acc[cat] = (acc[cat] || 0) + Number(item.monto || 0);
        }
        const entries = Object.entries(acc).sort((a, b) => b[1] - a[1]);
        if (!entries.length) {
            return { label: '-', monto: 0 };
        }
        return { label: entries[0][0], monto: entries[0][1] };
    }

    abrir(): void {
        this.concepto = '';
        this.categoria = 'Otros';
        this.persona = '';
        this.monto = 0;
        this.condicion = 'CONTADO';
        this.plazoDias = 0;
        this.fechaVencimiento = null;
        this.hoy = new Date();
        this.metodo = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
        this.descontarCaja = true;
        this.referencia = '';
        this.observacion = '';
        this.dialog = true;
    }

    abrirPago(item: any): void {
        this.gastoPago = item;
        this.montoPago = Number(item.saldo_pendiente || 0);
        this.metodoPagoCuenta = 'EFECTIVO';
        this.efectivoPago = 0;
        this.qrPago = 0;
        this.referenciaPago = '';
        this.observacionPago = '';
        this.dialogPago = true;
    }

    pagar(): void {
        if (!this.gastoPago || !this.montoPago) {
            this.aviso.aviso('Validación', 'Indique el monto a pagar');
            return;
        }
        if (this.montoPago > Number(this.gastoPago.saldo_pendiente || 0)) {
            this.aviso.aviso('Validación', 'El monto supera el saldo pendiente');
            return;
        }
        const mixto = mensajePagoMixto(this.metodoPagoCuenta, this.montoPago, this.efectivoPago, this.qrPago);
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.pagando = true;
        this.http.post<{ mensaje: string }>(apiUrl(`/api/gastos/${this.gastoPago.id}/pagos`), {
            monto: this.montoPago,
            metodo_pago: this.metodoPagoCuenta,
            referencia: this.referenciaPago || undefined,
            observacion: this.observacionPago || undefined,
            ...extrasPagoMixto(this.metodoPagoCuenta, this.efectivoPago, this.qrPago)
        }).subscribe({
            next: (res) => {
                this.pagando = false;
                this.dialogPago = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.pagando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.aviso.error(err, 'No se pudo registrar el pago');
            }
        });
    }

    cargar(): void {
        this.cargando = true;
        const params: { tipo?: string } = {};
        if (this.filtroTipo) {
            params.tipo = this.filtroTipo;
        }
        this.http.get<any[]>(apiUrl('/api/gastos'), { params }).subscribe({
            next: (data) => {
                this.items = data;
                this.cargando = false;
                this.armarChart();
            },
            error: (err) => { this.cargando = false; this.aviso.error(err, 'No se pudo cargar'); }
        });
    }

    guardar(): void {
        if (!this.concepto.trim() || !this.monto) {
            this.aviso.aviso('Validación', 'Concepto y monto son obligatorios');
            return;
        }
        const descuenta = this.descuentaCaja;
        const mixto = descuenta ? mensajePagoMixto(this.metodo, this.monto, this.montoEfectivo, this.montoQr) : null;
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        if (this.aCredito && this.plazoDias === -1 && !this.fechaVencimiento) {
            this.aviso.aviso('Validación', 'Indique la fecha de vencimiento o elija un plazo en días');
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/gastos'), {
            tipo: this.tipo,
            concepto: this.concepto.trim(),
            categoria: this.esEmpresa ? this.categoria : undefined,
            persona: this.esEmpresa ? this.persona.trim() || undefined : undefined,
            monto: this.monto,
            condicion: this.esEmpresa ? this.condicion : 'CONTADO',
            descontar_caja: this.esEmpresa ? !this.aCredito : this.descontarCaja,
            metodo_pago: descuenta ? this.metodo : undefined,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined,
            ...(descuenta ? extrasPagoMixto(this.metodo, this.montoEfectivo, this.montoQr) : {}),
            ...this.plazoPayload()
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.aviso.error(err, 'No se pudo guardar');
            }
        });
    }

    private plazoPayload(): { plazo_dias?: number; fecha_vencimiento?: string } {
        if (!this.aCredito) {
            return {};
        }
        if (this.plazoDias === -1 && this.fechaVencimiento) {
            const f = this.fechaVencimiento;
            const mes = String(f.getMonth() + 1).padStart(2, '0');
            const dia = String(f.getDate()).padStart(2, '0');
            return { fecha_vencimiento: `${f.getFullYear()}-${mes}-${dia}` };
        }
        if (this.plazoDias > 0) {
            return { plazo_dias: this.plazoDias };
        }
        return {};
    }

    private sumaPeriodo(tipo: 'dia' | 'mes'): number {
        const ahora = new Date();
        return this.items
            .filter((item) => {
                const f = new Date(item.fecha);
                if (tipo === 'dia') {
                    return f.toDateString() === ahora.toDateString();
                }
                return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
            })
            .reduce((acc, item) => acc + Number(item.monto || 0), 0);
    }

    private armarChart(): void {
        const acc: Record<string, number> = {};
        for (const item of this.items) {
            const cat = item.categoria || 'Otros';
            acc[cat] = (acc[cat] || 0) + Number(item.monto || 0);
        }
        this.chartData = {
            labels: Object.keys(acc),
            datasets: [{ data: Object.values(acc), backgroundColor: ['#4ade80', '#f87171', '#fb923c', '#60a5fa', '#a78bfa', '#fbbf24', '#34d399', '#94a3b8'] }]
        };
    }
}
