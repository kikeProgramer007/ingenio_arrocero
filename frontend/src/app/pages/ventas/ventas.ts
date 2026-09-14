import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { METODOS_PAGO_OPTIONS } from '../caja/caja.constants';
import { formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { Cliente, LineaVenta, Venta } from './ventas.models';
import { ClientesService, VentasService } from './ventas.service';
import { ProductoLista, ProductosService } from '../inventario/productos.service';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';

@Component({
    selector: 'app-ventas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule,
        EstadoVacioComponent,
        KpiGridComponent,
        DialogCajaCerradaComponent
    ],
    providers: [MessageService],
    template: `
        <p-toast />
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Ventas</div>
                <div class="text-muted-color">Elige el producto (arroz pelado) para bajar inventario. El dinero entra con el cobro.</div>
            </div>
            <p-button label="Nueva venta" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="4" />

        <div class="card">
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="block font-bold mb-2">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Estado" fluid />
                </div>
                <div class="col-span-12 md:col-span-4 flex items-end gap-2">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                </div>
            </div>
            <p-table [value]="ventas" [loading]="cargando" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Cobrado</th>
                        <th>Pendiente</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-venta>
                    <tr>
                        <td>{{ venta.id }}</td>
                        <td>{{ formatFecha(venta.fecha) }}</td>
                        <td>{{ venta.cliente?.nombre || '-' }}</td>
                        <td>{{ formatBs(venta.total) }}</td>
                        <td>{{ formatBs(venta.pagado) }}</td>
                        <td>{{ formatBs(venta.saldo_pendiente) }}</td>
                        <td><p-tag [value]="venta.estado" [severity]="severidad(venta.estado)" /></td>
                        <td><p-button icon="pi pi-eye" [rounded]="true" [outlined]="true" (onClick)="ver(venta)" /></td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8">
                            <app-estado-vacio
                                icono="pi pi-shopping-cart"
                                titulo="No hay ventas registradas"
                                mensaje="Registra una venta para ver el total, lo cobrado y lo que queda pendiente."
                            />
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Nueva venta" [(visible)]="dialogNueva" [modal]="true" [style]="{ width: '56rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Cliente</label>
                    <p-select [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="idCliente" placeholder="Seleccione cliente" [filter]="true" fluid />
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="font-bold">Productos / líneas</label>
                        <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                    </div>
                    <p class="text-muted-color text-sm mb-3">Si eliges un producto del inventario, baja el stock. Si es un concepto (flete, etc.), déjalo en blanco y escribe la descripción.</p>
                    <div class="flex flex-col gap-3" *ngFor="let linea of lineas; let i = index">
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-12 md:col-span-5">
                                <label class="block text-sm mb-1">Producto</label>
                                <p-select
                                    [options]="productosOpciones"
                                    optionLabel="etiqueta"
                                    optionValue="id"
                                    [(ngModel)]="linea.id_producto"
                                    (ngModelChange)="onProductoVenta(linea)"
                                    placeholder="Inventario o vacío"
                                    [filter]="true"
                                    [showClear]="true"
                                    fluid
                                />
                            </div>
                            <div class="col-span-12" *ngIf="!linea.id_producto">
                                <label class="block text-sm mb-1">Descripción</label>
                                <input pInputText class="w-full" placeholder="Ej. flete, servicio" [(ngModel)]="linea.descripcion" />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <label class="block text-sm mb-1">Cantidad</label>
                                <p-inputNumber [(ngModel)]="linea.cantidad" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="3" fluid />
                            </div>
                            <div class="col-span-4 md:col-span-3">
                                <label class="block text-sm mb-1">Precio</label>
                                <p-inputNumber [(ngModel)]="linea.precio_unitario" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1" />
                            </div>
                        </div>
                        <small class="text-orange-500" *ngIf="avisoStock(linea)">{{ avisoStock(linea) }}</small>
                    </div>
                    <div class="text-right font-semibold mt-3">Total venta: {{ formatBs(totalLineas()) }}</div>
                    <div class="text-right text-muted-color">Cobrado ahora: {{ formatBs(pagoInicial) }} · Quedará pendiente: {{ formatBs(pendienteEstimado()) }}</div>
                </div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Cobro ahora (ingreso)</label>
                        <p-inputNumber [(ngModel)]="pagoInicial" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                        <small class="text-muted-color">Si es 0, la venta queda pendiente. Requiere caja abierta.</small>
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Método</label>
                        <p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="metodoPago" placeholder="Método" fluid />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="block font-bold mb-2">Referencia</label>
                        <input pInputText class="w-full" [(ngModel)]="referencia" />
                    </div>
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogNueva = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Detalle de venta" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '44rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="mb-3">{{ detalle.cliente?.nombre }} · {{ formatFecha(detalle.fecha) }}</div>
                <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" styleClass="mb-3" />
                <div class="grid grid-cols-12 gap-3 mb-4">
                    <div class="col-span-4"><div class="text-muted-color">Total</div><div class="font-semibold text-xl">{{ formatBs(detalle.total) }}</div></div>
                    <div class="col-span-4"><div class="text-muted-color">Cobrado</div><div class="font-semibold text-xl text-green-600">{{ formatBs(detalle.pagado) }}</div></div>
                    <div class="col-span-4"><div class="text-muted-color">Pendiente</div><div class="font-semibold text-xl text-orange-500">{{ formatBs(detalle.saldo_pendiente) }}</div></div>
                </div>
                <p-table [value]="detalle.detalles || []">
                    <ng-template #header>
                        <tr><th>Descripción</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr>
                    </ng-template>
                    <ng-template #body let-linea>
                        <tr>
                            <td>{{ linea.descripcion }}{{ linea.id_producto ? ' · inventario' : '' }}</td>
                            <td>{{ linea.cantidad }}</td>
                            <td>{{ formatBs(linea.precio_unitario) }}</td>
                            <td>{{ formatBs(linea.subtotal) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="mt-3 font-medium">Estado financiero de esta venta: cobrado {{ formatBs(detalle.pagado) }} de {{ formatBs(detalle.total) }}</div>
            </ng-container>
        </p-dialog>
    `
})
export class VentasPage implements OnInit {
    ventas: Venta[] = [];
    clientes: Cliente[] = [];
    productos: ProductoLista[] = [];
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogDetalle = false;
    dialogCajaCerrada = false;
    filtroEstado = '';
    estados = [
        { label: 'Todas', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' }
    ];
    metodos = METODOS_PAGO_OPTIONS;
    idCliente: number | null = null;
    lineas: LineaVenta[] = [this.lineaVacia()];
    pagoInicial = 0;
    metodoPago = 'EFECTIVO';
    referencia = '';
    observacion = '';
    detalle: Venta | null = null;
    formatBs = formatBs;
    formatFecha = formatFecha;

    get kpis(): KpiItem[] {
        const total = this.ventas.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const cobrado = this.ventas.reduce((acc, v) => acc + Number(v.pagado || 0), 0);
        const pendiente = this.ventas.reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
        return [
            { label: 'Ventas', value: formatBs(total), icon: 'pi pi-shopping-cart', tone: 'neutral' },
            { label: 'Cobrado', value: formatBs(cobrado), icon: 'pi pi-money-bill', tone: 'success' },
            { label: 'Pendiente', value: formatBs(pendiente), icon: 'pi pi-clock', tone: 'warn' },
            { label: 'Documentos', value: String(this.ventas.length), icon: 'pi pi-file', tone: 'info' }
        ];
    }

    constructor(
        private ventasService: VentasService,
        private clientesService: ClientesService,
        private productosService: ProductosService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.cargar();
        this.cargarProductos();
        this.clientesService.listar().subscribe({ next: (data) => (this.clientes = data) });
    }

    get productosOpciones() {
        return this.productos.map((p) => ({
            ...p,
            etiqueta: `${p.nombre} · stock ${p.stock} ${p.unidad_medida}`
        }));
    }

    cargar(): void {
        this.cargando = true;
        this.ventasService.listar({ estado: this.filtroEstado || undefined }).subscribe({
            next: (data) => {
                this.ventas = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo cargar ventas') });
            }
        });
    }

    abrirNueva(): void {
        this.idCliente = null;
        this.lineas = [this.lineaVacia()];
        this.pagoInicial = 0;
        this.metodoPago = 'EFECTIVO';
        this.referencia = '';
        this.observacion = '';
        this.dialogNueva = true;
    }

    agregarLinea(): void {
        this.lineas.push(this.lineaVacia());
    }

    quitarLinea(i: number): void {
        this.lineas.splice(i, 1);
    }

    totalLineas(): number {
        return this.lineas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0);
    }

