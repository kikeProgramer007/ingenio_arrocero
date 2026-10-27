import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { DespachoFormComponent } from '../despachos/despacho-form';
import { DespachosService, etiquetaDespacho, colorDespacho } from '../despachos/despachos.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { etiquetaPago, formatBs, formatFecha, formatFechaCorta, esErrorCajaCerrada } from '../caja/caja.utils';
import { Cliente, LineaVenta, PROCEDENCIAS_CLIENTE, Venta } from './ventas.models';
import { ClientesService, VentasService } from './ventas.service';
import { ExportarService, FormatoExport } from '../../shared/services/exportar.service';
import { ConfirmarService } from '../../shared/services/confirmar.service';
import { nombreUsuario } from '../../shared/utils/usuario';
import { CategoriaProducto, ProductoLista, ProductosService } from '../inventario/productos.service';
import { mediaUrl } from '../../core/utils/media-url';
import { roundMoney } from '../../shared/utils/money';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio';
import { KpiGridComponent, KpiItem } from '../../shared/components/kpi-grid';
import { DialogCajaCerradaComponent } from '../../shared/components/dialog-caja-cerrada';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { MetodoPagoComponent } from '../../shared/components/metodo-pago';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { extrasPagoMixto, mensajePagoMixto } from '../../shared/utils/pago-mixto';
import { TooltipModule } from 'primeng/tooltip';
import { AvisoService } from '../../shared/services/aviso.service';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { esNombreEmpaque, esProductoEmpaque as productoEsEmpaque } from '../../shared/utils/empaque';

