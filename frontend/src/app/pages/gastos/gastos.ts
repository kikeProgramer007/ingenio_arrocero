import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { etiquetaPago, formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { apiUrl } from '../../core/utils/api-url';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';

const CATEGORIAS = ['Combustible', 'Transporte', 'Energía', 'Mantenimiento', 'Repuestos', 'Servicios', 'Alimentación', 'Otros'];

@Component({
    selector: 'app-gastos',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ChartModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, EstadoVacioComponent, KpiGridComponent, DialogCajaCerradaComponent, BotonesExportarComponent, TablaEsqueletoComponent, AyudaCampoComponent, MetodoPagoComponent],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">{{ titulo }}</div>
                <div class="text-muted-color">{{ subtitulo }}</div>
            </div>
            <p-button [label]="esRetiro ? 'Registrar retiro' : 'Registrar gasto'" icon="pi pi-plus" (onClick)="abrir()" />
        </div>
        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />
        <div class="card mb-4">
            <div class="grid grid-cols-12 gap-3 items-end">
                <div class="col-span-12 md:col-span-4">
                    <label class="flex items-center gap-1 font-bold mb-2">Ver <app-ayuda-campo texto="Empresa: gastos operativos. Personal: retiros. Todo: ambos." posicion="bottom" /></label>
                    <p-select [options]="tiposFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipo" placeholder="Tipo" fluid />
                </div>
                <div class="col-span-12 md:col-span-8 flex items-end gap-2 flex-wrap">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                    <app-botones-exportar tipo="egresos" [tipoGasto]="filtroTipo || undefined" />
                </div>
            </div>
        </div>
        <div class="grid grid-cols-12 gap-8 mb-4" *ngIf="listandoEmpresa">
            <div class="col-span-12 xl:col-span-5">
                <div class="card">
                    <div class="font-semibold text-xl mb-3">Por categoría</div>
                    <p-chart type="doughnut" [data]="chartData" [options]="chartOptions" *ngIf="items.length" />
                    <app-estado-vacio *ngIf="!items.length && !cargando" icono="pi pi-chart-pie" titulo="Sin gastos para graficar" mensaje="Registra gastos operativos para ver el resumen." />
                </div>
            </div>
            <div class="col-span-12 xl:col-span-7">
                <div class="card">
                    <p-table [value]="cargando ? [] : items" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="8" responsiveLayout="scroll">
                        <ng-template #header>
                            <tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Usuario</th></tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>{{ formatFecha(item.fecha) }}</td>
                                <td>{{ item.categoria || 'Otros' }}</td>
                                <td>{{ item.concepto }}</td>
                                <td>{{ formatBs(item.monto) }}</td>
                                <td>{{ etiquetaPago(item) }}</td>
                                <td>{{ item.usuario?.username || '-' }}</td>
                            </tr>
                        </ng-template>
                        <ng-template #loadingbody>
                            <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="6" [fila]="f"></tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr><td colspan="6"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>
        </div>
        <div class="card" *ngIf="!listandoEmpresa">
            <p-table [value]="cargando ? [] : items" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th *ngIf="filtroTipo === ''">Tipo</th>
                        <th>Concepto</th>
                        <th>Monto</th>
                        <th>Caja</th>
                        <th>Método</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td *ngIf="filtroTipo === ''">{{ etiquetaTipo(item.tipo) }}</td>
                        <td>{{ item.concepto }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td><p-tag [value]="item.descontar_caja ? 'Descontado' : 'Sin descontar'" [severity]="item.descontar_caja ? 'danger' : 'secondary'" /></td>
                        <td>{{ etiquetaPago(item) }}</td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="filtroTipo === '' ? 7 : 6" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td [attr.colspan]="filtroTipo === '' ? 7 : 6"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog [header]="titulo" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }">
            <div class="flex flex-col gap-4">
                <div *ngIf="esEmpresa">
                    <label class="flex items-center gap-1 font-bold mb-2">Categoría <app-ayuda-campo texto="Clasifica el gasto (combustible, energía, etc.) para el reporte." posicion="right" /></label>
                    <p-select [options]="categorias" [(ngModel)]="categoria" placeholder="Categoría" fluid />
                </div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Concepto <app-ayuda-campo texto="Ej.: Combustible camión, almuerzo cuadrilla, luz planta." posicion="right" /></label><input pInputText class="w-full" [(ngModel)]="concepto" /></div>
                <div><label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="Sale de caja al registrar. Debe haber caja abierta." posicion="right" /></label><p-inputNumber [(ngModel)]="monto" mode="decimal" [min]="0.01" [minFractionDigits]="2" prefix="Bs " fluid /></div>
                <div class="flex items-center gap-2" *ngIf="esRetiro">
                    <p-checkbox [(ngModel)]="descontarCaja" [binary]="true" inputId="descontarCaja" />
                    <label for="descontarCaja">Descontar de la caja</label>
                    <app-ayuda-campo texto="Si está marcado, el retiro sale de la caja abierta. Si no, solo se anota." posicion="right" />
                </div>
                <small class="text-muted-color" *ngIf="esRetiro && !descontarCaja">Se registra el retiro, pero no sale dinero de caja.</small>
                <div *ngIf="!esRetiro || descontarCaja">
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
    `
})
export class GastosPage implements OnInit {
    tipo = 'GASTO_EMPRESA';
    filtroTipo = 'GASTO_EMPRESA';
    tiposFiltro = [
        { label: 'Empresa', value: 'GASTO_EMPRESA' },
        { label: 'Personal', value: 'RETIRO_PERSONAL' },
        { label: 'Todos', value: '' }
    ];
    titulo = 'Gastos de empresa';
    subtitulo = 'Control de egresos operativos de la empresa';
    items: any[] = [];
    cargando = false;
    guardando = false;
    dialogCajaCerrada = false;
    dialog = false;
    concepto = '';
    categoria = 'Otros';
    monto = 0;
    metodo = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    descontarCaja = true;
    referencia = '';
    observacion = '';
    categorias = CATEGORIAS;
    chartData: any;
    chartOptions: any = { plugins: { legend: { position: 'bottom' } } };
    formatBs = formatBs;
    formatFecha = formatFecha;
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
        this.monto = 0;
        this.metodo = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
        this.descontarCaja = true;
        this.referencia = '';
        this.observacion = '';
        this.dialog = true;
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
        const descuenta = this.esEmpresa || this.descontarCaja;
        const mixto = descuenta ? mensajePagoMixto(this.metodo, this.monto, this.montoEfectivo, this.montoQr) : null;
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/gastos'), {
            tipo: this.tipo,
            concepto: this.concepto.trim(),
            categoria: this.esEmpresa ? this.categoria : undefined,
            monto: this.monto,
            descontar_caja: this.esEmpresa ? true : this.descontarCaja,
            metodo_pago: descuenta ? this.metodo : undefined,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined,
            ...(descuenta ? extrasPagoMixto(this.metodo, this.montoEfectivo, this.montoQr) : {})
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