    pendienteEstimado(): number {
        const pendiente = this.totalLineas() - Number(this.pagoInicial || 0);
        return pendiente > 0 ? pendiente : 0;
    }

    guardar(): void {
        if (!this.idCliente) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione un cliente' });
            return;
        }
        const lineas = this.lineas.filter((l) => Number(l.cantidad) > 0 && (l.id_producto || l.descripcion?.trim()));
        if (!lineas.length) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Agregue al menos un producto o una descripción' });
            return;
        }
        this.guardando = true;
        this.ventasService.crear({
            id_cliente: this.idCliente,
            observacion: this.observacion || undefined,
            lineas: lineas.map((l) => ({
                descripcion: (l.descripcion || '').trim() || this.nombreProducto(l.id_producto),
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario),
                id_producto: l.id_producto || undefined
            })),
            pago_inicial: this.pagoInicial || 0,
            metodo_pago: this.pagoInicial > 0 ? this.metodoPago : undefined,
            referencia: this.referencia || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.messageService.add({ severity: 'success', summary: 'Venta', detail: res.mensaje });
                this.cargar();
                this.cargarProductos();
            },
            error: (err) => {
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo registrar la venta') });
            }
        });
    }

    ver(venta: Venta): void {
        this.ventasService.obtener(venta.id).subscribe({
            next: (data) => {
                this.detalle = data;
                this.dialogDetalle = true;
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo cargar el detalle') })
        });
    }

    severidad(estado: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (estado === 'PAGADA') return 'success';
        if (estado === 'PARCIAL') return 'info';
        if (estado === 'PENDIENTE') return 'warn';
        return 'secondary';
    }

    onProductoVenta(linea: LineaVenta): void {
        const producto = this.productos.find((p) => p.id === linea.id_producto);
        if (producto) {
            linea.descripcion = producto.nombre;
            linea.precio_unitario = Number(producto.precio_venta || 0);
        } else {
            linea.descripcion = '';
        }
    }

    avisoStock(linea: LineaVenta): string {
        if (!linea.id_producto) {
            return '';
        }
        const producto = this.productos.find((p) => p.id === linea.id_producto);
        if (!producto) {
            return '';
        }
        if (Number(linea.cantidad) > Number(producto.stock)) {
            return `Stock insuficiente: hay ${producto.stock} ${producto.unidad_medida}`;
        }
        return '';
    }

    private cargarProductos(): void {
        this.productosService.listar().subscribe({ next: (data) => (this.productos = data) });
    }

    private nombreProducto(id?: number | null): string {
        return this.productos.find((p) => p.id === id)?.nombre || '';
    }

    private lineaVacia(): LineaVenta {
        return { descripcion: '', id_producto: null, cantidad: 1, precio_unitario: 0, subtotal: 0 };
    }

    private msg(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || err?.error?.errores?.[0] || fallback;
    }
}
