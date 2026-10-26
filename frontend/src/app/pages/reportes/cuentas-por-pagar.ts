import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { AvisoService } from '../../shared/services/aviso.service';
import { apiUrl } from '../../core/utils/api-url';
import { formatFecha } from '../caja/caja.utils';
import { formatBs, formatUsd } from '../../shared/utils/money';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { ProveedoresService } from '../compras/compras.service';
import { Proveedor } from '../compras/compras.models';

interface FilaConsolidada {
    id: number;
    proveedor: string;
    saldo_bs: number;
    saldo_usd: number;
    fanegas: number;
}

interface LineaDetalle {
    fecha: string;
    ordenante?: string;
    tipo: string;
    detalle: string;
    boleta?: string;
    chofer?: string;
    placa?: string;
    fanegas?: number;
    precio?: number;
    precio_usd?: number;
    cargo?: number;
    cargo_usd?: number;
    abono?: number;
    abono_usd?: number;
    saldo: number;
    saldo_usd?: number;
}

interface RespuestaCuentas {
    corte: string | null;
    filas: FilaConsolidada[];
    totales: { saldo_bs: number; saldo_usd: number; fanegas: number };
    detalle: {
        proveedor: { id: number; nombre: string };
        resumen: { saldo_anterior: number; saldo: number; saldo_usd: number };
        kardex: LineaDetalle[];
    } | null;
}

