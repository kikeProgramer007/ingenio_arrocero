import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
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
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';

@Component({
    selector: 'app-compras',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        DatePickerModule,
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
        TooltipModule,
        MenuModule,
        TablaBusquedaComponent
    ],
    template: `
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Compras</div>
                <div class="text-muted-color">Compra de chala al productor. El pago se registra en Pagos a proveedores, no aquí.</div>
            </div>
            <div class="flex flex-wrap gap-2">
                <p-button label="Compra de chala" icon="pi pi-plus" (onClick)="abrirChala()" />
                <p-button label="Servicio u otra compra" icon="pi pi-plus" [outlined]="true" (onClick)="abrirNueva()" />
            </div>
        </div>

        <div class="card">
            <div class="flex flex-wrap items-end gap-2 mb-4">
                <div class="w-full sm:w-[12rem] min-w-0">
                    <label class="block font-bold mb-1 text-sm">Estado</label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Estado" fluid />
                </div>
                <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="ml-auto flex items-end gap-2 shrink-0">
                    <app-botones-exportar tipo="compras" [estado]="filtroEstado" />
                </div>
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : compras"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} compras"
                [globalFilterFields]="['id', 'fecha', 'proveedor.nombre', 'estado']"
                [rowHover]="true"
                responsiveLayout="scroll"
            >
                <ng-template #caption>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <span class="font-semibold">Listado de compras</span>
                        <app-tabla-busqueda (buscar)="filtrarTabla(dt, $event)" />
                    </div>
                </ng-template>
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Clase</th>
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
                        <td><p-tag [value]="claseCompra(compra)" [severity]="compra.es_servicio ? 'secondary' : 'warn'" /></td>
                        <td>{{ formatBs(compra.total) }}</td>
                        <td>{{ formatBs(compra.pagado) }}</td>
                        <td>{{ formatBs(compra.saldo_pendiente) }}</td>
                        <td><p-tag [value]="compra.estado" [severity]="severidad(compra.estado)" /></td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones de la compra"
                                (onClick)="abrirAcciones($event, menuAcciones, compra)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                            <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="9" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="9">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-box text-4xl mb-3 block"></i>
                                No hay compras registradas.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog header="Compra de chala" [(visible)]="dialogChala" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <p class="text-muted-color text-sm m-0">Producto fijo: Arroz en chala. Total = fanegas × precio. El pago se hace después en Pagos a proveedores.</p>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Productor <app-ayuda-campo texto="Proveedor de la chala." posicion="right" /></label>
                    <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Seleccione productor" [filter]="true" fluid />
                </div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Fecha <app-ayuda-campo texto="Fecha de la boleta." posicion="top" /></label>
                        <p-datepicker [(ngModel)]="fechaChala" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" fluid />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Boleta <app-ayuda-campo texto="Nro. de boleta de balanza." posicion="left" /></label>
                        <input pInputText class="w-full" [(ngModel)]="boleta" maxlength="40" />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Concepto / variedad <app-ayuda-campo texto="ORO, EPAGRI u otra variedad de esa entrega." posicion="top" /></label>
                        <p-select [options]="variedades" optionLabel="label" optionValue="value" [(ngModel)]="concepto" placeholder="Variedad" fluid />
                    </div>
                    <div class="col-span-12 sm:col-span-6" *ngIf="concepto === 'OTRO'">
                        <label class="flex items-center gap-1 font-bold mb-2">Otra variedad</label>
                        <input pInputText class="w-full" [(ngModel)]="conceptoOtro" maxlength="40" />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Chofer <app-ayuda-campo texto="Quién trajo el camión en esta entrega." posicion="top" /></label>
                        <input pInputText class="w-full" [(ngModel)]="chofer" maxlength="120" />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Placa <app-ayuda-campo texto="Placa del camión de esta entrega." posicion="left" /></label>
                        <input pInputText class="w-full" [(ngModel)]="placa" maxlength="30" />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Fanegas <app-ayuda-campo texto="Cantidad de la boleta. Es la única cantidad de esta compra." posicion="top" /></label>
                        <app-input-numero tipo="cantidad" [(ngModel)]="fanegas" [min]="0" />
                    </div>
                    <div class="col-span-12 sm:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Precio <app-ayuda-campo texto="Precio por fanega." posicion="left" /></label>
                        <app-input-numero [(ngModel)]="precioFanega" />
                    </div>
                </div>
                <div class="text-right font-semibold text-lg">Total: {{ formatBs(totalChala()) }}</div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogChala = false" />
                <p-button label="Registrar" [loading]="guardando" (onClick)="guardarChala()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Servicio u otra compra" [(visible)]="dialogNueva" [modal]="true" [style]="{ width: '52rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <p class="text-muted-color text-sm m-0">Empaque, insumos o un servicio fiado (flete, taller). Chala va en Compra de chala. Lo que pagas ahora de caja (luz, combustible) va a Gastos.</p>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Proveedor <app-ayuda-campo texto="A quién le compras o le fiaron el servicio." posicion="right" /></label>
                    <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Seleccione proveedor" [filter]="true" fluid />
                </div>
                <div>
                    <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
                        <label class="flex items-center gap-1 font-bold">Líneas <app-ayuda-campo texto="Producto del inventario entra al stock. Sin producto: flete u otro servicio." posicion="right" /></label>
                        <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                    </div>
                    <div class="flex flex-col gap-3" *ngFor="let linea of lineas; let i = index">
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-12 md:col-span-5">
                                <label class="flex items-center gap-1 text-sm mb-1">Producto <app-ayuda-campo texto="Vacío = servicio sin inventario." posicion="bottom" /></label>
                                <p-select
                                    [options]="productosOpcionesSinChala"
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
                            <div class="col-span-12 sm:col-span-6 md:col-span-2">
                                <label class="flex items-center gap-1 text-sm mb-1">Cantidad <app-ayuda-campo texto="Unidades que entran al inventario." posicion="top" /></label>
                                <app-input-numero tipo="cantidad" [(ngModel)]="linea.cantidad" [min]="0" />
                            </div>
                            <div class="col-span-12 sm:col-span-6 md:col-span-3">
                                <label class="flex items-center gap-1 text-sm mb-1">Precio <app-ayuda-campo texto="Costo unitario en bolivianos." posicion="left" /></label>
                                <app-input-numero [(ngModel)]="linea.precio_unitario" />
                            </div>
                            <div class="col-span-12 md:col-span-2">
                                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" pTooltip="Quitar línea" tooltipPosition="top" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1" />
                            </div>
                        </div>
                    </div>
                    <div class="text-right font-semibold mt-3">Total: {{ formatBs(totalLineas()) }}</div>
                </div>
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Pago inicial <app-ayuda-campo texto="0 si queda por pagar. Un pago contra chala se registra en Pagos a proveedores." posicion="top" /></label>
                        <app-input-numero [(ngModel)]="pagoInicial" />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Solo si hay pago inicial. QR sale del banco. Efectivo del cajón." posicion="top" /></label>
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
                <p-tag [value]="claseCompra(detalle)" [severity]="detalle.es_servicio ? 'secondary' : 'warn'" styleClass="mb-3" />
                <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" styleClass="mb-3 ml-2" />
                <div class="text-sm text-muted-color mb-3" *ngIf="detalle.concepto || detalle.boleta || detalle.chofer || detalle.placa || detalle.fanegas">
                    <span *ngIf="detalle.concepto">{{ detalle.concepto }} · </span>
                    Boleta {{ detalle.boleta || '-' }} · Chofer {{ detalle.chofer || '-' }} · Placa {{ detalle.placa || '-' }}
                    <span *ngIf="detalle.fanegas"> · {{ detalle.fanegas }} fanegas</span>
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
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    compras: Compra[] = [];
    proveedores: Proveedor[] = [];
    productos: ProductoLista[] = [];
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogChala = false;
    dialogCajaCerrada = false;
    dialogDetalle = false;
    filtroEstado = '';
    estados = [
        { label: 'Todas', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' }
    ];
    variedades = [
        { label: 'ORO', value: 'ORO' },
        { label: 'EPAGRI', value: 'EPAGRI' },
        { label: 'Otro', value: 'OTRO' }
    ];
    idProveedor: number | null = null;
    lineas: LineaCompra[] = [this.lineaVacia()];
    pagoInicial = 0;
    metodoPago = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    referencia = '';
    observacion = '';
    boleta = '';
    chofer = '';
    placa = '';
    fanegas = 0;
    precioFanega = 0;
    concepto = 'ORO';
    conceptoOtro = '';
    fechaChala: Date = new Date();
    detalle: Compra | null = null;
    itemsAcciones: MenuItem[] = [];
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

    get productosOpcionesSinChala() {
        return this.productos
            .filter((p) => !this.esProductoChala(p))
            .map((p) => ({
                ...p,
                etiqueta: `${p.nombre} · stock ${p.stock} ${p.unidad_medida}`
            }));
    }

    get productoChala(): ProductoLista | undefined {
        return this.productos.find((p) => this.esProductoChala(p));
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

    abrirChala(): void {
        this.idProveedor = null;
        this.fechaChala = new Date();
        this.boleta = '';
        this.chofer = '';
        this.placa = '';
        this.fanegas = 0;
        this.precioFanega = 0;
        this.concepto = 'ORO';
        this.conceptoOtro = '';
        this.dialogChala = true;
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

    totalChala(): number {
        return Number(this.fanegas || 0) * Number(this.precioFanega || 0);
    }

    guardarChala(): void {
        if (!this.idProveedor) {
            this.aviso.aviso('Validación', 'Seleccione un productor');
            return;
        }
        const producto = this.productoChala;
        if (!producto) {
            this.aviso.aviso('Validación', 'No hay producto Arroz en chala en inventario. Créelo en Productos.');
            return;
        }
        if (!this.boleta.trim()) {
            this.aviso.aviso('Validación', 'Indique el nro. de boleta');
            return;
        }
        const concepto = this.conceptoValor();
        if (!concepto) {
            this.aviso.aviso('Validación', 'Indique la variedad (ORO, EPAGRI u otra)');
            return;
        }
        if (Number(this.fanegas) <= 0) {
            this.aviso.aviso('Validación', 'Indique las fanegas');
            return;
        }
        if (Number(this.precioFanega) <= 0) {
            this.aviso.aviso('Validación', 'Indique el precio por fanega');
            return;
        }
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de compra...');
        this.comprasService.crear({
            id_proveedor: this.idProveedor,
            fecha: this.fechaYmd(this.fechaChala),
            concepto,
            boleta: this.boleta.trim(),
            chofer: this.chofer.trim() || undefined,
            placa: this.placa.trim() || undefined,
            fanegas: Number(this.fanegas),
            lineas: [{
                descripcion: concepto,
                cantidad: Number(this.fanegas),
                precio_unitario: Number(this.precioFanega),
                id_producto: producto.id
            }],
            pago_inicial: 0
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogChala = false;
                this.aviso.ok('Compra', 'Compra de chala registrada. El pago se hace en Pagos a proveedores.');
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
                this.aviso.error(err, 'No se pudo registrar la compra de chala');
            }
        });
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

    abrirAcciones(event: Event, menu: Menu, compra: Compra): void {
        this.itemsAcciones = [
            {
                label: 'Ver detalle',
                icon: 'pi pi-eye menu-icon-ver',
                iconStyle: { color: '#3b82f6' },
                command: () => this.ver(compra)
            },
            {
                label: 'Ver PDF',
                icon: 'pi pi-file-pdf menu-icon-pdf',
                iconStyle: { color: '#ef4444' },
                command: () => this.exportarCompra(compra, 'pdf')
            }
        ];
        menu.toggle(event);
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

    claseCompra(compra: Compra): string {
        if (compra.es_servicio) return 'Servicio';
        if (compra.fanegas || compra.boleta) return 'Chala';
        return 'Compra';
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

    private esProductoChala(p: ProductoLista): boolean {
        const nombre = (p.nombre || '').toLowerCase();
        const categoria = (p.categoria?.nombre || '').toLowerCase();
        if (nombre.includes('pilado')) {
            return false;
        }
        return nombre.includes('chala') || categoria.includes('chala');
    }

    private conceptoValor(): string {
        if (this.concepto === 'OTRO') {
            return this.conceptoOtro.trim();
        }
        return (this.concepto || '').trim();
    }

    private fechaYmd(fecha: Date | null): string | undefined {
        if (!fecha) {
            return undefined;
        }
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    private nombreProducto(id?: number | null): string {
        return this.productos.find((p) => p.id === id)?.nombre || '';
    }

    private lineaVacia(): LineaCompra {
        return { descripcion: '', id_producto: null, cantidad: 1, precio_unitario: 0, subtotal: 0 };
    }
}