@Component({
    selector: 'app-ventas',
    standalone: true,
    imports: [
        CommonModule,
        DespachoFormComponent,
        FormsModule,
        ButtonModule,
        CheckboxModule,
        DatePickerModule,
        DialogModule,
        DrawerModule,
        InputTextModule,
        SelectModule,
        MultiSelectModule,
        SelectButtonModule,
        TableModule,
        PaginatorModule,
        TagModule,
        TextareaModule,
        MenuModule,
        EstadoVacioComponent,
        KpiGridComponent,
        DialogCajaCerradaComponent,
        BotonesExportarComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        MetodoPagoComponent,
        InputNumeroComponent,
        TooltipModule,
        TablaBusquedaComponent
    ],
    template: `
        <app-despacho-form #formDespacho (confirmado)="actualizarDespachos()" />
        <app-dialog-caja-cerrada [(visible)]="dialogCajaCerrada" />
        <p-dialog header="Motivo de anulación" [(visible)]="dialogMotivo" [modal]="true" [style]="{ width: '28rem' }">
            <label class="block font-bold mb-2">Motivo</label>
            <textarea pTextarea class="w-full" rows="3" [(ngModel)]="motivoAnular" maxlength="250"></textarea>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogMotivo = false" />
                <p-button label="Anular" severity="danger" [loading]="guardando" (onClick)="confirmarAnular()" />
            </ng-template>
        </p-dialog>
        <p-dialog header="Editar venta" [(visible)]="dialogEditar" [modal]="true" [style]="{ width: '40rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3" *ngIf="lineasEditar.length">
                <div class="grid grid-cols-12 gap-2 font-bold text-sm"><span class="col-span-6">Producto</span><span class="col-span-3">Cantidad</span><span class="col-span-3">Precio</span></div>
                <div class="grid grid-cols-12 gap-2 items-center" *ngFor="let linea of lineasEditar; let i = index">
                    <span class="col-span-5">{{ linea.descripcion }}</span>
                    <input class="col-span-3 p-inputtext" type="number" min="0" step="0.001" [(ngModel)]="linea.cantidad" />
                    <input class="col-span-3 p-inputtext" type="number" min="0" step="0.01" [(ngModel)]="linea.precio_unitario" />
                    <p-button class="col-span-1" icon="pi pi-trash" [text]="true" severity="danger" [disabled]="(linea.entregado || 0) > 0" (onClick)="lineasEditar.splice(i, 1)" />
                </div>
                <div>
                    <label class="block font-bold mb-2">Motivo</label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="motivoEditar" maxlength="250"></textarea>
                </div>
                <div class="text-sm text-muted-color">Total corregido {{ formatBs(totalEditar) }} · ya cobrado {{ formatBs(cobradoEditar) }}</div>
                <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="cobrarDiferenciaEditar" (ngModelChange)="alCambiarExcesoEditar('cobrar')" /> Cobrar la diferencia ahora</label>
                <div *ngIf="cobrarDiferenciaEditar">
                    <app-metodo-pago [(ngModel)]="metodoEditar" [montoTotal]="diferenciaEditar" [(montoEfectivo)]="efectivoEditar" [(montoQr)]="qrEditar" />
                </div>
                <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="aCreditoEditar" (ngModelChange)="alCambiarExcesoEditar('credito')" /> Pasar el exceso a crédito</label>
                <div *ngIf="aCreditoEditar">
                    <label class="block font-bold mb-2">Plazo en días</label>
                    <input class="p-inputtext w-full" type="number" min="1" [(ngModel)]="plazoEditar" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogEditar = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardarEdicion()" />
            </ng-template>
        </p-dialog>
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Ventas</div>
                <div class="text-muted-color">Ventas, cobranzas y entrega de productos</div>
            </div>
            <p-button label="Nueva venta" icon="pi pi-plus" pTooltip="Registrar una venta" tooltipPosition="left" (onClick)="abrirNueva()" />
        </div>

        <app-kpi-grid [items]="kpis" [loading]="cargando" [columns]="4" [compact]="true" />

        <div class="card">
            <div class="barra-listado">
                <div class="campo campo-sm">
                    <label class="flex items-center gap-1 font-bold mb-1 text-sm">Estado de pago <app-ayuda-campo texto="Pendiente o parcial: aún hay saldo. Pagada: cobrada. El estado de despacho se controla por separado." posicion="bottom" /></label>
                    <p-multiselect [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-wide">
                    <label class="flex items-center gap-1 font-bold mb-1 text-sm">Cliente <app-ayuda-campo texto="Filtra las ventas de un comprador. Déjalo en Todos para ver todos." posicion="bottom" /></label>
                    <p-multiselect [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroCliente" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-fecha">
                    <label class="flex items-center gap-1 font-bold mb-1 text-sm">Período <app-ayuda-campo texto="Rango de fechas de la venta. La venta siempre se registra con la fecha de hoy." posicion="left" /></label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" pTooltip="Aplicar filtros" tooltipPosition="top" (onClick)="cargar()" [loading]="cargando" />
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="ventas" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" [idCliente]="filtroCliente" [estado]="filtroEstado" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : ventas"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} ventas"
                [globalFilterFields]="['id', 'fecha', 'cliente.nombre', 'estado']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Cobrado</th>
                        <th>Pendiente</th>
                        <th>Vence</th>
                        <th>Estado de pago</th>
                        <th>Estado de despacho</th>
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
                        <td>
                            <span *ngIf="venta.fecha_vencimiento">{{ formatFechaCorta(venta.fecha_vencimiento) }}</span>
                            <span *ngIf="!venta.fecha_vencimiento">-</span>
                        </td>
                        <td>
                            <p-tag [value]="venta.estado === 'PARCIAL' ? 'Pago parcial' : venta.estado" [severity]="severidad(venta.estado)" />
                            <p-tag *ngIf="venta.vencida" value="Vencida" severity="danger" class="ml-1" />
                        </td>
                        <td><p-tag [value]="etiquetaDespacho(venta.estado_despacho)" [severity]="colorDespacho(venta.estado_despacho)" /></td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones de la venta"
                                (onClick)="abrirAcciones($event, menuAcciones, venta)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="10" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="10">
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

        <p-drawer [(visible)]="dialogNueva" position="full" styleClass="venta-drawer">
            <div class="venta-drawer-cuerpo">
                <aside class="venta-drawer-catalogo">
                    <div class="venta-drawer-catalogo-cabeza">
                        <div class="font-semibold text-surface-900 dark:text-surface-0 venta-seccion-titulo">Inventario</div>
                        <div class="venta-ayuda-linea"><app-ayuda-campo texto="Selecciona productos del inventario para agregarlos a la venta. No se listan bolsas ni empaques." /></div>
                        <p-selectbutton
                            [options]="categoriasFiltro"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="filtroCategoriaId"
                            (ngModelChange)="reiniciarPaginaCatalogo()"
                            [allowEmpty]="false"
                            size="small"
                            styleClass="flex flex-wrap mb-3"
                        />
                        <app-tabla-busqueda placeholder="Buscar producto..." [value]="busquedaProducto" (valueChange)="cambiarBusquedaCatalogo($event)" />
                    </div>
                    <div class="venta-drawer-catalogo-lista">
                        <button
                            type="button"
                            class="venta-producto"
                            *ngFor="let p of productosCatalogoPagina"
                            (click)="agregarDesdeCatalogo(p)"
                            [disabled]="(p.disponible ?? p.stock) <= cantidadEnFormulario(p)"
                            [class.venta-producto-activo]="productoEnFormulario(p)"
                        >
                            <img [src]="fotoProducto(p.path_imagen)" (error)="imagenProductoFallida($event)" alt="" class="w-9 h-9 rounded-border object-cover shrink-0" />
                            <div class="min-w-0 flex-1 text-left">
                                <div class="font-medium text-sm truncate">{{ p.nombre }}</div>
                                <div class="flex flex-wrap items-center gap-2 mt-0.5">
                                    <span class="text-xs text-muted-color">{{ p.unidad_medida }}</span>
                                    <p-tag [value]="'Disponible ' + (p.disponible ?? p.stock)" [severity]="severidadStock(p.disponible ?? p.stock)" styleClass="text-xs" />
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <div class="font-semibold text-sm whitespace-nowrap">{{ formatBs(p.precio_venta) }}</div>
                                <span class="text-xs font-semibold text-primary" *ngIf="cantidadEnFormulario(p) as n">{{ n }} en ítems</span>
                                <i class="pi pi-plus text-muted-color text-xs" *ngIf="!cantidadEnFormulario(p)"></i>
                            </div>
                        </button>
                        <div *ngIf="!productosCatalogo.length" class="text-center py-8 text-muted-color">
                            <i class="pi pi-box text-3xl mb-2 block"></i>
                            No hay productos vendibles en esta categoría.
                        </div>
                    </div>
                    <p-paginator *ngIf="productosCatalogo.length" [first]="paginaCatalogo" [rows]="filasCatalogo" [totalRecords]="productosCatalogo.length" [rowsPerPageOptions]="[10, 20, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} productos" (onPageChange)="cambiarPaginaCatalogo($event)" styleClass="venta-catalogo-paginador" />
                </aside>
                <section class="venta-drawer-formulario">
                    <div class="venta-formulario-titulo"><strong>Nueva venta</strong><p-button icon="pi pi-times" [text]="true" severity="secondary" ariaLabel="Cerrar nueva venta" (onClick)="dialogNueva = false" /></div>
                    <div class="flex flex-col gap-3 venta-formulario-contenido">
                        <div>
                            <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
                                    <label class="flex items-center gap-1 font-bold">Cliente <app-ayuda-campo texto="Quien compra. Si no está en la lista, pulsa Nuevo." posicion="right" /></label>
                                <p-button label="Nuevo" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="abrirClienteRapido()" />
                            </div>
                            <p-select [options]="clientes" optionLabel="nombre" optionValue="id" [(ngModel)]="idCliente" (ngModelChange)="seleccionarCliente($event)" placeholder="Seleccione cliente" [filter]="true" fluid appendTo="body" [baseZIndex]="2100" />
                        </div>
                        <div>
                            <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
                                <label class="flex items-center gap-1 font-bold">Detalle de la venta <app-ayuda-campo texto="Elige productos a la izquierda. Agrega una línea para flete u otro servicio." posicion="right" /></label>
                                <p-button label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                            </div>
                            <p-table [value]="lineas" size="small" styleClass="venta-lineas" responsiveLayout="scroll">
                                <ng-template #header>
                                    <tr>
                                        <th>Ítem</th>
                                        <th class="venta-col-cantidad">Cantidad</th>
                                        <th class="venta-col-precio">P. unit.</th>
                                        <th class="venta-col-subtotal">Subtotal</th>
                                        <th *ngIf="despachosHabilitados && entrega === 'PARCIAL'">Entregar ahora</th>
                                        <th class="venta-col-accion"></th>
                                    </tr>
                                </ng-template>
                                <ng-template #body let-linea let-i="rowIndex">
                                    <tr>
                                        <td>
                                            <div class="font-medium" *ngIf="linea.id_producto">{{ linea.descripcion }}</div>
                                            <input *ngIf="!linea.id_producto" pInputText class="w-full" placeholder="Ej. flete, servicio" [(ngModel)]="linea.descripcion" />
                                            <div class="text-xs text-muted-color mt-1" *ngIf="linea.id_producto">{{ unidadLinea(linea) }}</div>
                                            <div class="text-xs text-orange-500 mt-1" *ngIf="avisoStock(linea)">{{ avisoStock(linea) }}</div>
                                        </td>
                                        <td class="venta-col-cantidad">
                                            <div class="venta-control">
                                                <app-input-numero class="input-stepper-vertical" tipo="cantidad" [stepperVertical]="true" [(ngModel)]="linea.cantidad" [min]="0" />
                                            </div>
                                        </td>
                                        <td class="venta-col-precio">
                                            <div class="venta-control">
                                                <app-input-numero [(ngModel)]="linea.precio_unitario" />
                                            </div>
                                        </td>
                                        <td class="venta-col-subtotal">
                                            <div class="venta-control venta-control-subtotal">{{ formatBs(subtotalLinea(linea)) }}</div>
                                        </td>
                                        <td *ngIf="despachosHabilitados && entrega === 'PARCIAL'" class="min-w-40"><app-input-numero *ngIf="linea.id_producto" class="input-stepper-vertical" tipo="cantidad" [stepperVertical]="true" [(ngModel)]="linea.entregar_ahora" [min]="0" /></td>
                                        <td class="venta-col-accion">
                                            <p-button icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" pTooltip="Quitar línea" tooltipPosition="top" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1 && !linea.id_producto && !linea.descripcion" />
                                        </td>
                                    </tr>
                                </ng-template>
                            </p-table>
                            <div class="venta-resumen bg-surface-50 dark:bg-surface-800 border border-surface rounded-border">
                                <div>
                                    <div class="text-xs text-muted-color">Total</div>
                                    <div class="font-semibold">{{ formatBs(totalLineas()) }}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-muted-color">Se cobra ahora</div>
                                    <div class="font-medium text-green-600">{{ formatBs(pagoAlRegistrar()) }}</div>
                                </div>
                                <div>
                                    <div class="text-xs text-muted-color">Pendiente</div>
                                    <div class="font-medium text-orange-500">{{ formatBs(pendienteEstimado()) }}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div *ngIf="despachosHabilitados" class="venta-entrega-seccion mb-4">
                                <div class="venta-bloque-cabecera"><strong>Entrega de productos</strong><app-ayuda-campo texto="Si no marca el check, el cliente se lleva todo ahora y la venta no queda en Despachos." /></div>
                                <div class="flex items-center gap-2">
                                    <p-checkbox [(ngModel)]="dejarPendiente" [binary]="true" inputId="pendienteEntrega" (ngModelChange)="sincronizarEntrega()" />
                                    <label for="pendienteEntrega">Dejar productos pendientes de entrega</label>
                                </div>
                                <div class="flex gap-2 mt-3" *ngIf="dejarPendiente">
                                    <p-button [outlined]="modoPendiente !== 'PARCIAL'" label="Entrega parcial ahora" (onClick)="modoPendiente = 'PARCIAL'; sincronizarEntrega()" />
                                    <p-button [outlined]="modoPendiente !== 'POSTERIOR'" label="Retiro posterior" (onClick)="modoPendiente = 'POSTERIOR'; sincronizarEntrega()" />
                                </div>
                                <div class="venta-pendiente" *ngIf="dejarPendiente && tieneProductos"><i class="pi pi-info-circle"></i><span>Queda pendiente de retiro: <b>{{ pendienteEntregaTexto }}</b></span></div>
                            </div>
                        <div class="venta-bloque-cabecera"><strong>Forma de cobro</strong><app-ayuda-campo texto="Contado: se cobra ahora. Crédito: queda un saldo pendiente y puedes registrar un abono." /></div>
                            <p-selectbutton [options]="modosCobro" optionLabel="label" optionValue="value" [(ngModel)]="modoCobro" [allowEmpty]="false" styleClass="venta-modos-cobro" />
                            <div class="venta-ayuda-linea"><app-ayuda-campo texto="La fecha de la venta es la de hoy. No se puede registrar con fecha anterior." /></div>
                        </div>
                        <div class="grid grid-cols-12 gap-3" *ngIf="modoCobro === 'CREDITO'">
                            <div class="col-span-12 md:col-span-4">
                                <label class="flex items-center gap-1 font-bold mb-2">Abono ahora (opcional) <app-ayuda-campo texto="Ej.: total Bs 1.640, abono Bs 500. El resto queda pendiente. 0 = todo a crédito." posicion="top" /></label>
                                <app-input-numero [(ngModel)]="pagoInicial" />
                            </div>
                            <div class="col-span-12 md:col-span-4">
                                <label class="flex items-center gap-1 font-bold mb-2">Plazo de cobro <app-ayuda-campo texto="Obligatorio. Indique días o una fecha de vencimiento antes de guardar." posicion="top" /></label>
                                <p-select [options]="plazosCredito" optionLabel="label" optionValue="value" [(ngModel)]="plazoDias" fluid appendTo="body" [baseZIndex]="2100" />
                                <small class="block text-muted-color mt-1" *ngIf="diasPlazoEfectivo() > 0">Vence el {{ vencimientoEstimado }} · PLAZO: {{ diasPlazoEfectivo() }} {{ diasPlazoEfectivo() === 1 ? 'día' : 'días' }}</small>
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="plazoDias === -2">
                                <label class="flex items-center gap-1 font-bold mb-2">Días de plazo <app-ayuda-campo texto="Cantidad de días para cobrar el saldo. Sale en la nota como PLAZO: N días." posicion="left" /></label>
                                <app-input-numero tipo="cantidad" [(ngModel)]="plazoDiasPersonal" [min]="1" />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="plazoDias === -1">
                                <label class="flex items-center gap-1 font-bold mb-2">Fecha de vencimiento <app-ayuda-campo texto="Día en que el cliente debe cancelar el saldo." posicion="left" /></label>
                                <p-datepicker [(ngModel)]="fechaVencimiento" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [minDate]="hoy" [readonlyInput]="true" fluid />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                                <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR va al banco. Efectivo al cajón. Mixto permite partir el cobro." posicion="top" /></label>
                                <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="pagoInicial" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" [mostrarCambio]="true" />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                                <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Ej.: nro. de transferencia, nro. de QR o comprobante." posicion="left" /></label>
                                <input pInputText class="w-full" [(ngModel)]="referencia" />
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-3" *ngIf="modoCobro === 'CONTADO'">
                            <div class="col-span-12">
                                <label class="flex items-center gap-1 font-bold mb-1">Forma de pago <app-ayuda-campo texto="Selecciona QR, efectivo o mixto. En pago mixto, la suma de QR/banco y efectivo debe igualar el total." /></label>
                                <div class="venta-pago-fila">
                                    <app-metodo-pago class="venta-pago-compacto" [compacto]="true" [(ngModel)]="metodoPago" [montoTotal]="pagoAlRegistrar()" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" [mostrarCambio]="true" />
                                    <div class="venta-referencia"><label class="flex items-center gap-1 font-bold mb-1">Referencia <app-ayuda-campo texto="Número de operación, transferencia o comprobante. Opcional." /></label><input pInputText class="w-full" [(ngModel)]="referencia" /></div>
                                </div>
                            </div>
                        </div>
                        <div class="venta-observacion">
                            <label class="flex items-center gap-1 font-bold mb-1">Observación <app-ayuda-campo texto="Nota interna. No aparece como ingreso; solo queda en la venta." posicion="top" /></label>
                            <textarea pTextarea class="w-full" rows="1" [(ngModel)]="observacion"></textarea>
                        </div>
                    </div>
                    <div class="venta-formulario-pie">
                        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogNueva = false" />
                        <p-button label="Guardar venta" icon="pi pi-save" [loading]="guardando" (onClick)="guardar()" />
                    </div>
                </section>
            </div>
        </p-drawer>

        <p-dialog header="Detalle de venta" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '44rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="mb-3">{{ detalle.cliente?.nombre }} · {{ formatFecha(detalle.fecha) }}</div>
                <div class="flex flex-wrap items-center gap-2 mb-3">
                    <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" />
                    <p-tag *ngIf="detalle.vencida" value="Vencida" severity="danger" />
                    <span class="text-muted-color" *ngIf="detalle.plazo_dias">Plazo {{ detalle.plazo_dias }} {{ detalle.plazo_dias === 1 ? 'día' : 'días' }}</span>
                    <span class="text-muted-color" *ngIf="detalle.fecha_vencimiento"> · Vence {{ formatFechaCorta(detalle.fecha_vencimiento) }}</span>
                </div>
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
                            <td>{{ etiquetaPago(cob) }}</td>
                            <td>{{ nombreUsuario(cob.usuario) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="text-muted-color" *ngIf="!detalle.cobranzas?.length">Aún no hay cobros registrados en esta venta.</div>
                <div class="mt-4" *ngIf="detalle.bitacora?.length">
                    <div class="font-semibold mb-2">Bitácora</div>
                    <div *ngFor="let b of detalle.bitacora" class="text-sm mb-3">
                        <div>{{ b.fecha | date:'dd/MM/yyyy HH:mm' }} · {{ b.usuario?.nombre || b.usuario?.username }} · {{ b.accion }}{{ b.id_caja ? ' · caja #' + b.id_caja : '' }} · {{ b.motivo }}</div>
                        <div class="text-muted-color" *ngIf="b.anterior || b.nuevo">Antes: {{ resumenBitacora(b.anterior) }} → Ahora: {{ resumenBitacora(b.nuevo) }}</div>
                    </div>
                </div>
            </ng-container>
            <ng-template #footer>
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogDetalle = false" />
                <p-button *ngIf="detalle && despachosHabilitados && (detalle.estado_despacho === 'PENDIENTE' || detalle.estado_despacho === 'PARCIAL')" label="Registrar despacho" icon="pi pi-truck" (onClick)="formDespacho.abrir(detalle)" />
                <p-button *ngIf="detalle && detalle.estado_despacho !== 'ANTERIOR'" icon="pi pi-history" label="Historial de despachos" [outlined]="true" (onClick)="formDespacho.abrir(detalle,true)" />
                <p-button *ngIf="detalle && (detalle.estado === 'PENDIENTE' || detalle.estado === 'PARCIAL')" label="Cobrar" icon="pi pi-wallet" pTooltip="Registrar un cobro de esta venta" tooltipPosition="top" (onClick)="abrirCobroDetalle()" />
                <p-button *ngIf="detalle && detalle.estado !== 'ANULADA'" label="Editar" icon="pi pi-pencil" [outlined]="true" (onClick)="abrirEdicion(detalle)" />
                <p-button *ngIf="detalle && detalle.estado !== 'ANULADA'" label="Anular" icon="pi pi-times" severity="danger" [outlined]="true" pTooltip="Anular o eliminar" tooltipPosition="top" (onClick)="pedirAnular(detalle)" />
                <p-button *ngIf="detalle && detalle.estado !== 'ANULADA'" label="PDF" icon="pi pi-file-pdf" severity="danger" [outlined]="true" pTooltip="Ver PDF" tooltipPosition="top" (onClick)="exportarVenta(detalle, 'pdf')" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Nuevo cliente" [(visible)]="dialogCliente" [modal]="true" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Procedencia <app-ayuda-campo texto="De dónde viene el cliente: La Paz, Cochabamba, Oruro u otras." posicion="top" /></label>
                    <p-select [options]="procedencias" [(ngModel)]="clienteRapido.procedencia" placeholder="Seleccione" [showClear]="true" fluid appendTo="body" [baseZIndex]="2200" />
                </div>
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
                    <app-input-numero [(ngModel)]="cobroMonto" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="QR va al banco. Efectivo al cajón. Mixto parte el cobro." posicion="right" /></label>
                    <app-metodo-pago [(ngModel)]="cobroMetodo" [montoTotal]="cobroMonto" [(montoEfectivo)]="cobroEfectivo" [(montoQr)]="cobroQr" [mostrarCambio]="true" />
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

    `,
    styles: [`
        /* PrimeNG monta el drawer fuera del host del componente. */
        ::ng-deep .venta-drawer.p-drawer {
            width: 100vw;
            height: 100vh;
            max-height: 100vh;
            overflow: hidden;
        }
        ::ng-deep .venta-drawer .p-drawer-header { display:none; }
        ::ng-deep .venta-drawer .p-drawer-content {
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
        }
        .venta-drawer-cuerpo {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .venta-drawer-catalogo,
        .venta-drawer-formulario {
            padding: 1rem 1.25rem;
            overflow: auto;
            min-width: 0;
        }
        .venta-drawer-catalogo {
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
        }
        .venta-drawer-catalogo-cabeza {
            flex-shrink: 0;
        }
        .venta-drawer-catalogo-lista {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            margin-top: 0.75rem;
        }
        .venta-drawer-formulario {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            min-height: 0;
        }
        .venta-formulario-titulo { position:relative; flex:0 0 auto; min-height:2.5rem; display:flex; align-items:center; justify-content:center; }
        .venta-formulario-titulo strong { color:var(--p-primary-color,#a51c24); font-size:1.3rem; }
        .venta-formulario-titulo p-button { position:absolute; right:0; top:0; }
        .venta-formulario-contenido { min-height:0; flex:1 1 auto; }
        .venta-formulario-pie { flex:0 0 auto; display:flex; justify-content:flex-end; gap:.5rem; padding-top:.75rem; margin-top:0; border-top:1px solid var(--p-content-border-color,#e5e7eb); background:var(--p-content-background,#fff); }
        .venta-ayuda-linea { display:inline-flex; margin:.2rem 0 .5rem; }
        .venta-seccion-titulo { font-size:1.25rem; }
        @media (max-width: 959px) {
            ::ng-deep .venta-drawer .p-drawer-content {
                overflow: auto;
            }
            .venta-drawer-catalogo-lista { flex:1; overflow-y:auto; }
        }
        @media (min-width: 960px) {
            ::ng-deep .venta-drawer.p-drawer { height:100vh; max-height:100vh; }
            ::ng-deep .venta-drawer .p-drawer-content { height:100%; overflow:hidden; }
            .venta-drawer-cuerpo {
                flex-direction: row;
                height: 100vh;
                min-height: 0;
            }
            .venta-drawer-catalogo,
            .venta-drawer-formulario {
                height:100%;
                min-height:0;
                overflow:hidden;
            }
            .venta-drawer-catalogo {
                width: 38%;
                border-bottom: 0;
                border-right: 1px solid var(--p-content-border-color, #e5e7eb);
            }
            .venta-drawer-formulario {
                width: 62%;
            }
            .venta-formulario-contenido { flex:1 1 0; overflow-y:auto; overscroll-behavior:contain; }
            .venta-drawer-catalogo-lista { flex:1; min-height:0; overflow:auto; }
        }
        .venta-producto {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            width: 100%;
            padding: 0.45rem 0.6rem;
            border: 1px solid var(--p-content-border-color, #e5e7eb);
            border-radius: var(--p-border-radius, 6px);
            background: var(--p-content-background, #fff);
            cursor: pointer;
        }
        .venta-producto:hover,
        .venta-producto-activo {
            border-color: var(--p-primary-color, #b91c1c);
            background: color-mix(in srgb, var(--p-primary-color, #b91c1c) 6%, transparent);
        }
        .venta-resumen {
            display: flex;
            flex-wrap: nowrap;
            justify-content: space-around;
            gap: 0;
            margin-top: 0.75rem;
            padding: 0.75rem 1rem;
            text-align: left;
        }
        .venta-resumen > div { flex:1; padding:0 .75rem; }
        .venta-resumen > div + div { border-left:1px solid var(--p-content-border-color,#d1d5db); }
        .venta-resumen > div > div:last-child { color:var(--p-primary-color,#a51c24); font-size:1.25rem; font-weight:700; }
        .venta-bloque-cabecera { display:flex; align-items:center; gap:.45rem; }
        .venta-bloque-cabecera strong { display:block; font-size:1.2rem; }
        .venta-opciones-entrega { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; margin-top:.65rem; }
        .venta-opcion-entrega { min-width:0; min-height:5rem; display:flex; align-items:center; gap:.75rem; padding:.7rem .8rem; text-align:left; color:var(--p-text-color); background:var(--p-content-background); border:1px solid var(--p-content-border-color); border-radius:6px; cursor:pointer; }
        .venta-opcion-entrega > i:first-child { font-size:1.5rem; }
        .venta-opcion-entrega > i:last-child { margin-left:auto; font-size:1rem; }
        .venta-opcion-texto { min-width:0; flex:1; }
        .venta-opcion-texto b { display:block; }
        .venta-opcion-entrega.seleccionada { border-color:var(--p-primary-color,#a51c24); color:var(--p-primary-color,#a51c24); background:color-mix(in srgb,var(--p-primary-color,#a51c24) 6%,white); }
        .venta-pendiente { display:flex; gap:.6rem; align-items:center; padding:.7rem .9rem; margin-top:.6rem; border-radius:6px; color:var(--p-primary-color,#a51c24); background:color-mix(in srgb,var(--p-primary-color,#a51c24) 9%,white); }
        .venta-persona-retira { margin-top:.75rem; }
        .venta-pago-fila { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-areas:"options options options reference" "qr cash received change" "sum sum sum sum"; gap:.55rem; align-items:end; }
        .venta-pago-fila .venta-referencia { grid-area:reference; min-width:0; }
        ::ng-deep .venta-pago-fila .metodo-pago-grid { grid-area:options; }
        ::ng-deep .venta-pago-fila .metodo-pago-suma { grid-area:sum; }
        ::ng-deep .venta-pago-fila .metodo-pago-desglose > .metodo-pago-ayuda,
        ::ng-deep .venta-pago-fila .metodo-pago-cambio > .metodo-pago-ayuda { display:none; }
        ::ng-deep .venta-pago-fila .metodo-pago-desglose > .metodo-pago-montos > div:first-child { grid-area:qr; }
        ::ng-deep .venta-pago-fila .metodo-pago-desglose > .metodo-pago-montos > div:last-child { grid-area:cash; }
        ::ng-deep .venta-pago-fila .metodo-pago-cambio > .metodo-pago-montos > div:first-child { grid-area:received; }
        ::ng-deep .venta-pago-fila .metodo-pago-cambio > .metodo-pago-montos > div:last-child { grid-area:change; }
        ::ng-deep .venta-pago-fila .metodo-pago-montos > div { min-width:0; }
        ::ng-deep .venta-pago-fila .metodo-pago-montos label { margin-bottom:.2rem; }
        ::ng-deep .venta-catalogo-paginador { flex:0 0 auto; padding:.5rem 0 0; }
        @media (max-width: 700px) {
            .venta-opciones-entrega { grid-template-columns:1fr; }
            .venta-resumen { padding:.65rem .25rem; }
            .venta-resumen > div { padding:0 .35rem; }
            .venta-resumen > div > div:last-child { font-size:1rem; }
            .venta-pago-fila { grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-areas:"options options" "reference reference" "qr cash" "received change" "sum sum"; }
        }
        ::ng-deep .venta-drawer .venta-lineas.p-datatable table {
            min-width: 52rem;
            border-collapse: separate;
            border-spacing: 0.85rem 0;
        }
        ::ng-deep .venta-drawer .venta-lineas.p-datatable .p-datatable-thead > tr > th,
        ::ng-deep .venta-drawer .venta-lineas.p-datatable .p-datatable-tbody > tr > td {
            padding: 0.7rem 0.35rem;
            vertical-align: middle;
        }
        .venta-control {
            display: inline-flex;
            align-items: center;
            min-height: 2.5rem;
            padding: 0 0.15rem;
        }
        .venta-control-subtotal {
            justify-content: flex-end;
            min-width: 6.5rem;
            font-weight: 600;
            white-space: nowrap;
        }
        ::ng-deep .venta-drawer .venta-lineas .venta-col-cantidad,
        ::ng-deep .venta-drawer .venta-lineas .venta-col-precio,
        ::ng-deep .venta-drawer .venta-lineas .venta-col-subtotal,
        ::ng-deep .venta-drawer .venta-lineas .venta-col-accion {
            white-space: nowrap;
        }
        ::ng-deep .venta-drawer .venta-lineas .venta-col-cantidad app-input-numero,
        ::ng-deep .venta-drawer .venta-lineas .venta-col-precio app-input-numero {
            display: inline-flex !important;
            width: auto !important;
        }
        ::ng-deep .venta-drawer .venta-lineas .venta-col-cantidad .input-numero,
        ::ng-deep .venta-drawer .venta-lineas .venta-col-precio .input-numero {
            width: auto;
            gap: 0.5rem;
        }
        ::ng-deep .venta-drawer .venta-lineas .venta-col-cantidad .input-numero input {
            width: 4.25rem !important;
            flex: 0 0 4.25rem !important;
        }
        ::ng-deep .venta-drawer .venta-lineas .venta-col-precio .input-numero input {
            width: 7.25rem !important;
            flex: 0 0 7.25rem !important;
        }
    `]
})
export class VentasPage implements OnInit {
    @ViewChild('formDespacho') formDespacho!: DespachoFormComponent;
    despachosHabilitados = false;
    dejarPendiente = false;
    modoPendiente: 'PARCIAL' | 'POSTERIOR' = 'PARCIAL';
    entrega = 'COMPLETA'; personaRetira = ''; claveVenta = '';
    sincronizarEntrega(): void {
        this.entrega = this.dejarPendiente ? this.modoPendiente : 'COMPLETA';
    }
    etiquetaDespacho = etiquetaDespacho; colorDespacho = colorDespacho;
    opcionesEntrega = [
        { label: 'Entrega completa ahora', description: 'Se entregan todos los productos en este momento.', icon: 'pi pi-truck', value: 'COMPLETA' },
        { label: 'Entrega parcial ahora', description: 'Se entrega una parte ahora y el resto queda para después.', icon: 'pi pi-truck', value: 'PARCIAL' },
        { label: 'Retiro posterior', description: 'No se entrega ahora. El cliente retirará después.', icon: 'pi pi-home', value: 'POSTERIOR' }
    ];
    get tieneProductos() { return this.lineas.some(l => l.id_producto); }
    get totalEditar(): number {
        return this.lineasEditar.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.precio_unitario || 0), 0);
    }
    get cobradoEditar(): number {
        return Number(this.detalle?.pagado || 0);
    }
    get diferenciaEditar(): number {
        return Math.max(0, this.totalEditar - this.cobradoEditar);
    }
    resumenBitacora(valor: unknown): string {
        if (!valor) {
            return '-';
        }
        const dato = typeof valor === 'string' ? (() => { try { return JSON.parse(valor); } catch { return valor; } })() : valor;
        if (typeof dato !== 'object') {
            return String(dato);
        }
        const obj = dato as { total?: number; saldo_pendiente?: number; estado?: string; lineas?: { descripcion?: string; cantidad?: number; precio_unitario?: number }[] };
        const partes = [
            obj.total != null ? `total ${this.formatBs(obj.total)}` : '',
            obj.saldo_pendiente != null ? `saldo ${this.formatBs(obj.saldo_pendiente)}` : '',
            obj.estado || ''
        ].filter(Boolean);
        if (obj.lineas?.length) {
            partes.push(obj.lineas.map((l) => `${l.descripcion || 'ítem'} ${l.cantidad} x ${l.precio_unitario}`).join(', '));
        }
        return partes.join(' · ') || '-';
    }
    alCambiarExcesoEditar(origen: 'cobrar' | 'credito'): void {
        if (origen === 'cobrar' && this.cobrarDiferenciaEditar) {
            this.aCreditoEditar = false;
            this.efectivoEditar = this.diferenciaEditar;
            this.qrEditar = 0;
        }
        if (origen === 'credito' && this.aCreditoEditar) {
            this.cobrarDiferenciaEditar = false;
        }
    }
    get pendienteEntregaTexto() { return this.lineas.filter(l => l.id_producto).map(l => `${this.entrega === 'COMPLETA' ? 0 : this.entrega === 'POSTERIOR' ? l.cantidad : Math.max(0, Number(l.cantidad) - Number(l.entregar_ahora || 0))} ${this.unidadLinea(l)} de ${l.descripcion}`).join('; ') || 'No aplica'; }
    actualizarDespachos() { this.cargar(); this.cargarProductos(); if (this.detalle && this.dialogDetalle) this.ver(this.detalle); }
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    ventas: Venta[] = [];
    itemsAcciones: MenuItem[] = [];
    clientes: Cliente[] = [];
    productos: ProductoLista[] = [];
    categorias: CategoriaProducto[] = [];
    filtroCategoriaId: number | null = null;
    busquedaProducto = '';
    paginaCatalogo = 0;
    filasCatalogo = 10;
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogMotivo = false;
    motivoAnular = '';
    dialogEditar = false;
    motivoEditar = '';
    aCreditoEditar = false;
    cobrarDiferenciaEditar = false;
    metodoEditar = 'EFECTIVO';
    efectivoEditar = 0;
    qrEditar = 0;
    plazoEditar = 7;
    lineasEditar: { id?: number; descripcion: string; cantidad: number; precio_unitario: number; id_producto?: number | null; entregado?: number }[] = [];
    dialogDetalle = false;
    dialogCajaCerrada = false;
    dialogCliente = false;
    dialogCobro = false;
    guardandoCliente = false;
    ventaAnular: Venta | null = null;
    cobroMonto = 0;
    cobroMetodo = 'EFECTIVO';
    cobroEfectivo = 0;
    cobroQr = 0;
    cobroReferencia = '';
    clienteRapido = { nombre: '', nit_ci: '', telefono: '', procedencia: null as string | null };
    procedencias = [...PROCEDENCIAS_CLIENTE];
    filtroEstado: string[] = [];
    filtroCliente: number[] = [];
    rango: Date[] | null = null;
    estados = [
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Pago parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' },
        { label: 'Vencidas', value: 'VENCIDA' },
        { label: 'Anulada', value: 'ANULADA' }
    ];
    plazosCredito = [
        { label: '7 días', value: 7 },
        { label: '15 días', value: 15 },
        { label: '30 días', value: 30 },
        { label: 'Otros días', value: -2 },
        { label: 'Fecha exacta', value: -1 }
    ];
    plazoDias = 7;
    plazoDiasPersonal = 7;
    fechaVencimiento: Date | null = null;
    hoy = new Date();
    modosCobro = [
        { label: 'Contado', value: 'CONTADO' },
        { label: 'Crédito', value: 'CREDITO' }
    ];
    modoCobro = 'CONTADO';
    idCliente: number | null = null;
    lineas: LineaVenta[] = [this.lineaVacia()];
    pagoInicial = 0;
    metodoPago = 'EFECTIVO';
    montoEfectivo = 0;
    montoQr = 0;
    referencia = '';
    observacion = '';
    detalle: Venta | null = null;
    formatBs = formatBs;
    formatFecha = formatFecha;
    formatFechaCorta = formatFechaCorta;
    etiquetaPago = etiquetaPago;
    nombreUsuario = nombreUsuario;

    get kpis(): KpiItem[] {
        const vigentes = this.ventas.filter((v) => v.estado !== 'ANULADA');
        const total = vigentes.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const cobrado = vigentes.reduce((acc, v) => acc + Number(v.pagado || 0), 0);
        const pendiente = vigentes.reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
        const vencido = vigentes.filter((v) => v.vencida).reduce((acc, v) => acc + Number(v.saldo_pendiente || 0), 0);
        return [
            { label: 'Ventas', value: formatBs(total), icon: 'pi pi-shopping-cart', tone: 'neutral', hint: 'Documentos vigentes' },
            { label: 'Cobrado', value: formatBs(cobrado), icon: 'pi pi-money-bill', tone: 'success', hint: 'Pagado de vigentes; anulada = 0' },
            { label: 'Pendiente', value: formatBs(pendiente), icon: 'pi pi-clock', tone: 'warn', hint: 'Saldo por cobrar vigente' },
            { label: 'Vencido', value: formatBs(vencido), icon: 'pi pi-exclamation-triangle', tone: 'danger', hint: 'Saldo con fecha de cobro ya vencida' }
        ];
    }

    constructor(
        private despachosService: DespachosService,
        private ventasService: VentasService,
        private clientesService: ClientesService,
        private productosService: ProductosService,
        private aviso: AvisoService,
        private exportarService: ExportarService,
        private confirmar: ConfirmarService,
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
                error: (err) => this.aviso.error(err, 'No se pudo generar el Excel de la venta')
            });
            return;
        }
        const ventana = visor ?? this.exportarService.abrirVentanaEspera('Generando nota de venta...');
        this.exportarService.mostrarPdf({ tipo: 'venta', formato: 'pdf', id: venta.id }, ventana).subscribe({
            error: (err) => this.aviso.error(err, 'No se pudo generar el PDF de la venta')
        });
    }

    ngOnInit(): void {
        this.despachosService.config().subscribe({ next: r => this.despachosHabilitados = r.habilitado });
        this.cargar();
        this.cargarProductos();
        this.cargarCategorias();
        this.clientesService.listar().subscribe({ next: (data) => (this.clientes = data) });
        this.route.queryParamMap.subscribe((params) => {
            const id = Number(params.get('id'));
            if (id) {
                this.ver({ id } as Venta);
            }
        });
    }

    get categoriasFiltro(): { label: string; value: number | null }[] {
        return [
            { label: 'Todas', value: null },
            ...this.categorias
                .filter((c) => !this.esNombreEmpaque(c.nombre))
                .map((c) => ({ label: c.nombre, value: c.id }))
        ];
    }

    get productosCatalogo(): ProductoLista[] {
        const q = this.busquedaProducto.trim().toLowerCase();
        return this.productos.filter((p) => {
            if (this.esProductoEmpaque(p)) {
                return false;
            }
            if (p.disponible_en === 'COMPRAS') {
                return false;
            }
            const categoriaId = p.categoria?.id ?? p.id_categoria ?? null;
            if (this.filtroCategoriaId != null && categoriaId !== this.filtroCategoriaId) {
                return false;
            }
            if (q && !(p.nombre || '').toLowerCase().includes(q) && !(p.categoria?.nombre || '').toLowerCase().includes(q)) {
                return false;
            }
            return true;
        });
    }

    private esProductoEmpaque(p: ProductoLista): boolean {
        return productoEsEmpaque(p);
    }

    private esNombreEmpaque(nombre?: string | null): boolean {
        return esNombreEmpaque(nombre);
    }

    cargar(): void {
        this.cargando = true;
        this.ventasService.listar({
            estado: this.filtroEstado.length ? this.filtroEstado : undefined,
            id_cliente: this.filtroCliente.length ? this.filtroCliente : undefined,
            fecha_desde: this.rango?.[0] ? this.ymd(this.rango[0]) : undefined,
            fecha_hasta: this.rango?.[1] || this.rango?.[0] ? this.ymd(this.rango[1] || this.rango[0]) : undefined
        }).subscribe({
            next: (data) => {
                this.ventas = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar ventas');
            }
        });
    }

    abrirNueva(): void {
        this.idCliente = null;
        this.lineas = [this.lineaVacia()];
        this.pagoInicial = 0;
        this.modoCobro = 'CONTADO';
        this.metodoPago = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
        this.referencia = '';
        this.observacion = '';
        this.plazoDias = 7;
        this.plazoDiasPersonal = 7;
        this.fechaVencimiento = null;
        this.hoy = new Date();
        this.filtroCategoriaId = null;
        this.busquedaProducto = '';
        this.dialogNueva = true;
        this.dejarPendiente = false;
        this.modoPendiente = 'PARCIAL';
        this.entrega = 'COMPLETA'; this.personaRetira = ''; this.claveVenta = crypto.randomUUID();
    }

    agregarLinea(): void {
        this.lineas.push(this.lineaVacia());
    }

    quitarLinea(i: number): void {
        this.lineas.splice(i, 1);
        if (!this.lineas.length) {
            this.lineas = [this.lineaVacia()];
        }
    }

    agregarDesdeCatalogo(producto: ProductoLista): void {
        if (this.cantidadEnFormulario(producto) >= Number(producto.disponible ?? producto.stock)) return;
        if (this.esProductoEmpaque(producto)) {
            this.aviso.aviso('Venta', 'Las bolsas y empaques no se venden. Se dan de baja en Bolsas y empaques.');
            return;
        }
        const existente = this.lineas.find((l) => l.id_producto === producto.id);
        if (existente) {
            existente.cantidad = Number(existente.cantidad || 0) + 1;
            existente.subtotal = this.subtotalLinea(existente);
            return;
        }
        const vacia = this.lineas.find((l) => !l.id_producto && !l.descripcion?.trim() && Number(l.precio_unitario || 0) === 0);
        const linea = vacia || this.lineaVacia();
        linea.id_producto = producto.id;
        linea.descripcion = producto.nombre;
        linea.cantidad = Number(linea.cantidad || 0) > 0 ? Number(linea.cantidad) : 1;
        linea.precio_unitario = Number(producto.precio_venta || 0);
        linea.subtotal = this.subtotalLinea(linea);
        if (!vacia) {
            this.lineas.push(linea);
        }
    }

    productoEnFormulario(producto: ProductoLista): boolean {
        return this.cantidadEnFormulario(producto) > 0;
    }

    cantidadEnFormulario(producto: ProductoLista): number {
        return this.lineas
            .filter((l) => l.id_producto === producto.id)
            .reduce((acc, l) => acc + Number(l.cantidad || 0), 0);
    }

    unidadLinea(linea: LineaVenta): string {
        return this.productos.find((p) => p.id === linea.id_producto)?.unidad_medida || '';
    }

    severidadStock(stock: number): 'success' | 'warn' | 'danger' {
        if (Number(stock) <= 0) {
            return 'danger';
        }
        if (Number(stock) <= 5) {
            return 'warn';
        }
        return 'success';
    }

    fotoProducto(path?: string | null): string {
        return mediaUrl(path, 'producto');
    }

    get productosCatalogoPagina(): ProductoLista[] {
        return this.productosCatalogo.slice(this.paginaCatalogo, this.paginaCatalogo + this.filasCatalogo);
    }

    reiniciarPaginaCatalogo(): void {
        this.paginaCatalogo = 0;
    }

    cambiarBusquedaCatalogo(valor: string): void {
        this.busquedaProducto = valor;
        this.reiniciarPaginaCatalogo();
    }

    cambiarPaginaCatalogo(evento: PaginatorState): void {
        this.paginaCatalogo = evento.first ?? 0;
        this.filasCatalogo = evento.rows ?? 10;
    }
    imagenProductoFallida(event: Event): void {
        const imagen = event.target as HTMLImageElement;
        imagen.onerror = null;
        const respaldo = mediaUrl(null, 'producto');
        if (imagen.src !== respaldo) imagen.src = respaldo;
    }

    subtotalLinea(linea: LineaVenta): number {
        return roundMoney(Number(linea.cantidad || 0) * Number(linea.precio_unitario || 0));
    }

    totalLineas(): number {
        return roundMoney(this.lineas.reduce((acc, l) => acc + this.subtotalLinea(l), 0));
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

    diasPlazoEfectivo(): number {
        if (this.plazoDias === -2) {
            return Math.max(0, Math.round(Number(this.plazoDiasPersonal) || 0));
        }
        return this.plazoDias > 0 ? this.plazoDias : 0;
    }

    get vencimientoEstimado(): string {
        const dias = this.diasPlazoEfectivo();
        if (dias <= 0) {
            return '';
        }
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + dias);
        return formatFechaCorta(fecha);
    }

    private plazoPayload(): { plazo_dias?: number; fecha_vencimiento?: string } {
        if (this.modoCobro !== 'CREDITO' || this.pendienteEstimado() <= 0) {
            return {};
        }
        if (this.plazoDias === -1 && this.fechaVencimiento) {
            return { fecha_vencimiento: this.ymd(this.fechaVencimiento) };
        }
        const dias = this.diasPlazoEfectivo();
        if (dias > 0) {
            return { plazo_dias: dias };
        }
        return {};
    }

    guardar(): void {
        if (this.guardando) return;
        if (!this.idCliente) {
            this.aviso.aviso('Validación', 'Seleccione un cliente');
            return;
        }
        const lineas = this.lineas.filter((l) => Number(l.cantidad) > 0 && (l.id_producto || l.descripcion?.trim()));
        if (!lineas.length) {
            this.aviso.aviso('Validación', 'Agregue al menos un producto o una descripción');
            return;
        }
        if (lineas.some(l => !!this.avisoStock(l))) { this.aviso.aviso('Validación', 'La cantidad supera lo disponible'); return; }
        if (this.despachosHabilitados && this.tieneProductos && this.entrega === 'PARCIAL') {
            if (!lineas.some(l => l.id_producto && Number(l.entregar_ahora) > 0) || lineas.some(l => l.id_producto && (Number(l.entregar_ahora || 0) < 0 || Number(l.entregar_ahora || 0) > Number(l.cantidad)))) {
                this.aviso.aviso('Validación', 'Indique las cantidades que se lleva el cliente ahora'); return;
            }
        }
        const cobro = this.pagoAlRegistrar();
        if (this.modoCobro === 'CREDITO' && this.diasPlazoEfectivo() < 1 && this.plazoDias !== -1) {
            this.aviso.aviso('Validación', 'Seleccione un plazo en días o una fecha de vencimiento');
            return;
        }
        if (this.modoCobro === 'CREDITO' && this.plazoDias === -2 && this.diasPlazoEfectivo() < 1) {
            this.aviso.aviso('Validación', 'Indique los días de plazo');
            return;
        }
        if (this.modoCobro === 'CREDITO' && this.plazoDias === -1 && !this.fechaVencimiento) {
            this.aviso.aviso('Validación', 'Indique la fecha de vencimiento o elija un plazo en días');
            return;
        }
        const mixto = mensajePagoMixto(this.metodoPago, cobro, this.montoEfectivo, this.montoQr);
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de venta...');
        this.guardando = true;
        this.ventasService.crear({
            ...(this.despachosHabilitados ? { entrega: this.entrega, clave: this.claveVenta, persona_retira: this.personaRetira || undefined } : {}),
            id_cliente: this.idCliente,
            observacion: this.observacion || undefined,
            lineas: lineas.map((l) => ({
                descripcion: (l.descripcion || '').trim() || this.nombreProducto(l.id_producto),
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario),
                id_producto: l.id_producto || undefined,
                entregar_ahora: this.despachosHabilitados && l.id_producto && this.entrega === 'PARCIAL' ? Number(l.entregar_ahora || 0) : undefined
            })),
            pago_inicial: cobro,
            metodo_pago: cobro > 0 ? this.metodoPago : undefined,
            referencia: cobro > 0 ? this.referencia || undefined : undefined,
            ...(cobro > 0 ? extrasPagoMixto(this.metodoPago, this.montoEfectivo, this.montoQr) : {}),
            ...this.plazoPayload()
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.aviso.ok('Venta', 'Venta registrada. Se abre la nota de venta.');
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
                this.aviso.error(err, 'No se pudo registrar la venta');
            }
        });
    }

    abrirAcciones(event: Event, menu: Menu, venta: Venta): void {
        const items: MenuItem[] = [
            {
                label: 'Ver detalle',
                icon: 'pi pi-eye menu-icon-ver',
                iconStyle: { color: '#3b82f6' },
                command: () => this.ver(venta)
            },
            {
                label: 'Ver PDF',
                icon: 'pi pi-file-pdf menu-icon-pdf',
                iconStyle: { color: '#ef4444' },
                disabled: venta.estado === 'ANULADA',
                command: () => this.exportarVenta(venta, 'pdf')
            }
        ];
        if (venta.estado !== 'ANULADA') {
            if (venta.estado_despacho && venta.estado_despacho !== 'ANTERIOR') {
                items.push({ label: 'Ver historial de despachos', icon: 'pi pi-history', command: () => this.formDespacho.abrir(venta, true) });
                if (this.despachosHabilitados && ['PENDIENTE', 'PARCIAL'].includes(venta.estado_despacho)) items.push({ label: 'Registrar despacho', icon: 'pi pi-truck', command: () => this.formDespacho.abrir(venta) });
            }
            items.push({ separator: true });
            items.push({
                label: 'Editar',
                icon: 'pi pi-pencil',
                command: () => this.abrirEdicion(venta)
            });
            items.push({
                label: 'Anular o eliminar',
                icon: 'pi pi-times menu-icon-anular',
                iconStyle: { color: '#f97316' },
                command: () => this.pedirAnular(venta)
            });
        }
        this.itemsAcciones = items;
        menu.toggle(event);
    }

    ver(venta: Venta): void {
        this.ventasService.obtener(venta.id).subscribe({
            next: (data) => {
                this.detalle = data;
                this.dialogDetalle = true;
            },
            error: (err) => this.aviso.error(err, 'No se pudo cargar el detalle')
        });
    }

    abrirClienteRapido(): void {
        this.clienteRapido = { nombre: '', nit_ci: '', telefono: '', procedencia: null };
        this.dialogCliente = true;
    }

    seleccionarCliente(id: number | null): void {
        this.idCliente = id;
        this.personaRetira = this.clientes.find((cliente) => cliente.id === id)?.nombre || '';
    }

    guardarClienteRapido(): void {
        if (!this.clienteRapido.nombre.trim()) {
            this.aviso.aviso('Validación', 'El nombre es obligatorio');
            return;
        }
        this.guardandoCliente = true;
        this.clientesService.crear({
            nombre: this.clienteRapido.nombre.trim(),
            nit_ci: this.clienteRapido.nit_ci.trim() || undefined,
            telefono: this.clienteRapido.telefono.trim() || undefined,
            procedencia: this.clienteRapido.procedencia || undefined,
            activo: true
        }).subscribe({
            next: (res) => {
                this.guardandoCliente = false;
                this.dialogCliente = false;
                this.clientes = [...this.clientes, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
                this.seleccionarCliente(res.data.id);
                this.aviso.ok('Cliente', res.mensaje);
            },
            error: (err) => {
                this.guardandoCliente = false;
                this.aviso.error(err, 'No se pudo crear el cliente');
            }
        });
    }

    abrirCobroDetalle(): void {
        if (!this.detalle) {
            return;
        }
        this.cobroMonto = Number(this.detalle.saldo_pendiente || 0);
        this.cobroMetodo = 'EFECTIVO';
        this.cobroEfectivo = 0;
        this.cobroQr = 0;
        this.cobroReferencia = '';
        this.dialogCobro = true;
    }

    guardarCobroDetalle(): void {
        if (!this.detalle || !this.cobroMonto) {
            this.aviso.aviso('Validación', 'Indique el monto a cobrar');
            return;
        }
        const mixto = mensajePagoMixto(this.cobroMetodo, this.cobroMonto, this.cobroEfectivo, this.cobroQr);
        if (mixto) {
            this.aviso.aviso('Validación', mixto);
            return;
        }
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando boleta de cobranza...');
        this.ventasService.crearCobranza({
            id_venta: this.detalle.id,
            monto: this.cobroMonto,
            metodo_pago: this.cobroMetodo,
            referencia: this.cobroReferencia || undefined,
            ...extrasPagoMixto(this.cobroMetodo, this.cobroEfectivo, this.cobroQr)
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogCobro = false;
                this.aviso.ok('Cobranza', 'Cobro registrado. Se abre la boleta.');
                this.cargar();
                this.ver(this.detalle!);
                const id = res.data?.id;
                if (id) {
                    this.exportarService.mostrarPdf({ tipo: 'cobranza', formato: 'pdf', id }, visor).subscribe({
                        error: (err) => this.aviso.error(err, 'No se pudo generar la boleta de cobranza')
                    });
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
                this.aviso.error(err, 'No se pudo registrar la cobranza');
            }
        });
    }

    pedirAnular(venta: Venta): void {
        const extra =
            venta.pagado > 0
                ? ` Lo cobrado (${this.formatBs(venta.pagado)}) se descuenta de la caja abierta.`
                : ' Esta venta no había generado ingreso a caja.';
        this.confirmar
            .pedir({
                titulo: 'Anular venta',
                mensaje: `¿Anular la venta #${venta.id} de ${venta.cliente?.nombre || 'cliente'}? Si la mercadería sigue en el negocio, vuelve a disponible. Un retiro real no se puede anular por aquí.${extra}`,
                aceptar: 'Anular',
                peligro: true
            })
            .then((ok) => {
                if (ok) {
        this.ventaAnular = venta;
        this.motivoAnular = '';
        this.dialogMotivo = true;
                }
            });
    }

    abrirEdicion(venta: Venta): void {
        const cargar = (data: Venta) => {
            this.detalle = data;
            this.lineasEditar = (data.detalles || []).map((l) => ({
                id: l.id,
                id_producto: l.id_producto,
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                precio_unitario: l.precio_unitario,
                entregado: l.entregado || 0
            }));
            this.motivoEditar = '';
            this.aCreditoEditar = false;
            this.cobrarDiferenciaEditar = false;
            this.metodoEditar = 'EFECTIVO';
            this.efectivoEditar = 0;
            this.qrEditar = 0;
            this.plazoEditar = data.plazo_dias || 7;
            this.dialogEditar = true;
        };
        if (venta.detalles?.length) {
            cargar(venta);
            return;
        }
        this.ventasService.obtener(venta.id).subscribe({
            next: (data) => cargar(data),
            error: (err) => this.aviso.error(err, 'No se pudo cargar la venta')
        });
    }

    guardarEdicion(): void {
        if (!this.detalle || !this.motivoEditar.trim()) {
            this.aviso.aviso('Validación', 'Indique el motivo de la corrección');
            return;
        }
        this.guardando = true;
        this.ventasService.editar(this.detalle.id, {
            motivo: this.motivoEditar.trim(),
            lineas: this.lineasEditar,
            a_credito: this.aCreditoEditar,
            plazo_dias: this.aCreditoEditar ? this.plazoEditar : undefined,
            cobrar_diferencia: this.cobrarDiferenciaEditar,
            metodo_pago: this.cobrarDiferenciaEditar ? this.metodoEditar : undefined,
            monto_efectivo: this.cobrarDiferenciaEditar ? this.efectivoEditar : undefined,
            monto_qr: this.cobrarDiferenciaEditar ? this.qrEditar : undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogEditar = false;
                this.detalle = res.data;
                this.aviso.ok('Venta', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo editar la venta');
            }
        });
    }

    confirmarAnular(): void {
        if (!this.ventaAnular || !this.motivoAnular.trim()) {
            this.aviso.aviso('Validación', 'Indique el motivo de la anulación');
            return;
        }
        this.guardando = true;
        this.ventasService.anular(this.ventaAnular.id, this.motivoAnular.trim()).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogMotivo = false;
                this.dialogDetalle = false;
                this.aviso.ok('Venta', res.mensaje);
                this.cargar();
                this.cargarProductos();
            },
            error: (err) => {
                this.guardando = false;
                if (esErrorCajaCerrada(err)) {
                    this.dialogCajaCerrada = true;
                    return;
                }
                this.aviso.error(err, 'No se pudo anular la venta');
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
        if (this.cantidadEnFormulario(producto) > Number(producto.disponible ?? producto.stock)) {
            return `Disponible insuficiente: hay ${producto.disponible ?? producto.stock} ${producto.unidad_medida}`;
        }
        return '';
    }

    private cargarProductos(): void {
        this.productosService.listar().subscribe({ next: (data) => (this.productos = data) });
    }

    private cargarCategorias(): void {
        this.productosService.categorias().subscribe({ next: (data) => (this.categorias = data) });
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
}