@Component({
    selector: 'app-cuentas-por-pagar',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, InputTextModule, SelectModule, TableModule, BotonesExportarComponent, EstadoVacioComponent],
    template: `
        <div class="card mb-4">
            <div class="flex flex-wrap items-end gap-3">
                <div class="w-full sm:w-64">
                    <label class="block font-bold mb-1 text-sm">Proveedor</label>
                    <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Todos" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="w-full sm:w-40">
                    <label class="block font-bold mb-1 text-sm">Desde</label>
                    <p-datepicker [(ngModel)]="desde" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Inicio" fluid appendTo="body" />
                </div>
                <div class="w-full sm:w-40">
                    <label class="block font-bold mb-1 text-sm">Corte</label>
                    <p-datepicker [(ngModel)]="hasta" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="A la fecha" fluid appendTo="body" />
                </div>
                <div class="w-full sm:w-44">
                    <label class="block font-bold mb-1 text-sm">Tipo</label>
                    <p-select [options]="tipos" optionLabel="label" optionValue="value" [(ngModel)]="tipoCompra" placeholder="Todos" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="w-full sm:w-52">
                    <label class="block font-bold mb-1 text-sm">Ordenante</label>
                    <input pInputText class="w-full" [(ngModel)]="ordenante" placeholder="Texto libre" maxlength="150" />
                </div>
                <p-button label="Consultar" icon="pi pi-search" (onClick)="cargar()" [loading]="cargando" />
                <app-botones-exportar tipo="cuentas_por_pagar" [idProveedor]="idProveedor" [fechaHasta]="ymd(hasta)" [tipoCompra]="tipoCompra" [ordenante]="ordenante" />
                <app-botones-exportar *ngIf="idProveedor" tipo="cuenta_proveedor" [id]="idProveedor" [fechaDesde]="ymd(desde)" [fechaHasta]="ymd(hasta)" [tipoCompra]="tipoCompra" [ordenante]="ordenante" />
            </div>
            <p class="text-sm text-muted-color mt-3 mb-0">El consolidado es el saldo a la fecha de corte. El detalle, si elige un proveedor, muestra el movimiento y el saldo anterior cuando hay fecha desde. La deuda va en Bs; el USD es referencial.</p>
        </div>

        <div class="card mb-4">
            <div class="font-semibold text-lg mb-3">Consolidado {{ datos?.corte ? 'al ' + datos?.corte : 'a la fecha' }}</div>
            <p-table [value]="datos?.filas || []" [loading]="cargando" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Proveedor</th>
                        <th class="text-right">Saldo Bs</th>
                        <th class="text-right">Saldo USD ref.</th>
                        <th class="text-right">Fanegas</th>
                    </tr>
                </ng-template>
                <ng-template #body let-fila>
                    <tr>
                        <td>{{ fila.proveedor }}</td>
                        <td class="text-right">{{ formatBs(fila.saldo_bs) }}</td>
                        <td class="text-right">{{ fila.saldo_usd ? formatUsd(fila.saldo_usd) : '-' }}</td>
                        <td class="text-right">{{ fila.fanegas || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #footer>
                    <tr *ngIf="datos?.filas?.length">
                        <td class="font-semibold">TOTAL</td>
                        <td class="text-right font-semibold">{{ formatBs(datos?.totales?.saldo_bs) }}</td>
                        <td class="text-right font-semibold">{{ datos?.totales?.saldo_usd ? formatUsd(datos?.totales?.saldo_usd) : '-' }}</td>
                        <td class="text-right font-semibold">{{ datos?.totales?.fanegas || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="4"><app-estado-vacio icono="pi pi-wallet" titulo="Sin saldos" mensaje="No hay cuentas por pagar para estos filtros." /></td></tr>
                </ng-template>
            </p-table>
        </div>

        <div class="card" *ngIf="idProveedor">
            <div class="font-semibold text-lg mb-1">Detalle de {{ datos?.detalle?.proveedor?.nombre || 'proveedor' }}</div>
            <p class="text-sm text-muted-color mb-3" *ngIf="datos?.detalle?.resumen">Saldo anterior {{ formatBs(datos?.detalle?.resumen?.saldo_anterior) }} · Saldo final {{ formatBs(datos?.detalle?.resumen?.saldo) }}</p>
            <p-table [value]="datos?.detalle?.kardex || []" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th><th>Ordenante</th><th>Tipo</th><th>Concepto</th><th>Boleta</th><th>Chofer</th><th>Placa</th><th class="text-right">Fanegas</th>
                        <th class="text-right">Precio Bs</th><th class="text-right">Precio USD</th>
                        <th class="text-right">Compra Bs</th><th class="text-right">Compra USD</th>
                        <th class="text-right">Pago Bs</th><th class="text-right">Pago USD</th>
                        <th class="text-right">Saldo Bs</th><th class="text-right">Saldo USD</th>
                    </tr>
                </ng-template>
                <ng-template #body let-l>
                    <tr>
                        <td>{{ formatFecha(l.fecha) }}</td>
                        <td>{{ l.ordenante || '-' }}</td>
                        <td>{{ l.tipo }}</td>
                        <td>{{ l.detalle }}</td>
                        <td>{{ l.boleta || '-' }}</td>
                        <td>{{ l.chofer || '-' }}</td>
                        <td>{{ l.placa || '-' }}</td>
                        <td class="text-right">{{ l.fanegas || '-' }}</td>
                        <td class="text-right">{{ l.precio ? formatBs(l.precio) : '-' }}</td>
                        <td class="text-right">{{ l.precio_usd ? formatUsd(l.precio_usd) : '-' }}</td>
                        <td class="text-right">{{ l.cargo ? formatBs(l.cargo) : '-' }}</td>
                        <td class="text-right">{{ l.cargo_usd ? formatUsd(l.cargo_usd) : '-' }}</td>
                        <td class="text-right">{{ l.abono ? formatBs(l.abono) : '-' }}</td>
                        <td class="text-right">{{ l.abono_usd ? formatUsd(l.abono_usd) : '-' }}</td>
                        <td class="text-right">{{ formatBs(l.saldo) }}</td>
                        <td class="text-right">{{ l.saldo_usd ? formatUsd(l.saldo_usd) : '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="16"><div class="text-center py-4 text-muted-color">Sin movimientos para este proveedor.</div></td></tr>
                </ng-template>
            </p-table>
        </div>
    `
})
export class CuentasPorPagarPage implements OnInit {
    proveedores: Proveedor[] = [];
    idProveedor: number | null = null;
    desde: Date | null = null;
    hasta: Date | null = null;
    tipoCompra = '';
    ordenante = '';
    cargando = false;
    datos: RespuestaCuentas | null = null;
    tipos = [
        { label: 'Arroz en chala', value: 'CHALA' },
        { label: 'Bolsas y empaques', value: 'BOLSAS' },
        { label: 'Otros / servicios', value: 'OTROS' }
    ];
    formatBs = formatBs;
    formatUsd = formatUsd;
    formatFecha = formatFecha;

    constructor(
        private http: HttpClient,
        private proveedoresService: ProveedoresService,
        private aviso: AvisoService
    ) {}

    ngOnInit(): void {
        this.proveedoresService.listar({ activos: 'todos' }).subscribe({
            next: (data) => (this.proveedores = data),
            error: (err) => this.aviso.error(err, 'No se pudieron cargar los proveedores')
        });
        this.cargar();
    }

    ymd(fecha: Date | null): string | undefined {
        if (!fecha) {
            return undefined;
        }
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    cargar(): void {
        this.cargando = true;
        const params: Record<string, string> = {};
        if (this.idProveedor) {
            params['id_proveedor'] = String(this.idProveedor);
        }
        const desde = this.ymd(this.desde);
        const hasta = this.ymd(this.hasta);
        if (desde) {
            params['fecha_desde'] = desde;
        }
        if (hasta) {
            params['fecha_hasta'] = hasta;
        }
        if (this.tipoCompra) {
            params['tipo_compra'] = this.tipoCompra;
        }
        if (this.ordenante.trim()) {
            params['ordenante'] = this.ordenante.trim();
        }
        this.http.get<RespuestaCuentas>(apiUrl('/api/reportes/cuentas-por-pagar'), { params }).subscribe({
            next: (data) => {
                this.datos = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo consultar cuentas por pagar');
            }
        });
    }
}
