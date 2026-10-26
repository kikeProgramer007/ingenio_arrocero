import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { apiUrl } from '../../core/utils/api-url';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { AvisoService } from '../../shared/services/aviso.service';
import { ymdDesdeRango, ymdHastaRango } from '../../shared/utils/fecha-filtro';
import { formatBs, formatFecha } from './caja.utils';

interface ResumenChica {
    id: number;
    saldo: number;
    ingresos: number;
    egresos: number;
    arqueos: ArqueoChica[];
}

interface ArqueoChica {
    id: number;
    fecha: string;
    saldo_esperado: number;
    saldo_contado: number;
    diferencia: number;
    resultado: string;
    observacion?: string | null;
    usuario?: { nombre?: string; username?: string } | null;
}

interface MovimientoChica {
    id: number;
    fecha: string;
    tipo: string;
    categoria: string;
    concepto: string;
    monto: number;
    usuario?: { nombre?: string; username?: string } | null;
}

@Component({
    selector: 'app-caja-chica',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, AyudaCampoComponent, EstadoVacioComponent, InputNumeroComponent, KpiGridComponent],
    template: `
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Caja chica</div>
                <div class="text-muted-color">Solo efectivo. El saldo pasa de un día a otro y no requiere apertura ni cierre.</div>
            </div>
            <div class="flex gap-2">
                <p-button label="Agregar fondos" icon="pi pi-plus" (onClick)="abrirAporte()" />
                <p-button label="Arqueo" icon="pi pi-calculator" severity="secondary" [outlined]="true" (onClick)="abrirArqueo()" />
            </div>
        </div>
        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="3" [compact]="true" />
        <div class="card mb-4">
            <div class="barra-listado">
                <div class="campo">
                    <label class="block font-bold mb-1 text-sm">Tipo</label>
                    <p-select [options]="tipos" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipo" placeholder="Todos" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-fecha">
                    <label class="block font-bold mb-1 text-sm">Período</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargarMovimientos()" [loading]="cargando" />
            </div>
        </div>
        <div class="card mb-4">
            <div class="font-semibold text-lg mb-3">Movimientos</div>
            <p-table [value]="movimientos" [paginator]="true" [rows]="10" [loading]="cargando">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th>Monto</th>
                        <th>Usuario</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td><p-tag [value]="item.tipo === 'INGRESO' ? 'Ingreso' : 'Salida'" [severity]="item.tipo === 'INGRESO' ? 'success' : 'danger'" /></td>
                        <td>{{ item.concepto }}</td>
                        <td>{{ formatBs(item.monto) }}</td>
                        <td>{{ item.usuario?.nombre || item.usuario?.username || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5"><app-estado-vacio icono="pi pi-wallet" titulo="Sin movimientos" mensaje="Los aportes, retiros y salidas de caja chica aparecen aquí." /></td></tr>
                </ng-template>
            </p-table>
        </div>
        <div class="card" *ngIf="resumen?.arqueos?.length">
            <div class="font-semibold text-lg mb-3">Arqueos</div>
            <p-table [value]="resumen?.arqueos || []" [paginator]="true" [rows]="5">
                <ng-template #header>
                    <tr><th>Fecha</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Resultado</th></tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ formatFecha(item.fecha) }}</td>
                        <td>{{ formatBs(item.saldo_esperado) }}</td>
                        <td>{{ formatBs(item.saldo_contado) }}</td>
                        <td>{{ formatBs(item.diferencia) }}</td>
                        <td>{{ item.resultado }}</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Agregar fondos" [(visible)]="dialogAporte" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Procedencia <app-ayuda-campo texto="Desde caja principal no es un gasto. Un aporte externo no es una venta." posicion="right" /></label>
                    <p-select [options]="origenes" optionLabel="label" optionValue="value" [(ngModel)]="origen" fluid appendTo="body" [baseZIndex]="2100" />
                </div>
                <div *ngIf="origen === 'EXTERNO'">
                    <label class="block font-bold mb-2">De dónde viene</label>
                    <input pInputText class="w-full" [(ngModel)]="procedencia" maxlength="120" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Monto</label>
                    <app-input-numero [(ngModel)]="monto" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Motivo</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="motivo"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAporte = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="guardarAporte()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Arqueo de caja chica" [(visible)]="dialogArqueo" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <p class="text-muted-color text-sm">Contar el efectivo no cierra la caja ni impide seguir usándola.</p>
                <div class="text-sm">Saldo esperado: <b>{{ formatBs(resumen?.saldo || 0) }}</b></div>
                <div>
                    <label class="block font-bold mb-2">Efectivo contado</label>
                    <app-input-numero [(ngModel)]="contado" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacionArqueo"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogArqueo = false" />
                <p-button label="Guardar arqueo" [loading]="guardando" (onClick)="guardarArqueo()" />
            </ng-template>
        </p-dialog>
    `
})
export class CajaChica implements OnInit {
    resumen: ResumenChica | null = null;
    movimientos: MovimientoChica[] = [];
    cargando = false;
    guardando = false;
    dialogAporte = false;
    dialogArqueo = false;
    origen = 'CAJA_PRINCIPAL';
    procedencia = '';
    monto = 0;
    motivo = '';
    contado = 0;
    observacionArqueo = '';
    filtroTipo = '';
    rango: Date[] | null = null;
    tipos = [
        { label: 'Ingresos', value: 'INGRESO' },
        { label: 'Salidas', value: 'EGRESO' }
    ];
    origenes = [
        { label: 'Caja principal', value: 'CAJA_PRINCIPAL' },
        { label: 'Fuente externa', value: 'EXTERNO' }
    ];
    formatBs = formatBs;
    formatFecha = formatFecha;

