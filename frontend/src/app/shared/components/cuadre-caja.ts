import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { CajaDetalle } from '../../pages/caja/caja.models';
import { formatBs } from '../../pages/caja/caja.utils';

@Component({
    selector: 'app-cuadre-caja',
    standalone: true,
    imports: [CommonModule, TooltipModule],
    template: `
        <div class="grid grid-cols-12 gap-4" *ngIf="caja">
            <div class="col-span-12 xl:col-span-7">
                <div class="font-semibold text-lg mb-1">Cuadre de caja</div>
                <p class="text-muted-color text-sm mb-4">
                    Solo entra lo que suma o resta dinero en caja.
                    <i class="pi pi-info-circle ml-1" pTooltip="El saldo inicial no es un ingreso del día. Las ventas sin cobro no entran aquí."></i>
                </p>
                <div class="flex flex-col gap-2 text-sm">
                    <div class="flex justify-between py-2 border-b border-surface">
                        <span class="font-semibold">Ingresos</span>
                        <span class="font-semibold text-green-600">{{ formatBs(caja.ingresos) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Cobrado a clientes</span>
                        <span>{{ formatBs(d.cobrado_clientes) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color mb-2">
                        <span>Otros ingresos</span>
                        <span>{{ formatBs(d.otros_ingresos) }}</span>
                    </div>
                    <div class="flex justify-between py-2 border-b border-surface">
                        <span class="font-semibold">Egresos</span>
                        <span class="font-semibold text-red-500">{{ formatBs(caja.egresos) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Pagos a proveedores</span>
                        <span>{{ formatBs(d.pagos_proveedor) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Gastos de empresa</span>
                        <span>{{ formatBs(d.gastos_empresa) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Retiros personales</span>
                        <span>{{ formatBs(d.retiros) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color mb-2">
                        <span>Otros egresos</span>
                        <span>{{ formatBs(d.otros_egresos) }}</span>
                    </div>
                    <div class="flex justify-between text-muted-color">
                        <span>Saldo inicial</span>
                        <span>{{ formatBs(caja.saldo_inicial) }}</span>
                    </div>
                    <div class="flex justify-between py-2 mt-1">
                        <span class="font-semibold">Saldo esperado</span>
                        <span class="font-semibold">{{ formatBs(caja.saldo_esperado) }}</span>
                    </div>
                    <div class="text-muted-color text-xs">Saldo inicial + ingresos − egresos</div>
                </div>
            </div>
            <div class="col-span-12 xl:col-span-5">
                <div class="font-semibold text-lg mb-1">Referencia</div>
                <p class="text-muted-color text-sm mb-4">No está en el cajón. No suma ni resta el arqueo.</p>
                <div class="flex flex-col gap-3">
                    <div class="card mb-0">
                        <div class="text-muted-color text-sm mb-1">Por cobrar</div>
                        <div class="font-semibold text-xl">{{ formatBs(caja.por_cobrar) }}</div>
                        <div class="text-muted-color text-xs mt-1">Ventas aún no cobradas (total o parcial)</div>
                    </div>
                    <div class="card mb-0">
                        <div class="text-muted-color text-sm mb-1">Por pagar</div>
                        <div class="font-semibold text-xl">{{ formatBs(caja.por_pagar) }}</div>
                        <div class="text-muted-color text-xs mt-1">Compras pendientes: no salen de caja hasta el pago</div>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class CuadreCajaComponent {
    @Input() caja: CajaDetalle | null = null;
    formatBs = formatBs;

    get d() {
        return this.caja?.desglose || {
            cobrado_clientes: 0,
            otros_ingresos: 0,
            pagos_proveedor: 0,
            gastos_empresa: 0,
            retiros: 0,
            otros_egresos: 0
        };
    }
}
