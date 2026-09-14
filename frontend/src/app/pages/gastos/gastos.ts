import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { etiquetaMetodo, formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { apiUrl } from '../../core/utils/api-url';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';

const CATEGORIAS = ['Combustible', 'Transporte', 'Energía', 'Mantenimiento', 'Repuestos', 'Servicios', 'Alimentación', 'Otros'];

@Component({
    selector: 'app-gastos',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ChartModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TextareaModule, ToastModule, EstadoVacioComponent, KpiGridComponent, DialogCajaCerradaComponent],
    providers: [MessageService],
    template: `
        <p-toast />
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">{{ titulo }}</div>
                <div class="text-muted-color">{{ subtitulo }}</div>
            </div>
            <p-button [label]="esRetiro ? 'Registrar retiro' : 'Registrar gasto'" icon="pi pi-plus" (onClick)="abrir()" />
        </div>
        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" />
        <div class="grid grid-cols-12 gap-4 mb-4" *ngIf="esEmpresa">
            <div class="col-span-12 xl:col-span-5">
                <div class="card">
                    <div class="font-semibold text-xl mb-3">Por categoría</div>
                    <p-chart type="doughnut" [data]="chartData" [options]="chartOptions" *ngIf="items.length" />
                    <app-estado-vacio *ngIf="!items.length && !cargando" icono="pi pi-chart-pie" titulo="Sin gastos para graficar" mensaje="Registra gastos operativos para ver el resumen." />
                </div>
            </div>
            <div class="col-span-12 xl:col-span-7">
                <div class="card">
                    <p-table [value]="items" [loading]="cargando" [paginator]="true" [rows]="8" responsiveLayout="scroll">
                        <ng-template #header>
                            <tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Usuario</th></tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>{{ formatFecha(item.fecha) }}</td>
                                <td>{{ item.categoria || 'Otros' }}</td>
                                <td>{{ item.concepto }}</td>
                                <td>{{ formatBs(item.monto) }}</td>
                                <td>{{ etiquetaMetodo(item.metodo_pago) }}</td>
                                <td>{{ item.usuario?.username || '-' }}</td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr><td colspan="6"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>
        </div>
        <div class="card" *ngIf="!esEmpresa">
            <p-table [value]="items" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Usuario</th></tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ item.concepto }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ etiquetaMetodo(item.metodo_pago) }}</td>
                        <td>{{ item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5"><app-estado-vacio [icono]="iconoVacio" [titulo]="tituloVacio" [mensaje]="mensajeVacio" /></td></tr>
                </ng-template>
            </p-table>
        </div>
        <p-dialog [header]="titulo" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }">
            <div class="flex flex-col gap-4">
                <div *ngIf="esEmpresa">
                    <label class="block font-bold mb-2">Categoría</label>
                    <p-select [options]="categorias" [(ngModel)]="categoria" placeholder="Categoría" fluid />
                </div>
                <div><label class="block font-bold mb-2">Concepto</label><input pInputText class="w-full" [(ngModel)]="concepto" /></div>
                <div><label class="block font-bold mb-2">Monto</label><p-inputNumber [(ngModel)]="monto" mode="decimal" [min]="0.01" [minFractionDigits]="2" prefix="Bs " fluid /></div>
                <div><label class="block font-bold mb-2">Método</label><p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="metodo" fluid /></div>
                <div><label class="block font-bold mb-2">Referencia</label><input pInputText class="w-full" [(ngModel)]="referencia" /></div>
                <div><label class="block font-bold mb-2">Observación</label><textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea></div>
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
    referencia = '';
    observacion = '';
    metodos = METODOS_PAGO_OPTIONS;
    categorias = CATEGORIAS;
    chartData: any;
    chartOptions: any = { plugins: { legend: { position: 'bottom' } } };
    formatBs = formatBs;
    formatFecha = formatFecha;
    etiquetaMetodo = etiquetaMetodo;

    constructor(private route: ActivatedRoute, private http: HttpClient, private messageService: MessageService) {}

    ngOnInit(): void {
        this.tipo = this.route.snapshot.data['tipo'] || 'GASTO_EMPRESA';
        this.titulo = this.route.snapshot.data['titulo'] || this.titulo;
        if (this.esRetiro) {
            this.subtitulo = 'Dinero retirado de la empresa para uso personal. No se mezcla con gastos operativos.';
        }
        this.cargar();
    }

    get esEmpresa(): boolean {
        return this.tipo === 'GASTO_EMPRESA';
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
            ? 'Los retiros salen como egreso, separados de los gastos operativos.'
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
        this.referencia = '';
        this.observacion = '';
        this.dialog = true;
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<any[]>(apiUrl('/api/gastos'), { params: { tipo: this.tipo } }).subscribe({
            next: (data) => {
                this.items = data;
                this.cargando = false;
                this.armarChart();
            },
            error: (err) => { this.cargando = false; this.toast(err, 'No se pudo cargar'); }
        });
    }

    guardar(): void {
        if (!this.concepto.trim() || !this.monto) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Concepto y monto son obligatorios' });
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/gastos'), {
            tipo: this.tipo,
            concepto: this.concepto.trim(),
            categoria: this.esEmpresa ? this.categoria : undefined,
            monto: this.monto,
            metodo_pago: this.metodo,
            referencia: this.referencia || undefined,
            observacion: this.observacion || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.messageService.add({ severity: 'success', summary: 'Listo', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => { this.guardando = false; this.toast(err, 'No se pudo guardar'); }
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

    private toast(err: HttpErrorResponse, fallback: string): void {
        if (esErrorCajaCerrada(err)) {
            this.dialogCajaCerrada = true;
            return;
        }
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.mensaje || err?.error?.errores?.[0] || fallback });
    }
}