    constructor(private http: HttpClient, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.cargar();
    }

    get kpis(): KpiItem[] {
        return [
            { label: 'Saldo', value: formatBs(this.resumen?.saldo || 0), icon: 'pi pi-wallet', tone: 'success' },
            { label: 'Ingresos', value: formatBs(this.resumen?.ingresos || 0), icon: 'pi pi-arrow-down', tone: 'info' },
            { label: 'Salidas', value: formatBs(this.resumen?.egresos || 0), icon: 'pi pi-arrow-up', tone: 'danger' }
        ];
    }

    cargar(): void {
        this.cargando = true;
        this.http.get<ResumenChica>(apiUrl('/api/caja-chica')).subscribe({
            next: (data) => {
                this.resumen = data;
                this.cargarMovimientos();
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo consultar la caja chica');
            }
        });
    }

    cargarMovimientos(): void {
        const params: Record<string, string> = {};
        if (this.filtroTipo) {
            params['tipo'] = this.filtroTipo;
        }
        const desde = ymdDesdeRango(this.rango);
        const hasta = ymdHastaRango(this.rango);
        if (desde) {
            params['fecha_desde'] = desde;
        }
        if (hasta) {
            params['fecha_hasta'] = hasta;
        }
        this.http.get<MovimientoChica[]>(apiUrl('/api/caja-chica/movimientos'), { params }).subscribe({
            next: (data) => {
                this.movimientos = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudieron listar los movimientos');
            }
        });
    }

    abrirAporte(): void {
        this.origen = 'CAJA_PRINCIPAL';
        this.procedencia = '';
        this.monto = 0;
        this.motivo = '';
        this.dialogAporte = true;
    }

    guardarAporte(): void {
        if (!this.monto || !this.motivo.trim()) {
            this.aviso.aviso('Validación', 'Monto y motivo son obligatorios');
            return;
        }
        if (this.origen === 'EXTERNO' && !this.procedencia.trim()) {
            this.aviso.aviso('Validación', 'Indique de dónde viene el aporte');
            return;
        }
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/caja-chica/aportes'), {
            origen: this.origen,
            monto: this.monto,
            motivo: this.motivo.trim(),
            procedencia: this.procedencia.trim() || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogAporte = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo agregar fondos');
            }
        });
    }

    abrirArqueo(): void {
        this.contado = this.resumen?.saldo || 0;
        this.observacionArqueo = '';
        this.dialogArqueo = true;
    }

    guardarArqueo(): void {
        this.guardando = true;
        this.http.post<{ mensaje: string }>(apiUrl('/api/caja-chica/arqueos'), {
            saldo_contado: this.contado,
            observacion: this.observacionArqueo.trim() || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogArqueo = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo guardar el arqueo');
            }
        });
    }
}
