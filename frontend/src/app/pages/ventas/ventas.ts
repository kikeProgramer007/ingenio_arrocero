import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { formatBs, formatFecha, esErrorCajaCerrada } from '../caja/caja.utils';
import { Cliente, LineaVenta, Venta } from './ventas.models';
import { ClientesService, VentasService } from './ventas.service';
import { ExportarService, FormatoExport } from '../../shared/services/exportar.service';
import { ProductoLista, ProductosService } from '../inventario/productos.service';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-ventas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DatePickerModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        SelectButtonModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule,
        EstadoVacioComponent,
        KpiGridComponent,
        DialogCajaCerradaComponent,
        BotonesExportarComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        MetodoPagoComponent,
        TooltipModule
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
                <div class="col-span-12 md:col-span-3">
                    <label class="flex items-center gap-1 font-bold mb-2">Estado <app-ayuda-campo texto="Pendiente o parcial: aún hay saldo. Pagada: cobrada. Anulada: no suma y se devolvió el stock." posicion="bottom" /></label>
                    <p-select [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Estado" fluid />
                </div>
                <div class="col-span-12 md:col-span-3">
                    <label class="flex items-center gap-1 font-bold mb-2">Cliente <app-ayuda-campo texto="Filtra las ventas de un comprador. Déjalo en Todos para ver todos." posicion="bottom" /></label>
                    <p-select [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroCliente" placeholder="Todos" [filter]="true" [showClear]="true" fluid />
                </div>
                <div class="col-span-12 md:col-span-4">
                    <label class="flex items-center gap-1 font-bold mb-2">Período <app-ayuda-campo texto="Rango de fechas de la venta. La venta siempre se registra con la fecha de hoy." posicion="left" /></label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <div class="col-span-12 md:col-span-2 flex items-end gap-2 flex-wrap">
                    <p-button label="Filtrar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                </div>
                <div class="col-span-12 flex justify-end">
                    <app-botones-exportar tipo="ventas" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" [idCliente]="filtroCliente" [estado]="filtroEstado" />
                </div>
            </div>
            <p-table [value]="cargando ? [] : ventas" [loading]="cargando" [showLoader]="false" [paginator]="true" [rows]="10" responsiveLayout="scroll">
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
                        <td>
                            <p-button icon="pi pi-eye" [rounded]="true" [outlined]="true" pTooltip="Ver detalle" tooltipPosition="left" (onClick)="ver(venta)" />
                            <p-button icon="pi pi-file-pdf" [rounded]="true" [outlined]="true" class="ml-1" pTooltip="Nota de venta (PDF)" tooltipPosition="left" (onClick)="exportarVenta(venta, 'pdf')" [disabled]="venta.estado === 'ANULADA'" />
                            <p-button *ngIf="venta.estado !== 'ANULADA'" icon="pi pi-times" [rounded]="true" [outlined]="true" severity="danger" class="ml-1" pTooltip="Anular: devuelve stock y descuenta lo cobrado de caja" tooltipPosition="left" (onClick)="pedirAnular(venta)" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="8" [fila]="f"></tr>
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
                    <div class="flex justify-between items-center mb-2">
                        <label class="flex items-center gap-1 font-bold">Cliente <app-ayuda-campo texto="Quien compra. Si no está en la lista, pulsa Nuevo." posicion="right" /></label>
                        <p-button label="Nuevo" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="abrirClienteRapido()" />
                    </div>
                    <p-select [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="idCliente" placeholder="Seleccione cliente" [filter]="true" fluid />
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="flex items-center gap-1 font-bold">Productos / líneas <app-ayuda-campo texto="Producto del inventario baja stock. Sin producto: escribe un concepto (flete, servicio) en Descripción." posicion="right" /></label>
                        <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                    </div>
                    <p class="text-muted-color text-sm mb-3">Si eliges un producto del inventario, baja el stock. Si es un concepto (flete, etc.), déjalo en blanco y escribe la descripción.</p>
                    <div class="flex flex-col gap-3" *ngFor="let linea of lineas; let i = index">
                        <div class="grid grid-cols-12 gap-2 items-end">
                            <div class="col-span-12 md:col-span-5">
                                <label class="flex items-center gap-1 text-sm mb-1">Producto <app-ayuda-campo texto="Ej.: Arroz pilado. Vacío = línea sin inventario." posicion="bottom" /></label>
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
                                <label class="flex items-center gap-1 text-sm mb-1">Descripción <app-ayuda-campo texto="Ej.: Flete Santa Cruz, servicio de entrega." posicion="top" /></label>
                                <input pInputText class="w-full" placeholder="Ej. flete, servicio" [(ngModel)]="linea.descripcion" />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <label class="flex items-center gap-1 text-sm mb-1">Cantidad <app-ayuda-campo texto="Kilos o unidades que salen. Debe haber stock suficiente." posicion="top" /></label>
                                <p-inputNumber [(ngModel)]="linea.cantidad" [min]="0" [minFractionDigits]="0" [maxFractionDigits]="3" fluid />
                            </div>
                            <div class="col-span-4 md:col-span-3">
                                <label class="flex items-center gap-1 text-sm mb-1">Precio <app-ayuda-campo texto="Precio unitario en bolivianos. El subtotal es cantidad × precio." posicion="left" /></label>
                                <p-inputNumber [(ngModel)]="linea.precio_unitario" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                            </div>
                            <div class="col-span-4 md:col-span-2">
                                <p-button icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1" />
                            </div>
                        </div>
                        <small class="text-orange-500" *ngIf="avisoStock(linea)">{{ avisoStock(linea) }}</small>
                    </div>
                    <div class="text-right font-semibold mt-3">Total venta: {{ formatBs(totalLineas()) }}</div>
                    <div class="text-right text-muted-color">Se cobra ahora: {{ formatBs(pagoAlRegistrar()) }} · Quedará pendiente: {{ formatBs(pendienteEstimado()) }}</div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de cobro <app-ayuda-campo texto="Contado: el total entra a caja ahora. Crédito: queda por cobrar; puedes abonar una parte." posicion="right" /></label>
                    <p-selectbutton [options]="modosCobro" optionLabel="label" optionValue="value" [(ngModel)]="modoCobro" [allowEmpty]="false" />
                    <small class="block text-muted-color mt-2">La fecha de la venta es la de hoy. No se puede registrar con fecha anterior.</small>
                </div>
                <div class="grid grid-cols-12 gap-3" *ngIf="modoCobro === 'CREDITO'">
                    <div class="col-span-12 md:col-span-4">
                        <label class="flex items-center gap-1 font-bold mb-2">Abono ahora (opcional) <app-ayuda-campo texto="Ej.: total Bs 1.640, abono Bs 500. El resto queda pendiente. 0 = todo a crédito." posicion="top" /></label>
                        <p-inputNumber [(ngModel)]="pagoInicial" mode="decimal" [min]="0" [minFractionDigits]="2" prefix="Bs " fluid />
                    </div>
                    <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                        <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Tocá Efectivo, QR o transferencia. Más rápido que el desplegable." posicion="top" /></label>
                        <app-metodo-pago [(ngModel)]="metodoPago" />
                    </div>
                    <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                        <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia, nro. de QR o comprobante." posicion="left" /></label>
                        <input pInputText class="w-full" [(ngModel)]="referencia" />
                    </div>
                </div>
                <div class="grid grid-cols-12 gap-3" *ngIf="modoCobro === 'CONTADO'">
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Tocá Efectivo, QR o transferencia. Más rápido que el desplegable." posicion="top" /></label>
                        <app-metodo-pago [(ngModel)]="metodoPago" />
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia, nro. de QR o comprobante." posicion="left" /></label>
                        <input pInputText class="w-full" [(ngModel)]="referencia" />
                    </div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna. No aparece como ingreso; solo queda en la venta." posicion="top" /></label>
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
                <div class="font-semibold mt-4 mb-2">Cobranzas</div>
                <p-table [value]="detalle.cobranzas || []" *ngIf="detalle.cobranzas?.length">
                    <ng-template #header>
                        <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Usuario</th></tr>
                    </ng-template>
                    <ng-template #body let-cob>
                        <tr>
                            <td>{{ formatFecha(cob.fecha) }}</td>
                            <td>{{ formatBs(cob.monto) }}</td>
                            <td>{{ cob.metodo_pago }}</td>
                            <td>{{ cob.usuario?.username || '-' }}</td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="text-muted-color" *ngIf="!detalle.cobranzas?.length">Aún no hay cobros registrados en esta venta.</div>
            </ng-container>
            <ng-template #footer>
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogDetalle = false" />
                <p-button *ngIf="detalle && (detalle.estado === 'PENDIENTE' || detalle.estado === 'PARCIAL')" label="Cobrar" icon="pi pi-wallet" (onClick)="abrirCobroDetalle()" />
                <p-button *ngIf="detalle && detalle.estado !== 'ANULADA'" label="Anular" icon="pi pi-times" severity="danger" [outlined]="true" (onClick)="pedirAnular(detalle)" />
                <p-button *ngIf="detalle && detalle.estado !== 'ANULADA'" label="PDF" icon="pi pi-file-pdf" (onClick)="exportarVenta(detalle, 'pdf')" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Nuevo cliente" [(visible)]="dialogCliente" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Nombre comercial o de la persona. Ej.: Distribuidora Rojas." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="clienteRapido.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">NIT / CI <app-ayuda-campo texto="Documento para la nota de venta. Puede dejarse vacío." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="clienteRapido.nit_ci" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Teléfono <app-ayuda-campo texto="Para contactarlo al cobrar. Opcional." posicion="top" /></label>
                    <input pInputText class="w-full" [(ngModel)]="clienteRapido.telefono" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogCliente = false" />
                <p-button label="Guardar" [loading]="guardandoCliente" (onClick)="guardarClienteRapido()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Registrar cobranza" [(visible)]="dialogCobro" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3" *ngIf="detalle">
                <div class="text-muted-color">Venta #{{ detalle.id }} · saldo {{ formatBs(detalle.saldo_pendiente) }}</div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Monto <app-ayuda-campo texto="No puede superar el saldo. Puedes cobrar menos y dejar el resto pendiente." posicion="right" /></label>
                    <p-inputNumber [(ngModel)]="cobroMonto" mode="decimal" [min]="0.01" [minFractionDigits]="2" prefix="Bs " fluid />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Cómo entra a caja este cobro: efectivo, QR o transferencia." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="cobroMetodo" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia o comprobante QR. Opcional en efectivo." posicion="top" /></label>
                    <input pInputText class="w-full" [(ngModel)]="cobroReferencia" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogCobro = false" />
                <p-button label="Cobrar" [loading]="guardando" (onClick)="guardarCobroDetalle()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Anular venta" [(visible)]="dialogAnular" [modal]="true" [style]="{ width: '28rem' }">
            <p *ngIf="ventaAnular">
                ¿Anular la venta #{{ ventaAnular.id }} de {{ ventaAnular.cliente?.nombre }}?
                Se devuelve el stock.
                <span *ngIf="ventaAnular.pagado > 0"> Lo cobrado ({{ formatBs(ventaAnular.pagado) }}) se descuenta de la caja abierta.</span>
                <span *ngIf="ventaAnular.pagado <= 0"> Esta venta no había generado ingreso a caja.</span>
            </p>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogAnular = false" />
                <p-button label="Anular" severity="danger" [loading]="guardando" (onClick)="confirmarAnular()" />
            </ng-template>
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
    dialogCliente = false;
    dialogCobro = false;
    dialogAnular = false;
    guardandoCliente = false;
    ventaAnular: Venta | null = null;
    cobroMonto = 0;
    cobroMetodo = 'EFECTIVO';
    cobroReferencia = '';
    clienteRapido = { nombre: '', nit_ci: '', telefono: '' };
    filtroEstado = '';
    filtroCliente: number | null = null;
    rango: Date[] | null = null;
    estados = [
        { label: 'Todas', value: '' },
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' },
        { label: 'Anulada', value: 'ANULADA' }
    ];
    modosCobro = [
        { label: 'Contado', value: 'CONTADO' },
        { label: 'Crédito', value: 'CREDITO' }
    ];
    modoCobro = 'CONTADO';
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
        const vigentes = this.ventas.filter((v) => v.estado !== 'ANULADA');
        const total = vigentes.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const cobrado = vigentes.reduce((acc, v) => acc + Number(v.pagado || 0), 0);
        const pendiente = vigentes.reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
        return [
            { label: 'Ventas', value: formatBs(total), icon: 'pi pi-shopping-cart', tone: 'neutral', hint: 'Documentos vigentes' },
            { label: 'Cobrado', value: formatBs(cobrado), icon: 'pi pi-money-bill', tone: 'success', hint: 'Pagado de vigentes; anulada = 0' },
            { label: 'Pendiente', value: formatBs(pendiente), icon: 'pi pi-clock', tone: 'warn', hint: 'Saldo por cobrar vigente' },
            { label: 'Documentos', value: String(vigentes.length), icon: 'pi pi-file', tone: 'info' }
        ];
    }

    constructor(
        private ventasService: VentasService,
        private clientesService: ClientesService,
        private productosService: ProductosService,
        private messageService: MessageService,
        private exportarService: ExportarService,
        private route: ActivatedRoute
    ) {}

    get fechaDesde(): string | undefined {
        return this.rango?.[0] ? this.ymd(this.rango[0]) : undefined;
    }

    get fechaHasta(): string | undefined {
        const hasta = this.rango?.[1] || this.rango?.[0];
        return hasta ? this.ymd(hasta) : undefined;
    }

    exportarVenta(venta: Venta, formato: FormatoExport = 'pdf', visor?: Window | null): void {
        if (formato === 'xlsx') {
            this.exportarService.descargar({ tipo: 'venta', formato, id: venta.id }).subscribe({
                error: () => this.messageService.add({ severity: 'error', summary: 'Exportar', detail: 'No se pudo generar el Excel de la venta' })
            });
            return;
        }
        const ventana = visor ?? this.exportarService.abrirVentanaEspera('Generando nota de venta...');
        this.exportarService.mostrarPdf({ tipo: 'venta', formato: 'pdf', id: venta.id }, ventana).subscribe({
            error: () => this.messageService.add({ severity: 'error', summary: 'Exportar', detail: 'No se pudo generar el PDF de la venta' })
        });
    }

    ngOnInit(): void {
        this.cargar();
        this.cargarProductos();
        this.clientesService.listar().subscribe({ next: (data) => (this.clientes = data) });
        this.route.queryParamMap.subscribe((params) => {
            const id = Number(params.get('id'));
            if (id) {
                this.ver({ id } as Venta);
            }
        });
    }

    get productosOpciones() {
        return this.productos.map((p) => ({
            ...p,
            etiqueta: `${p.nombre} · stock ${p.stock} ${p.unidad_medida}`
        }));
    }

    cargar(): void {
        this.cargando = true;
        this.ventasService.listar({
            estado: this.filtroEstado || undefined,
            id_cliente: this.filtroCliente || undefined,
            fecha_desde: this.rango?.[0] ? this.ymd(this.rango[0]) : undefined,
            fecha_hasta: this.rango?.[1] || this.rango?.[0] ? this.ymd(this.rango[1] || this.rango[0]) : undefined
        }).subscribe({
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
        this.modoCobro = 'CONTADO';
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
        const pendiente = this.totalLineas() - this.pagoAlRegistrar();
        return pendiente > 0 ? pendiente : 0;
    }

    pagoAlRegistrar(): number {
        if (this.modoCobro === 'CONTADO') {
            return this.totalLineas();
        }
        const abono = Number(this.pagoInicial || 0);
        const total = this.totalLineas();
        return abono > total ? total : abono;
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
        const cobro = this.pagoAlRegistrar();
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de venta...');
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
            pago_inicial: cobro,
            metodo_pago: cobro > 0 ? this.metodoPago : undefined,
            referencia: cobro > 0 ? this.referencia || undefined : undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.messageService.add({ severity: 'success', summary: 'Venta', detail: 'Venta registrada. Se abre la nota de venta.' });
                this.cargar();
                this.cargarProductos();
                if (res.data?.id) {
                    this.exportarVenta(res.data, 'pdf', visor);
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

    abrirClienteRapido(): void {
        this.clienteRapido = { nombre: '', nit_ci: '', telefono: '' };
        this.dialogCliente = true;
    }

    guardarClienteRapido(): void {
        if (!this.clienteRapido.nombre.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El nombre es obligatorio' });
            return;
        }
        this.guardandoCliente = true;
        this.clientesService.crear({
            nombre: this.clienteRapido.nombre.trim(),
            nit_ci: this.clienteRapido.nit_ci.trim() || undefined,
            telefono: this.clienteRapido.telefono.trim() || undefined,
            activo: true
        }).subscribe({
            next: (res) => {
                this.guardandoCliente = false;
                this.dialogCliente = false;
                this.clientes = [...this.clientes, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
                this.idCliente = res.data.id;
                this.messageService.add({ severity: 'success', summary: 'Cliente', detail: res.mensaje });
            },
            error: (err) => {
                this.guardandoCliente = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo crear el cliente') });
            }
        });
    }

    abrirCobroDetalle(): void {
        if (!this.detalle) {
            return;
        }
        this.cobroMonto = Number(this.detalle.saldo_pendiente || 0);
        this.cobroMetodo = 'EFECTIVO';
        this.cobroReferencia = '';
        this.dialogCobro = true;
    }

    guardarCobroDetalle(): void {
        if (!this.detalle || !this.cobroMonto) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Indique el monto a cobrar' });
            return;
        }
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de venta...');
        this.ventasService.crearCobranza({
            id_venta: this.detalle.id,
            monto: this.cobroMonto,
            metodo_pago: this.cobroMetodo,
            referencia: this.cobroReferencia || undefined
        }).subscribe({
            next: () => {
                this.guardando = false;
                this.dialogCobro = false;
                this.messageService.add({ severity: 'success', summary: 'Cobranza', detail: 'Cobro registrado. Se abre la nota de venta actualizada.' });
                this.cargar();
                this.ver(this.detalle!);
                this.exportarVenta(this.detalle!, 'pdf', visor);
            },
            error: (err) => {
                visor?.close();
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo registrar la cobranza') });
            }
        });
    }

    pedirAnular(venta: Venta): void {
        this.ventaAnular = venta;
        this.dialogAnular = true;
    }

    confirmarAnular(): void {
        if (!this.ventaAnular) {
            return;
        }
        this.guardando = true;
        this.ventasService.anular(this.ventaAnular.id).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogAnular = false;
                this.dialogDetalle = false;
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
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.msg(err, 'No se pudo anular la venta') });
            }
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

    private ymd(fecha: Date): string {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
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
