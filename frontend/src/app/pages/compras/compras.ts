import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { Compra, LineaCompra, Proveedor } from './compras.models';
import { ComprasService, ProveedoresService } from './compras.service';
import { ProductoLista, ProductosService } from '../inventario/productos.service';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { ExportarService, FormatoExport } from '../../shared/services/exportar.service';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-compras',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        DialogCajaCerradaComponent,
        BotonesExportarComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        MetodoPagoComponent,
        InputNumeroComponent,
        TooltipModule
    ],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Compras</div>
                <div class="text-muted-color">Elige el producto (chala) para entrar al inventario. El dinero sale cuando pagas al proveedor.</div>
            </div>
            <p-button label="Nueva compra" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <div class="card">
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="block font-bold mb-2">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Estado" fluid />
                </div>
                <div class="col-span-12 md:col-span-8 flex items-end gap-2 flex-wrap">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                    <app-botones-exportar tipo="compras" [estado]="filtroEstado" />
                </div>
            </div>
            <p-table [value]="cargando ? [] : compras" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Total</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-compra>
                    <tr>
                        <td>{{ compra.id }}</td>
                        <td>{{ formatFecha(compra.fecha) }}</td>
                        <td>{{ compra.proveedor?.nombre || '-' }}</td>
                        <td>{{ formatBs(compra.total) }}</td>
                        <td>{{ formatBs(compra.pagado) }}</td>
                        <td>{{ formatBs(compra.saldo_pendiente) }}</td>
                        <td><p-tag [value]="compra.estado" [severity]="severidad(compra.estado)" /></td>
                        <td>
                            <p-button icon="pi pi-eye" [rounded]="true" [outlined]="true" severity="info" pTooltip="Ver detalle" tooltipPosition="left" (onClick)="ver(compra)" />
                            <p-button icon="pi pi-file-pdf" [rounded]="true" [outlined]="true" severity="danger" class="ml-1" pTooltip="Ver PDF" tooltipPosition="left" (onClick)="exportarCompra(compra, 'pdf')" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="8" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-box text-4xl mb-3 block"></i>
                                No hay compras registradas.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Nueva compra" [(visible)]="dialogNueva" [modal]="true" [style]="{ width: '56rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Proveedor <app-ayuda-campo texto="De quién compras la chala u otro insumo." posicion="right" /></label>
                    <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Seleccione proveedor" [filter]="true" fluid />
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="flex items-center gap-1 font-bold">Productos / líneas <app-ayuda-campo texto="Producto del inventario entra al stock. Sin producto: escribe un concepto (flete)." posicion="right" /></label>
                        <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                    </div>
                    <p class="text-muted-color text-sm mb-3">Si eliges un producto (chala), entra al inventario. Si es un concepto, déjalo vacío y escribe la descripción.</p>
                    <div class="flex flex-col gap-3" *ngFor="let linea of lineas; let i = index">
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-12 md:col-span-5">
                                <label class="flex items-center gap-1 text-sm mb-1">Producto <app-ayuda-campo texto="Ej.: Arroz en chala. Vacío = línea sin inventario." posicion="bottom" /></label>
                                <p-select
                                    [options]="productosOpciones"
                                    optionLabel="etiqueta"
                                    optionValue="id"
                                    [(ngModel)]="linea.id_producto"
                                    (ngModelChange)="onProductoCompra(linea)"
                                    placeholder="Inventario o vacío"
                                    [filter]="true"
                                    [showClear]="true"
                                    fluid
                                />
                            </div>
                            <div class="col-span-12" *ngIf="!linea.id_producto">
                                <label class="flex items-center gap-1 text-sm mb-1">Descripción <app-ayuda-campo texto="Ej.: Flete, comisión, servicio." posicion="top" /></label>
                                <input pInputText class="w-full" placeholder="Ej. flete, servicio" [(ngModel)]="linea.descripcion" />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <label class="flex items-center gap-1 text-sm mb-1">Cantidad <app-ayuda-campo texto="Kilos o unidades que entran al inventario." posicion="top" /></label>
                                <app-input-numero tipo="cantidad" [(ngModel)]="linea.cantidad" [min]="0" />
                            </div>
                            <div class="col-span-4 md:col-span-3">
                                <label class="flex items-center gap-1 text-sm mb-1">Precio <app-ayuda-campo texto="Costo unitario en bolivianos." posicion="left" /></label>
                                <app-input-numero [(ngModel)]="linea.precio_unitario" />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" pTooltip="Quitar línea" tooltipPosition="top" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1" />
                            </div>
                        </div>
                    </div>
                    <div class="text-right font-semibold mt-3">Total: {{ formatBs(totalLineas()) }}</div>
                </div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Pago inicial <app-ayuda-campo texto="Lo que pagas ahora sale de caja. 0 = toda la compra queda por pagar." posicion="top" /></label>
                        <app-input-numero [(ngModel)]="pagoInicial" />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR sale del banco. Efectivo del cajón. Mixto parte el pago." posicion="top" /></label>
                        <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="pagoInicial" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia o comprobante." posicion="left" /></label>
                        <input pInputText class="w-full" [(ngModel)]="referencia" />
                    </div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna de la compra." posicion="top" /></label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogNueva = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Detalle de compra" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '44rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="mb-3">{{ detalle.proveedor?.nombre }} · {{ formatFecha(detalle.fecha) }}</div>
                <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" styleClass="mb-3" />
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
                <div class="mt-3 font-medium">Total {{ formatBs(detalle.total) }} · Saldo {{ formatBs(detalle.saldo_pendiente) }}</div>
            </ng-container>
            <ng-template #footer>
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogDetalle = false" />
                <p-button *ngIf="detalle" label="PDF" icon="pi pi-file-pdf" severity="danger" [outlined]="true" pTooltip="Ver PDF" tooltipPosition="top" (onClick)="exportarCompra(detalle, 'pdf')" />
            </ng-template>
        </p-dialog>
    `
})
export class ComprasPage implements OnInit {
    compras: Compra[] = [];
    proveedores: Proveedor[] = [];
    productos: ProductoLista[] = [];
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogCajaCerrada = false;
    dialogDetalle = false;
    filtroEstado = '';
    estados = [
        { label: 'Todas', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' }
    ];
    idProveedor: number | null = null;
    lineas: LineaCompra[] = [this.lineaVacia()];
    pagoInicial = 0;
    metodoPago = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    referencia = '';
    observacion = '';
    detalle: Compra | null = null;
    formatBs = formatBs;
    formatFecha = formatFecha;

    constructor(
        private comprasService: ComprasService,
        private proveedoresService: ProveedoresService,
        private productosService: ProductosService,
        private exportarService: ExportarService,
        private aviso: AvisoService
    ) {}

    exportarCompra(compra: Compra, formato: FormatoExport = 'pdf', visor?: Window | null): void {
        if (formato === 'xlsx') {
            this.exportarService.descargar({ tipo: 'compra', formato, id: compra.id }).subscribe({
                error: (err) => this.aviso.error(err, 'No se pudo generar el Excel de la compra')
            });
            return;
        }
        const ventana = visor ?? this.exportarService.abrirVentanaEspera('Generando nota de compra...');
        this.exportarService.mostrarPdf({ tipo: 'compra', formato: 'pdf', id: compra.id }, ventana).subscribe({
            error: (err) => this.aviso.error(err, 'No se pudo generar el PDF de la compra')
        });
    }

    ngOnInit(): void {
        this.cargar();
        this.cargarProductos();
        this.proveedoresService.listar().subscribe({ next: (data) => (this.proveedores = data) });
    }

    get productosOpciones() {
        return this.productos.map((p) => ({
            ...p,
            etiqueta: `${p.nombre} · stock ${p.stock} ${p.unidad_medida}`
        }));
    }

    cargar(): void {
        this.cargando = true;
        this.comprasService.listar({ estado: this.filtroEstado || undefined }).subscribe({
            next: (data) => {
                this.compras = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar compras');
            }
        });
    }

    abrirNueva(): void {
        this.idProveedor = null;
        this.lineas = [this.lineaVacia()];
        this.pagoInicial = 0;
        this.metodoPago = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
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

    guardar(): void {
        if (!this.idProveedor) {
            this.aviso.aviso('Validación', 'Seleccione un proveedor');
            return;
        }
        const lineas = this.lineas.filter((l) => Number(l.cantidad) > 0 && (l.id_producto || l.descripcion?.trim()));
        if (!lineas.length) {
            this.aviso.aviso('Validación', 'Agregue al menos un producto o una descripción');
            return;
        }
        const mixto = mensajePagoMixto(this.metodoPago, this.pagoInicial || 0, this.montoEfectivo, this.montoQr);
        if (this.pagoInicial > 0 && mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de compra...');
        this.comprasService.crear({
            id_proveedor: this.idProveedor,
            observacion: this.observacion || undefined,
            lineas: lineas.map((l) => ({
                descripcion: (l.descripcion || '').trim() || this.nombreProducto(l.id_producto),
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario),
                id_producto: l.id_producto || undefined
            })),
            pago_inicial: this.pagoInicial || 0,
            metodo_pago: this.pagoInicial > 0 ? this.metodoPago : undefined,
            referencia: this.referencia || undefined,
            ...(this.pagoInicial > 0 ? extrasPagoMixto(this.metodoPago, this.montoEfectivo, this.montoQr) : {})
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.aviso.ok('Compra', 'Compra registrada. Se abre la nota de compra.');
                this.cargar();
                this.cargarProductos();
                if (res.data?.id) {
                    this.exportarCompra(res.data, 'pdf', visor);
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
                this.aviso.error(err, 'No se pudo registrar la compra');
            }
        });
    }

    ver(compra: Compra): void {
        this.comprasService.obtener(compra.id).subscribe({
            next: (data) => {
                this.detalle = data;
                this.dialogDetalle = true;
            },
            error: (err) => this.aviso.error(err, 'No se pudo cargar el detalle')
        });
    }

    severidad(estado: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (estado === 'PAGADA') return 'success';
        if (estado === 'PARCIAL') return 'warn';
        if (estado === 'PENDIENTE') return 'info';
        return 'secondary';
    }

    onProductoCompra(linea: LineaCompra): void {
        const producto = this.productos.find((p) => p.id === linea.id_producto);
        if (producto) {
            linea.descripcion = producto.nombre;
            linea.precio_unitario = Number(producto.precio_compra || 0);
        } else {
            linea.descripcion = '';
        }
    }

    private cargarProductos(): void {
        this.productosService.listar().subscribe({ next: (data) => (this.productos = data) });
    }

    private nombreProducto(id?: number | null): string {
        return this.productos.find((p) => p.id === id)?.nombre || '';
    }

    private lineaVacia(): LineaCompra {
        return { descripcion: '', id_producto: null, cantidad: 1, precio_unitario: 0, subtotal: 0 };
    }
}
