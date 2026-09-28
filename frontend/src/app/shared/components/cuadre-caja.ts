import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AyudaCampoComponent } from './ayuda-campo';
import { CajaDetalle } from '../../pages/caja/caja.models';
import { formatBs } from '../../pages/caja/caja.utils';

@Component({
    selector: 'app-cuadre-caja',
    standalone: true,
    imports: [CommonModule, AyudaCampoComponent],
    template: `
        <div class="grid grid-cols-12 gap-4" *ngIf="caja">
            <div class="col-span-12 xl:col-span-7">
                <div class="font-semibold text-lg mb-1">Cuadre de caja</div>
                <p class="text-muted-color text-sm mb-4">
                    Libro de caja: cada cobro queda como ingreso; si se anula la venta, se registra un egreso de devolución por el mismo canal (efectivo o QR). No se borra el asiento.
                    <app-ayuda-campo texto="Efectivo es el cajón. QR es saldo de banco de la sesión. El arqueo solo cuenta el efectivo." posicion="right" />
                </p>
                <div class="flex flex-col gap-2 text-sm">
                    <div class="flex justify-between py-2 border-b border-surface">
                        <span class="font-semibold">Ingresos</span>
                        <span class="font-semibold text-green-600">{{ formatBs(caja.ingresos) }}</span>
                    </div>
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Cobros de clientes</span>
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
                    <div class="flex justify-between pl-4 text-muted-color">
                        <span>Devoluciones por anulación</span>
                        <span>{{ formatBs(d.anulaciones_venta) }}</span>
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
                        <span class="font-semibold">Efectivo en caja</span>
                        <span class="font-semibold">{{ formatBs(caja.efectivo_esperado ?? caja.saldo_esperado) }}</span>
                    </div>
                    <div class="text-muted-color text-xs">Saldo inicial + ingresos en efectivo − egresos en efectivo</div>
                    <div class="flex justify-between py-2 mt-1">
                        <span class="font-semibold">QR / banco</span>
                        <span class="font-semibold">{{ formatBs(caja.qr_esperado) }}</span>
                    </div>
                    <div class="text-muted-color text-xs">Ingresos QR − egresos QR. No está en el cajón.</div>
                    <div class="flex justify-between py-2 mt-1">
                        <span class="font-semibold">Total (efectivo + QR)</span>
                        <span class="font-semibold">{{ formatBs(caja.saldo_esperado) }}</span>
                    </div>
                    <div class="text-muted-color text-xs">Saldo inicial + ingresos − egresos</div>
                    <div class="flex justify-between py-2 mt-3 border-t border-surface">
                        <span class="font-medium">Cobrado neto a clientes</span>
                        <span class="font-semibold text-green-700">{{ formatBs(d.cobrado_neto) }}</span>
                    </div>
                    <div class="text-muted-color text-xs">Cobros de clientes − devoluciones por anulación</div>
                </div>
            </div>
            <div class="col-span-12 xl:col-span-5">
                <div class="font-semibold text-lg mb-1">Referencia</div>
                <p class="text-muted-color text-sm mb-4">No está en el cajón. No suma ni resta el arqueo.</p>
                <div class="flex flex-col gap-3">
                    <div class="card mb-0">
                        <div class="text-muted-color text-sm mb-1">Por cobrar</div>
                        <div class="font-semibold text-xl">{{ formatBs(caja.por_cobrar) }}</div>
                        <div class="text-muted-color text-xs mt-1">Ventas vigentes aún no cobradas (total o parcial). Las anuladas no cuentan.</div>
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
        const raw = this.caja?.desglose;
        const cobros = Number(raw?.cobrado_clientes || 0);
        const anulaciones = Number(raw?.anulaciones_venta || 0);
        const neto = raw?.cobrado_neto != null ? Number(raw.cobrado_neto) : cobros - anulaciones;
        return {
            cobrado_clientes: cobros,
            cobrado_neto: neto,
            otros_ingresos: Number(raw?.otros_ingresos || 0),
            pagos_proveedor: Number(raw?.pagos_proveedor || 0),
            gastos_empresa: Number(raw?.gastos_empresa || 0),
            retiros: Number(raw?.retiros || 0),
            anulaciones_venta: anulaciones,
            otros_egresos: Number(raw?.otros_egresos || 0)
        };
    }
}
