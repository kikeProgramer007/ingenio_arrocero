import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { formatBs, formatFecha, formatFechaCorta, esErrorCajaCerrada } from '../caja/caja.utils';
import { Compra, CrearCompraPayload, LineaCompra, Proveedor, TipoCompra } from './compras.models';
import { ComprasService, ProveedoresService } from './compras.service';
import { CategoriaProducto, ProductoLista, ProductosService } from '../inventario/productos.service';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
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
import { EmpresaService } from '../../core/services/empresa.service';
import { formatUsd, roundMoney } from '../../shared/utils/money';
import { esUnidadMedidaValida, MENSAJE_UNIDAD_MEDIDA, UNIDADES_MEDIDA } from '../../shared/utils/unidad-medida';
import { esProductoEmpaque } from '../../shared/utils/empaque';
import { ymdDesdeRango, ymdHastaRango } from '../../shared/utils/fecha-filtro';

@Component({
    selector: 'app-compras',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CheckboxModule,
        DialogModule,
        DrawerModule,
        InputTextModule,
        IconFieldModule,
        InputIconModule,
        MessageModule,
        DatePickerModule,
        SelectModule,
        MultiSelectModule,
        SelectButtonModule,
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
                <div class="text-muted-color">Un solo formulario. Contado o crédito, con abono inicial. La chala se cotiza en USD y se paga en Bs.</div>
            </div>
            <p-button label="Nueva compra" icon="pi pi-plus" (onClick)="abrirNueva()" />
        </div>

        <div class="card">
            <div class="barra-listado">
                <div class="campo campo-sm">
                    <label class="block font-bold mb-1 text-sm">Estado</label>
                    <p-multiselect [options]="estados" optionLabel="label" optionValue="value" [(ngModel)]="filtroEstado" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo">
                    <label class="block font-bold mb-1 text-sm">Tipo</label>
                    <p-multiselect [options]="tiposFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipo" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-wide">
                    <label class="block font-bold mb-1 text-sm">Proveedor</label>
                    <p-multiselect [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="filtroProveedor" placeholder="Todos" display="chip" [filter]="true" [showClear]="true" fluid appendTo="body" />
                </div>
                <div class="campo-fecha">
                    <label class="block font-bold mb-1 text-sm">Período</label>
                    <p-datepicker selectionMode="range" [(ngModel)]="rango" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Fechas" fluid />
                </div>
                <p-button label="Consultar" icon="pi pi-filter" (onClick)="cargar()" [loading]="cargando" />
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar..." (buscar)="filtrarTabla(dt, $event)" />
                </div>
                <app-botones-exportar tipo="compras" [estado]="filtroEstado" [tipoCompra]="filtroTipo" [idProveedor]="filtroProveedor" [fechaDesde]="fechaDesde" [fechaHasta]="fechaHasta" />
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : compras"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} compras"
                [globalFilterFields]="['id', 'fecha', 'proveedor.nombre', 'estado', 'tipo_compra']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Tipo</th>
                        <th class="text-right">Total</th>
                        <th class="text-right">Pagado</th>
                        <th class="text-right">Saldo</th>
                        <th>Pago</th>
                        <th>Recepción</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-compra>
                    <tr>
                        <td>{{ compra.id }}</td>
                        <td>{{ formatFecha(compra.fecha) }}</td>
                        <td>{{ compra.proveedor?.nombre || '-' }}</td>
                        <td><p-tag [value]="etiquetaTipo(compra)" [severity]="severidadTipo(compra)" /></td>
                        <td class="text-right">
                            <div>{{ formatBs(compra.total) }}</div>
                            <div class="text-xs text-muted-color" *ngIf="compra.total_usd">{{ formatUsd(compra.total_usd) }}</div>
                        </td>
                        <td class="text-right">{{ formatBs(compra.pagado) }}</td>
                        <td class="text-right">{{ formatBs(compra.saldo_pendiente) }}</td>
                        <td><p-tag [value]="compra.estado" [severity]="severidad(compra.estado)" /></td>
                        <td><p-tag *ngIf="compra.anticipada" [value]="etiquetaRecepcion(compra.estado_recepcion)" severity="info" /><span *ngIf="!compra.anticipada">—</span></td>
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

        <p-drawer [(visible)]="dialogNueva" header="Nueva compra" position="full" styleClass="compra-drawer">
            <div class="compra-drawer-cuerpo">
                <aside class="compra-drawer-catalogo">
                    <div class="compra-drawer-catalogo-cabeza">
                        <div class="flex items-start justify-between gap-2 mb-1">
                            <div class="font-semibold text-lg">Inventario</div>
                            <p-button label="Registrar producto" icon="pi pi-plus" size="small" (onClick)="abrirNuevoProducto()" />
                        </div>
                        <p class="text-muted-color text-sm mt-0 mb-3">Filtre por categoría y pulse un producto para agregarlo al formulario.</p>
                        <div class="mb-3">
                            <p-selectbutton
                                [options]="categoriasFiltro"
                                optionLabel="label"
                                optionValue="value"
                                [(ngModel)]="filtroCategoriaId"
                                [allowEmpty]="false"
                                styleClass="flex flex-wrap"
                            />
                        </div>
                        <div class="mb-3">
                            <input pInputText class="w-full" [(ngModel)]="busquedaProducto" placeholder="Buscar producto..." />
                        </div>
                    </div>
                    <div class="compra-drawer-catalogo-lista">
                        <button
                            type="button"
                            class="compra-producto"
                            *ngFor="let p of productosCatalogo"
                            (click)="agregarDesdeCatalogo(p)"
                            [class.compra-producto-activo]="productoEnFormulario(p)"
                        >
                            <img [src]="fotoProducto(p.path_imagen)" alt="" class="w-12 h-12 rounded-border object-cover shrink-0" />
                            <div class="min-w-0 flex-1 text-left">
                                <div class="font-medium truncate">{{ p.nombre }}</div>
                                <div class="text-xs text-muted-color">{{ p.categoria?.nombre || 'Sin categoría' }} · {{ p.unidad_medida }}</div>
                                <div class="text-xs">Stock {{ p.stock }} · Compra {{ formatBs(p.precio_compra) }}</div>
                            </div>
                            <i class="pi pi-plus text-muted-color"></i>
                        </button>
                        <div *ngIf="!productosCatalogo.length" class="text-center py-8 text-muted-color">
                            <i class="pi pi-box text-3xl mb-2 block"></i>
                            No hay productos en esta categoría.
                        </div>
                    </div>
                </aside>
                <section class="compra-drawer-formulario">
                    <div class="flex flex-col gap-4">
                        <div>
                            <label class="flex items-center gap-1 font-bold mb-2">Tipo de compra <app-ayuda-campo texto="Cambia los campos y validaciones. Lo oculto no se envía." posicion="right" /></label>
                            <p-select [options]="tiposCompra" optionLabel="label" optionValue="value" [(ngModel)]="tipoCompra" (ngModelChange)="onTipoChange()" fluid appendTo="body" [baseZIndex]="2100" />
                        </div>
                        <p class="text-muted-color text-sm m-0">{{ ayudaTipo }}</p>
                        <div class="grid grid-cols-12 gap-3">
                            <div class="col-span-12 md:col-span-6">
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <label class="flex items-center gap-1 font-bold">Proveedor <app-ayuda-campo texto="Titular de la cuenta y de la deuda." posicion="right" /></label>
                                    <p-button label="Nuevo" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="abrirNuevoProveedor()" />
                                </div>
                                <p-select [options]="proveedores" optionLabel="nombre" optionValue="id" [(ngModel)]="idProveedor" placeholder="Seleccione proveedor" [filter]="true" fluid appendTo="body" [baseZIndex]="2100" />
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Ordenante / propietario <app-ayuda-campo texto="Opcional. Escriba el nombre sin crearlo en un listado." posicion="right" /></label>
                                <input pInputText class="w-full" [(ngModel)]="ordenante" maxlength="150" />
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Fecha <app-ayuda-campo texto="Fecha del documento." posicion="left" /></label>
                                <p-datepicker [(ngModel)]="fechaCompra" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" fluid />
                            </div>
                            <div class="col-span-12" *ngIf="esBolsas">
                                <div class="flex items-center gap-2">
                                    <p-checkbox [(ngModel)]="anticipada" [binary]="true" inputId="compraAnticipada" />
                                    <label for="compraAnticipada">Compra anticipada: se puede pagar ahora y el stock entra al recibir la mercadería</label>
                                </div>
                            </div>
                            <div class="col-span-12" *ngIf="!esChala">
                                <label class="flex items-center gap-1 font-bold mb-2">Concepto <app-ayuda-campo texto="Resumen de la compra. Opcional." posicion="top" /></label>
                                <input pInputText class="w-full" [(ngModel)]="conceptoLibre" maxlength="40" placeholder="Ej. bolsas arpillera, flete" />
                            </div>
                        </div>

                        <div class="grid grid-cols-12 gap-3" *ngIf="esChala">
                            <div class="col-span-12 sm:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Boleta de balanza <app-ayuda-campo texto="Nro. de la boleta." posicion="top" /></label>
                                <input pInputText class="w-full" [(ngModel)]="boleta" maxlength="40" />
                            </div>
                            <div class="col-span-12 sm:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Chofer <app-ayuda-campo texto="Quién trajo el camión." posicion="left" /></label>
                                <input pInputText class="w-full" [(ngModel)]="chofer" maxlength="120" />
                            </div>
                            <div class="col-span-12 sm:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Placa <app-ayuda-campo texto="Placa del camión." posicion="top" /></label>
                                <input pInputText class="w-full" [(ngModel)]="placa" maxlength="30" />
                            </div>
                            <div class="col-span-12 sm:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Tipo de cambio USD → Bs <app-ayuda-campo texto="Valor de esta compra. El botón actualiza el tipo de cambio de la empresa." posicion="left" /></label>
                                <div class="tc-input-unido">
                                    <span class="tc-input-unido-addon">Bs</span>
                                    <app-input-numero [(ngModel)]="tipoCambio" prefijo="" [min]="0.0001" [minFractionDigits]="2" [maxFractionDigits]="4" (ngModelChange)="sincronizarLineaChala()" />
                                    <button
                                        type="button"
                                        class="tc-input-unido-btn"
                                        [disabled]="actualizandoTc"
                                        pTooltip="Actualizar tipo de cambio de la empresa"
                                        tooltipPosition="top"
                                        (click)="actualizarTipoCambioEmpresa()"
                                        aria-label="Actualizar tipo de cambio de la empresa"
                                    >
                                        <i class="pi" [ngClass]="actualizandoTc ? 'pi-spinner pi-spin' : 'pi-refresh'"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
                                <label class="flex items-center gap-1 font-bold">Ítems <app-ayuda-campo [texto]="esChala ? 'Pulse arroz en chala a la izquierda. En la línea elija la variedad (ORO, EPAGRI…).' : 'Elija productos a la izquierda o agregue una línea de servicio.'" posicion="right" /></label>
                                <p-button *ngIf="!esChala" label="Agregar línea" icon="pi pi-plus" size="small" [outlined]="true" (onClick)="agregarLinea()" />
                            </div>
                            <p-table [value]="lineas" responsiveLayout="scroll">
                                <ng-template #header>
                                    <tr>
                                        <th>Descripción / Producto</th>
                                        <th *ngIf="esChala">Concepto / variedad</th>
                                        <th>Unidad</th>
                                        <th class="text-right">Cantidad</th>
                                        <th class="text-right">Precio unitario</th>
                                        <th class="text-right">Subtotal</th>
                                        <th *ngIf="!esChala"></th>
                                    </tr>
                                </ng-template>
                                <ng-template #body let-linea let-i="rowIndex">
                                    <tr>
                                        <td>
                                            <ng-container *ngIf="esChala">{{ linea.descripcion || 'Seleccione arroz en chala del inventario' }}</ng-container>
                                            <div class="flex flex-col gap-2" *ngIf="!esChala">
                                                <div class="font-medium" *ngIf="linea.id_producto">{{ linea.descripcion }}</div>
                                                <input *ngIf="!linea.id_producto" pInputText class="w-full" placeholder="Ej. flete, servicio" [(ngModel)]="linea.descripcion" />
                                            </div>
                                        </td>
                                        <td *ngIf="esChala">
                                            <div class="flex flex-col gap-2 min-w-40">
                                                <p-select [options]="variedades" optionLabel="label" optionValue="value" [(ngModel)]="concepto" placeholder="Variedad" fluid appendTo="body" [baseZIndex]="2100" />
                                                <input *ngIf="concepto === 'OTRO'" pInputText class="w-full" [(ngModel)]="conceptoOtro" maxlength="40" placeholder="Otra variedad" />
                                            </div>
                                        </td>
                                        <td>
                                            <span *ngIf="esChala">Fanega</span>
                                            <p-select *ngIf="!esChala" [options]="unidades" optionLabel="label" optionValue="value" [(ngModel)]="linea.unidad" placeholder="Unidad" fluid appendTo="body" [baseZIndex]="2100" />
                                        </td>
                                        <td>
                                            <app-input-numero *ngIf="esChala" tipo="cantidad" [(ngModel)]="fanegas" [min]="0" (ngModelChange)="sincronizarLineaChala()" />
                                            <app-input-numero *ngIf="!esChala" tipo="cantidad" [(ngModel)]="linea.cantidad" [min]="0" />
                                        </td>
                                        <td>
                                            <app-input-numero *ngIf="esChala" [(ngModel)]="precioFanega" prefijo="USD" (ngModelChange)="sincronizarLineaChala()" />
                                            <app-input-numero *ngIf="!esChala" [(ngModel)]="linea.precio_unitario" />
                                        </td>
                                        <td class="text-right font-medium whitespace-nowrap">
                                            <ng-container *ngIf="esChala">{{ formatUsd(subtotalLinea(linea)) }}</ng-container>
                                            <ng-container *ngIf="!esChala">{{ formatBs(subtotalLinea(linea)) }}</ng-container>
                                        </td>
                                        <td *ngIf="!esChala">
                                            <p-button icon="pi pi-trash" severity="danger" [outlined]="true" pTooltip="Quitar línea" tooltipPosition="top" (onClick)="quitarLinea(i)" [disabled]="lineas.length === 1 && !linea.id_producto && !linea.descripcion" />
                                        </td>
                                    </tr>
                                </ng-template>
                            </p-table>
                            <div class="text-right mt-3" *ngIf="esChala">
                                <div class="font-semibold">Total: {{ formatUsd(totalUsdChala()) }}</div>
                                <div class="font-semibold text-lg">Equivalente: {{ formatBs(totalBsChala()) }}</div>
                            </div>
                            <div class="text-right font-semibold mt-3" *ngIf="!esChala">Total: {{ formatBs(totalLineas()) }}</div>
                            <div class="text-right text-muted-color break-words">Se paga ahora: {{ formatBs(pagoAlRegistrar()) }} · Quedará pendiente: {{ formatBs(pendienteEstimado()) }}</div>
                        </div>

                        <div>
                            <label class="flex items-center gap-1 font-bold mb-2">Forma de pago <app-ayuda-campo texto="Contado: el total sale de caja ahora. Crédito: queda por pagar; puedes abonar una parte." posicion="right" /></label>
                            <p-selectbutton [options]="modosPago" optionLabel="label" optionValue="value" [(ngModel)]="modoPago" [allowEmpty]="false" styleClass="flex flex-wrap" />
                        </div>
                        <div class="grid grid-cols-12 gap-3" *ngIf="modoPago === 'CREDITO'">
                            <div class="col-span-12 md:col-span-4">
                                <label class="flex items-center gap-1 font-bold mb-2">Abono ahora (opcional) <app-ayuda-campo texto="Ej.: total Bs 1.640, abono Bs 500. El resto queda pendiente. 0 = todo a crédito." posicion="top" /></label>
                                <app-input-numero [(ngModel)]="pagoInicial" />
                            </div>
                            <div class="col-span-12 md:col-span-4">
                                <label class="flex items-center gap-1 font-bold mb-2">Plazo de pago <app-ayuda-campo texto="Cuándo debe pagarse el saldo. No cambia el precio ni los abonos. Opcional." posicion="top" /></label>
                                <p-select [options]="plazosCredito" optionLabel="label" optionValue="value" [(ngModel)]="plazoDias" fluid appendTo="body" [baseZIndex]="2100" />
                                <small class="block text-muted-color mt-1" *ngIf="diasPlazoEfectivo() > 0">Vence el {{ vencimientoEstimado }} · PLAZO: {{ diasPlazoEfectivo() }} {{ diasPlazoEfectivo() === 1 ? 'día' : 'días' }}</small>
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="plazoDias === -2">
                                <label class="flex items-center gap-1 font-bold mb-2">Días de plazo <app-ayuda-campo texto="Cantidad de días para pagar el saldo. Sale en la boleta como PLAZO: N días." posicion="left" /></label>
                                <app-input-numero tipo="cantidad" [(ngModel)]="plazoDiasPersonal" [min]="1" />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="plazoDias === -1">
                                <label class="flex items-center gap-1 font-bold mb-2">Fecha de vencimiento <app-ayuda-campo texto="Día en que debe cancelarse el saldo al proveedor." posicion="left" /></label>
                                <p-datepicker [(ngModel)]="fechaVencimiento" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [minDate]="hoy" [readonlyInput]="true" fluid />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                                <label class="flex items-center gap-1 font-bold mb-2">Método de pago <app-ayuda-campo texto="QR va al banco. Efectivo al cajón. Mixto permite partir el pago." posicion="top" /></label>
                                <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="pagoInicial" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" />
                            </div>
                            <div class="col-span-12 md:col-span-4" *ngIf="pagoInicial > 0">
                                <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Nro. de transferencia, QR o comprobante." posicion="left" /></label>
                                <input pInputText class="w-full" [(ngModel)]="referencia" />
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-3" *ngIf="modoPago === 'CONTADO'">
                            <div class="col-span-12 md:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Método de pago <app-ayuda-campo texto="QR va al banco. Efectivo al cajón. Mixto: parte QR y parte efectivo." posicion="top" /></label>
                                <app-metodo-pago [(ngModel)]="metodoPago" [montoTotal]="pagoAlRegistrar()" [(montoEfectivo)]="montoEfectivo" [(montoQr)]="montoQr" />
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <label class="flex items-center gap-1 font-bold mb-2">Referencia <app-ayuda-campo texto="Nro. de transferencia, QR o comprobante." posicion="left" /></label>
                                <input pInputText class="w-full" [(ngModel)]="referencia" />
                            </div>
                        </div>
                        <div>
                            <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna de la compra." posicion="top" /></label>
                            <textarea pTextarea class="w-full" rows="2" [(ngModel)]="observacion"></textarea>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 pt-4 mt-auto border-t border-surface">
                        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogNueva = false" />
                        <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
                    </div>
                </section>
            </div>
        </p-drawer>

        <p-dialog header="Registrar producto" [(visible)]="dialogProducto" [modal]="true" [appendTo]="'body'" [baseZIndex]="2000" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div class="campo-form">
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Ej.: Bolsa arpillera 46 kg." posicion="right" /></label>
                    <p-iconfield iconPosition="right">
                        <input pInputText class="w-full" name="nombreProductoCompra" [(ngModel)]="formProducto.nombre" (blur)="tocadoNombreProducto = true" [class.ng-dirty]="mostrarNombreProducto" [class.ng-invalid]="!!errorNombreProducto" [class.ng-valid]="okNombreProducto" />
                        <p-inputicon [styleClass]="okNombreProducto ? 'pi pi-check text-green-500' : errorNombreProducto ? 'pi pi-times text-red-500' : ''" />
                    </p-iconfield>
                    <div class="campo-feedback-error" *ngIf="errorNombreProducto">{{ errorNombreProducto }}</div>
                    <div class="campo-feedback-ok" *ngIf="okNombreProducto">Correcto</div>
                </div>
                <div class="campo-form">
                    <label class="flex items-center gap-1 font-bold mb-2">Categoría <app-ayuda-campo texto="Agrupa el producto en el inventario." posicion="right" /></label>
                    <p-select [options]="categorias" optionLabel="nombre" optionValue="id" [(ngModel)]="formProducto.id_categoria" placeholder="Elegí la categoría" [styleClass]="errorCategoriaProducto ? 'ng-dirty ng-invalid' : okCategoriaProducto ? 'ng-dirty ng-valid' : ''" fluid appendTo="body" [baseZIndex]="2200" (onChange)="tocadoCategoriaProducto = true" />
                    <div class="campo-feedback-error" *ngIf="errorCategoriaProducto">{{ errorCategoriaProducto }}</div>
                    <div class="campo-feedback-ok" *ngIf="okCategoriaProducto">Correcto</div>
                </div>
                <div class="campo-form">
                    <label class="block font-bold mb-1">Unidad de medida</label>
                    <p class="text-xs text-muted-color mt-0 mb-2">Kilo, Fanega, Quintal o Unidad. La cantidad va en otro campo.</p>
                    <p-select [options]="unidades" optionLabel="label" optionValue="value" [(ngModel)]="formProducto.unidad_medida" placeholder="Elegí la unidad" [styleClass]="okUnidadProducto ? 'ng-dirty ng-valid' : errorUnidadProducto ? 'ng-dirty ng-invalid' : ''" fluid appendTo="body" [baseZIndex]="2200" (onChange)="tocadoUnidadProducto = true" />
                    <div class="campo-feedback-error" *ngIf="errorUnidadProducto">{{ errorUnidadProducto }}</div>
                    <div class="campo-feedback-ok" *ngIf="okUnidadProducto">Correcto</div>
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Precio de compra <app-ayuda-campo texto="Costo de referencia. Se puede cambiar en esta compra." posicion="right" /></label>
                    <app-input-numero [(ngModel)]="formProducto.precio_compra" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Stock inicial <app-ayuda-campo texto="Cantidad con la que arranca. La compra posterior suma otra vez." posicion="right" /></label>
                    <app-input-numero tipo="cantidad" [(ngModel)]="formProducto.stock" [min]="0" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogProducto = false" />
                <p-button label="Guardar" [loading]="guardandoProducto" (onClick)="guardarProducto()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Nuevo proveedor" [(visible)]="dialogProveedor" [modal]="true" [appendTo]="'body'" [baseZIndex]="2000" [style]="{ width: '28rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Nombre del proveedor, titular de la cuenta." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="formProveedor.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">NIT / CI <app-ayuda-campo texto="Documento fiscal. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="formProveedor.nit_ci" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Teléfono <app-ayuda-campo texto="Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="formProveedor.telefono" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialogProveedor = false" />
                <p-button label="Guardar" [loading]="guardandoProveedor" (onClick)="guardarProveedor()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Detalle de compra" [(visible)]="dialogDetalle" [modal]="true" [style]="{ width: '44rem' }" [breakpoints]="{ '960px': '95vw' }">
            <ng-container *ngIf="detalle">
                <div class="mb-3">
                    {{ detalle.proveedor?.nombre }}
                    <span *ngIf="detalle.ordenante"> · Ordenante {{ detalle.ordenante }}</span>
                    · {{ formatFecha(detalle.fecha) }}
                </div>
                <p-tag [value]="etiquetaTipo(detalle)" [severity]="severidadTipo(detalle)" styleClass="mb-3" />
                <p-tag [value]="detalle.estado" [severity]="severidad(detalle.estado)" styleClass="mb-3 ml-2" />
                <p-tag [value]="etiquetaRecepcion(detalle.estado_recepcion)" severity="info" styleClass="mb-3 ml-2" *ngIf="detalle.anticipada" />
                <span class="text-muted-color ml-2" *ngIf="detalle.plazo_dias">Plazo {{ detalle.plazo_dias }} {{ detalle.plazo_dias === 1 ? 'día' : 'días' }}</span>
                <span class="text-muted-color ml-2" *ngIf="detalle.fecha_vencimiento"> · Vence {{ formatFechaCorta(detalle.fecha_vencimiento) }}</span>
                <div class="text-sm text-muted-color mb-3" *ngIf="detalle.concepto || detalle.boleta || detalle.chofer || detalle.placa || detalle.fanegas">
                    <span *ngIf="detalle.concepto">{{ detalle.concepto }} · </span>
                    <span *ngIf="detalle.boleta">Boleta {{ detalle.boleta }} · </span>
                    <span *ngIf="detalle.chofer">Chofer {{ detalle.chofer }} · </span>
                    <span *ngIf="detalle.placa">Placa {{ detalle.placa }}</span>
                    <span *ngIf="detalle.fanegas"> · {{ detalle.fanegas }} fanegas</span>
                </div>
                <div class="text-sm text-muted-color mb-3" *ngIf="detalle.tipo_cambio">
                    TC {{ detalle.tipo_cambio }}
                    <span *ngIf="detalle.total_usd"> · {{ formatUsd(detalle.total_usd) }}</span>
                    <span *ngIf="detalle.precio_usd"> · {{ formatUsd(detalle.precio_usd) }}/fanega</span>
                </div>
                <p-table [value]="detalle.detalles || []">
                    <ng-template #header>
                        <tr>
                            <th>Descripción</th>
                            <th>Unidad</th>
                            <th class="text-right">Cant.</th>
                            <th class="text-right" *ngIf="detalle.anticipada">Recibida</th>
                            <th class="text-right" *ngIf="detalle.anticipada && detalle.estado_recepcion !== 'RECIBIDA'">Recibir ahora</th>
                            <th class="text-right">P. unit.</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-linea>
                        <tr>
                            <td>{{ linea.descripcion }}{{ linea.id_producto ? ' · inventario' : '' }}</td>
                            <td>{{ linea.unidad || '-' }}</td>
                            <td class="text-right">{{ linea.cantidad }}</td>
                            <td class="text-right" *ngIf="detalle.anticipada">{{ linea.cantidad_recibida || 0 }}</td>
                            <td class="text-right" *ngIf="detalle.anticipada && detalle.estado_recepcion !== 'RECIBIDA'">
                                <app-input-numero tipo="cantidad" [(ngModel)]="linea.recibir_ahora" [min]="0" />
                            </td>
                            <td class="text-right">{{ formatBs(linea.precio_unitario) }}</td>
                            <td class="text-right">{{ formatBs(linea.subtotal) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
                <div class="mt-3 font-medium text-right">Total {{ formatBs(detalle.total) }} · Saldo {{ formatBs(detalle.saldo_pendiente) }}</div>
                <div class="mt-4" *ngIf="recepciones.length">
                    <div class="font-semibold mb-2">Historial de recepciones</div>
                    <div *ngFor="let rec of recepciones" class="text-sm mb-1">
                        {{ formatFecha(rec.fecha) }} · {{ rec.descripcion }} · {{ rec.cantidad }} · {{ rec.usuario?.nombre || rec.usuario?.username || '-' }}
                    </div>
                </div>
            </ng-container>
            <ng-template #footer>
                <p-button *ngIf="detalle?.anticipada && detalle?.estado_recepcion !== 'RECIBIDA'" label="Registrar recepción" icon="pi pi-box" [loading]="recibiendo" (onClick)="recibir()" />
                <p-button *ngIf="detalle" label="PDF" icon="pi pi-file-pdf" severity="danger" [outlined]="true" pTooltip="Ver PDF" tooltipPosition="top" (onClick)="exportarCompra(detalle, 'pdf')" />
            </ng-template>
        </p-dialog>
    `,
    styles: [`
        :host ::ng-deep .compra-drawer.p-drawer {
            width: 100vw;
        }
        :host ::ng-deep .compra-drawer .p-drawer-content {
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .compra-drawer-cuerpo {
            display: flex;
            flex-direction: column;
            min-height: calc(100vh - 4.5rem);
        }
        .compra-drawer-catalogo,
        .compra-drawer-formulario {
            padding: 1rem 1.25rem;
            overflow: auto;
        }
        .compra-drawer-catalogo {
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
        }
        .compra-drawer-catalogo-cabeza {
            flex-shrink: 0;
        }
        .compra-drawer-catalogo-lista {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
        }
        .compra-drawer-formulario {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        @media (min-width: 960px) {
            .compra-drawer-cuerpo {
                flex-direction: row;
                height: calc(100vh - 4.5rem);
                min-height: 0;
            }
            .compra-drawer-catalogo {
                width: 38%;
                height: 100%;
                border-bottom: 0;
                border-right: 1px solid var(--p-content-border-color, #e5e7eb);
            }
            .compra-drawer-formulario {
                width: 62%;
                height: 100%;
            }
        }
        .compra-producto {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            width: 100%;
            padding: 0.7rem 0.8rem;
            border: 1px solid var(--p-content-border-color, #e5e7eb);
            border-radius: 10px;
            background: var(--p-content-background, #fff);
            cursor: pointer;
        }
        .compra-producto:hover,
        .compra-producto-activo {
            border-color: var(--p-primary-color, #b91c1c);
            background: color-mix(in srgb, var(--p-primary-color, #b91c1c) 6%, transparent);
        }
        .tc-input-unido {
            display: flex;
            align-items: stretch;
            width: 100%;
            min-height: 2.5rem;
            border: 1px solid var(--p-inputtext-border-color, var(--p-content-border-color, #d1d5db));
            border-radius: 6px;
            overflow: hidden;
            background: var(--p-inputtext-background, #fff);
        }
        .tc-input-unido-addon {
            display: flex;
            align-items: center;
            padding: 0 0.75rem;
            border-right: 1px solid var(--p-content-border-color, #e5e7eb);
            background: var(--p-inputgroup-addon-background, #f3f4f6);
            color: var(--p-text-muted-color, #6b7280);
            font-weight: 600;
            flex-shrink: 0;
        }
        :host ::ng-deep .tc-input-unido app-input-numero {
            display: flex !important;
            flex: 1 1 auto !important;
            width: auto !important;
            min-width: 0;
        }
        :host ::ng-deep .tc-input-unido .input-numero {
            width: 100%;
            gap: 0;
        }
        .tc-input-unido-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            min-width: 2.75rem;
            margin: 0;
            padding: 0;
            border: none;
            border-left: 1px solid var(--p-content-border-color, #e5e7eb);
            border-radius: 0;
            background: transparent;
            color: var(--p-primary-color, #b91c1c);
            cursor: pointer;
        }
        .tc-input-unido-btn:disabled {
            opacity: 0.65;
            cursor: wait;
        }
        .tc-input-unido-btn:not(:disabled):hover {
            background: color-mix(in srgb, var(--p-primary-color, #b91c1c) 8%, transparent);
        }
    `]
})
export class ComprasPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    compras: Compra[] = [];
    proveedores: Proveedor[] = [];
    productos: ProductoLista[] = [];
    categorias: CategoriaProducto[] = [];
    filtroCategoriaId: number | null = null;
    busquedaProducto = '';
    cargando = false;
    guardando = false;
    dialogNueva = false;
    dialogCajaCerrada = false;
    dialogDetalle = false;
    dialogProducto = false;
    dialogProveedor = false;
    guardandoProducto = false;
    guardandoProveedor = false;
    formProducto = this.productoVacio();
    unidades = UNIDADES_MEDIDA;
    enviadoProducto = false;
    tocadoNombreProducto = false;
    tocadoCategoriaProducto = false;
    tocadoUnidadProducto = false;
    formProveedor = this.proveedorVacio();
    filtroEstado: string[] = [];
    filtroTipo: string[] = [];
    filtroProveedor: number[] = [];
    rango: Date[] | null = null;
    tiposFiltro = [
        { label: 'Arroz en chala', value: 'CHALA' },
        { label: 'Bolsas y empaques', value: 'BOLSAS' },
        { label: 'Otros / servicios', value: 'OTROS' }
    ];
    estados = [
        { label: 'Pendiente', value: 'PENDIENTE' },
        { label: 'Parcial', value: 'PARCIAL' },
        { label: 'Pagada', value: 'PAGADA' }
    ];
    tiposCompra = [
        { label: 'Arroz en chala', value: 'CHALA' },
        { label: 'Bolsas y empaques', value: 'BOLSAS' },
        { label: 'Otros / servicios', value: 'OTROS' }
    ];
    variedades = [
        { label: 'ORO', value: 'ORO' },
        { label: 'ORO / CALIDAD', value: 'ORO / CALIDAD' },
        { label: 'EPAGRI', value: 'EPAGRI' },
        { label: 'MAX-18', value: 'MAX-18' },
        { label: 'MAC-18', value: 'MAC-18' },
        { label: 'KHAJA', value: 'KHAJA' },
        { label: 'Otro', value: 'OTRO' }
    ];
    plazosCredito = [
        { label: 'Sin plazo', value: 0 },
        { label: '7 días', value: 7 },
        { label: '15 días', value: 15 },
        { label: '30 días', value: 30 },
        { label: 'Otros días', value: -2 },
        { label: 'Fecha exacta', value: -1 }
    ];
    modosPago = [
        { label: 'Contado', value: 'CONTADO' },
        { label: 'Crédito', value: 'CREDITO' }
    ];
    modoPago = 'CONTADO';
    plazoDias = 0;
    plazoDiasPersonal = 7;
    fechaVencimiento: Date | null = null;
    hoy = new Date();
    tipoCompra: TipoCompra = 'CHALA';
    idProveedor: number | null = null;
    ordenante = '';
    anticipada = false;
    recepciones: { fecha: string; descripcion: string; cantidad: number; usuario?: { nombre?: string; username?: string } }[] = [];
    recibiendo = false;
    idProductoChala: number | null = null;
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
    tipoCambio = 9.96;
    actualizandoTc = false;
    concepto = 'ORO';
    conceptoOtro = '';
    conceptoLibre = '';
    fechaCompra: Date = new Date();
    detalle: Compra | null = null;
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;
    formatUsd = formatUsd;
    formatFecha = formatFecha;
    formatFechaCorta = formatFechaCorta;

    private queryPendienteProducto: number | null = null;

    constructor(
        private comprasService: ComprasService,
        private proveedoresService: ProveedoresService,
        private productosService: ProductosService,
        private exportarService: ExportarService,
        private empresaService: EmpresaService,
        private aviso: AvisoService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    get esChala(): boolean {
        return this.tipoCompra === 'CHALA';
    }

    get esBolsas(): boolean {
        return this.tipoCompra === 'BOLSAS';
    }

    get ayudaTipo(): string {
        if (this.esChala) {
            return 'Elija el arroz en chala del inventario. La variedad se indica en el ítem. Total USD = fanegas × precio. Total Bs = USD × tipo de cambio. El pago (contado o abono) se registra en Bs.';
        }
        if (this.esBolsas) {
            return 'Las bolsas entran al inventario al guardar esta compra. Las salidas se registran en Bolsas y empaques; no se venden.';
        }
        return 'Insumos o un servicio fiado. Las bolsas van en tipo Bolsas y empaques. Luz o combustible van a Gastos.';
    }

    get categoriasFiltro(): { label: string; value: number | null }[] {
        const lista = this.categorias.filter((c) => {
            const nombre = (c.nombre || '').toLowerCase();
            const esEmpaque = nombre.includes('empaque') || nombre.includes('bolsa');
            if (this.esBolsas) {
                return esEmpaque;
            }
            if (this.esChala) {
                return nombre.includes('chala');
            }
            return !esEmpaque;
        });
        const extra = this.esBolsas || this.esChala ? [] : [{ label: 'Todas', value: null }];
        return [...extra, ...lista.map((c) => ({ label: c.nombre, value: c.id }))];
    }

    get productosCatalogo(): ProductoLista[] {
        const q = this.busquedaProducto.trim().toLowerCase();
        return this.productos.filter((p) => {
            if (this.esBolsas && !this.esProductoBolsa(p)) {
                return false;
            }
            if (this.esChala && !this.esProductoChala(p)) {
                return false;
            }
            if (!this.esBolsas && !this.esChala && this.esProductoBolsa(p)) {
                return false;
            }
            if (p.disponible_en === 'VENTAS') {
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
        this.cargarCategorias();
        this.proveedoresService.listar().subscribe({ next: (data) => (this.proveedores = data) });
        this.empresaService.cargar().subscribe();
        this.route.queryParamMap.subscribe((params) => this.aplicarQueryNueva(params));
    }

    get fechaDesde(): string | undefined {
        return ymdDesdeRango(this.rango);
    }

    get fechaHasta(): string | undefined {
        return ymdHastaRango(this.rango);
    }

    cargar(): void {
        this.cargando = true;
        this.comprasService.listar({
            estado: this.filtroEstado.length ? this.filtroEstado : undefined,
            tipo_compra: this.filtroTipo.length ? this.filtroTipo : undefined,
            id_proveedor: this.filtroProveedor.length ? this.filtroProveedor : undefined,
            fecha_desde: this.fechaDesde,
            fecha_hasta: this.fechaHasta
        }).subscribe({
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
        this.resetFormulario();
        this.aplicarFiltroCategoriaTipo();
        this.dialogNueva = true;
    }

    onTipoChange(): void {
        const proveedor = this.idProveedor;
        const fecha = this.fechaCompra;
        this.resetCamposTipo();
        this.idProveedor = proveedor;
        this.fechaCompra = fecha;
        this.aplicarFiltroCategoriaTipo();
        if (this.esChala) {
            this.sincronizarLineaChala();
        }
    }

    agregarDesdeCatalogo(producto: ProductoLista): void {
        if (this.esBolsas && !this.esProductoBolsa(producto)) {
            this.aviso.aviso('Bolsas y empaques', 'Solo se compran tipos de bolsa. Cambie el tipo de compra para otro ítem.');
            return;
        }
        if (!this.esBolsas && this.esProductoBolsa(producto)) {
            this.aviso.aviso('Bolsas y empaques', 'Cambie el tipo de compra a Bolsas y empaques para registrar esa entrada.');
            return;
        }
        if (this.esChala) {
            if (!this.esProductoChala(producto)) {
                this.aviso.aviso('Compra de chala', 'Seleccione un arroz en chala del inventario. Cambie el tipo para agregar otro ítem.');
                return;
            }
            this.idProductoChala = producto.id;
            this.sincronizarLineaChala();
            return;
        }
        const existente = this.lineas.find((l) => l.id_producto === producto.id);
        if (existente) {
            existente.cantidad = Number(existente.cantidad || 0) + 1;
            return;
        }
        const vacia = this.lineas.find((l) => !l.id_producto && !l.descripcion?.trim() && Number(l.precio_unitario || 0) === 0);
        const linea = vacia || this.lineaVacia();
        linea.id_producto = producto.id;
        linea.descripcion = producto.nombre;
        linea.unidad = producto.unidad_medida || (this.esBolsas ? 'Unidad' : '');
        linea.cantidad = Number(linea.cantidad || 0) > 0 ? Number(linea.cantidad) : 1;
        linea.precio_unitario = Number(producto.precio_compra || 0);
        linea.subtotal = roundMoney(linea.cantidad * linea.precio_unitario);
        if (!vacia) {
            this.lineas.push(linea);
        }
    }

    productoEnFormulario(producto: ProductoLista): boolean {
        if (this.esChala) {
            return this.idProductoChala === producto.id;
        }
        return this.lineas.some((l) => l.id_producto === producto.id);
    }

    fotoProducto(path?: string | null): string {
        return mediaUrl(path, 'producto');
    }

    get mostrarNombreProducto(): boolean {
        return this.enviadoProducto || this.tocadoNombreProducto;
    }

    get mostrarCategoriaProducto(): boolean {
        return this.enviadoProducto || this.tocadoCategoriaProducto;
    }

    get mostrarUnidadProducto(): boolean {
        return this.enviadoProducto || this.tocadoUnidadProducto;
    }

    get errorNombreProducto(): string | null {
        if (!this.mostrarNombreProducto) {
            return null;
        }
        return this.formProducto.nombre?.trim() ? null : 'El nombre es obligatorio.';
    }

    get okNombreProducto(): boolean {
        return this.mostrarNombreProducto && !this.errorNombreProducto;
    }

    get errorCategoriaProducto(): string | null {
        if (!this.mostrarCategoriaProducto) {
            return null;
        }
        return this.formProducto.id_categoria ? null : 'Elegí una categoría.';
    }

    get okCategoriaProducto(): boolean {
        return this.mostrarCategoriaProducto && !this.errorCategoriaProducto;
    }

    get errorUnidadProducto(): string | null {
        if (!this.mostrarUnidadProducto) {
            return null;
        }
        return esUnidadMedidaValida(this.formProducto.unidad_medida) ? null : MENSAJE_UNIDAD_MEDIDA;
    }

    get okUnidadProducto(): boolean {
        return this.mostrarUnidadProducto && !this.errorUnidadProducto;
    }

    abrirNuevoProducto(): void {
        this.formProducto = this.productoVacio();
        this.enviadoProducto = false;
        this.tocadoNombreProducto = false;
        this.tocadoCategoriaProducto = false;
        this.tocadoUnidadProducto = false;
        if (this.filtroCategoriaId) {
            this.formProducto.id_categoria = this.filtroCategoriaId;
        }
        if (this.esBolsas) {
            this.formProducto.unidad_medida = 'Unidad';
        }
        if (this.esChala) {
            this.formProducto.unidad_medida = 'Fanega';
        }
        this.dialogProducto = true;
    }

    guardarProducto(): void {
        this.enviadoProducto = true;
        if (this.errorNombreProducto || this.errorCategoriaProducto || this.errorUnidadProducto) {
            return;
        }
        this.guardandoProducto = true;
        this.productosService.crear({
            nombre: this.formProducto.nombre.trim(),
            precio_venta: 0,
            precio_compra: Number(this.formProducto.precio_compra || 0),
            stock: Number(this.formProducto.stock || 0),
            unidad_medida: this.formProducto.unidad_medida || 'Unidad',
            path_imagen: imagenDefault('producto'),
            id_categoria: this.formProducto.id_categoria || undefined
        }).subscribe({
            next: (res) => {
                this.guardandoProducto = false;
                this.dialogProducto = false;
                this.aviso.ok('Producto', res.mensaje);
                this.cargarProductos();
                if (res.data) {
                    if (res.data.categoria?.id) {
                        this.filtroCategoriaId = res.data.categoria.id;
                    }
                    this.agregarDesdeCatalogo(res.data);
                }
            },
            error: (err) => {
                this.guardandoProducto = false;
                this.aviso.error(err, 'No se pudo registrar el producto');
            }
        });
    }

    abrirNuevoProveedor(): void {
        this.formProveedor = this.proveedorVacio();
        this.dialogProveedor = true;
    }

    guardarProveedor(): void {
        if (!this.formProveedor.nombre.trim()) {
            this.aviso.aviso('Validación', 'El nombre es obligatorio');
            return;
        }
        this.guardandoProveedor = true;
        const payload = {
            nombre: this.formProveedor.nombre.trim(),
            nit_ci: this.formProveedor.nit_ci || '',
            telefono: this.formProveedor.telefono || '',
            direccion: '',
            observacion: '',
            activo: true,
            path_imagen: imagenDefault('proveedor')
        };
        this.proveedoresService.crear(payload).subscribe({
            next: (res) => {
                this.guardandoProveedor = false;
                this.dialogProveedor = false;
                this.aviso.ok('Proveedor', res.mensaje);
                const creado = res.data;
                this.proveedoresService.listar().subscribe({
                    next: (data) => {
                        this.proveedores = data;
                        if (creado?.id) {
                            this.idProveedor = creado.id;
                        }
                    }
                });
            },
            error: (err) => {
                this.guardandoProveedor = false;
                this.aviso.error(err, 'No se pudo registrar el proveedor');
            }
        });
    }

    agregarLinea(): void {
        this.lineas.push(this.lineaVacia());
    }

    quitarLinea(i: number): void {
        this.lineas.splice(i, 1);
    }

    subtotalLinea(linea: LineaCompra): number {
        if (this.esChala) {
            return roundMoney(Number(this.fanegas || 0) * Number(this.precioFanega || 0));
        }
        return roundMoney(Number(linea.cantidad || 0) * Number(linea.precio_unitario || 0));
    }

    totalLineas(): number {
        return roundMoney(this.lineas.reduce((acc, l) => acc + this.subtotalLinea(l), 0));
    }

    totalUsdChala(): number {
        return roundMoney(Number(this.fanegas || 0) * Number(this.precioFanega || 0));
    }

    totalBsChala(): number {
        return roundMoney(this.totalUsdChala() * Number(this.tipoCambio || 0));
    }

    totalAPagar(): number {
        return this.esChala ? this.totalBsChala() : this.totalLineas();
    }

    pagoAlRegistrar(): number {
        if (this.modoPago === 'CONTADO') {
            return this.totalAPagar();
        }
        const abono = Number(this.pagoInicial || 0);
        const total = this.totalAPagar();
        return abono > total ? total : abono;
    }

    pendienteEstimado(): number {
        const pendiente = this.totalAPagar() - this.pagoAlRegistrar();
        return pendiente > 0 ? pendiente : 0;
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
        if (this.modoPago !== 'CREDITO' || this.pendienteEstimado() <= 0) {
            return {};
        }
        if (this.plazoDias === -1 && this.fechaVencimiento) {
            return { fecha_vencimiento: this.fechaYmd(this.fechaVencimiento) };
        }
        const dias = this.diasPlazoEfectivo();
        if (dias > 0) {
            return { plazo_dias: dias };
        }
        return {};
    }

    private extrasPago(): Partial<CrearCompraPayload> {
        const cobro = this.pagoAlRegistrar();
        return {
            pago_inicial: cobro,
            metodo_pago: cobro > 0 ? this.metodoPago : undefined,
            referencia: cobro > 0 ? this.referencia || undefined : undefined,
            observacion: this.observacion || undefined,
            ...(cobro > 0 ? extrasPagoMixto(this.metodoPago, this.montoEfectivo, this.montoQr) : {}),
            ...this.plazoPayload()
        };
    }

    private validarPago(): boolean {
        if (this.modoPago === 'CREDITO' && this.plazoDias === -2 && this.diasPlazoEfectivo() < 1) {
            this.aviso.aviso('Validación', 'Indique los días de plazo');
            return false;
        }
        if (this.modoPago === 'CREDITO' && this.plazoDias === -1 && !this.fechaVencimiento) {
            this.aviso.aviso('Validación', 'Indique la fecha de vencimiento o elija un plazo en días');
            return false;
        }
        const cobro = this.pagoAlRegistrar();
        const mixto = mensajePagoMixto(this.metodoPago, cobro, this.montoEfectivo, this.montoQr);
        if (cobro > 0 && mixto) {
            this.aviso.aviso('Validación', mixto);
            return false;
        }
        return true;
    }

    sincronizarLineaChala(): void {
        const linea = this.lineas[0] || this.lineaVacia();
        const producto = this.productos.find((p) => p.id === this.idProductoChala);
        linea.descripcion = producto?.nombre || '';
        linea.unidad = producto?.unidad_medida || 'Fanega';
        linea.cantidad = Number(this.fanegas || 0);
        linea.precio_unitario = Number(this.precioFanega || 0);
        linea.subtotal = this.totalUsdChala();
        linea.id_producto = this.idProductoChala;
        this.lineas = [linea];
    }

    actualizarTipoCambioEmpresa(): void {
        if (!(Number(this.tipoCambio) > 0)) {
            this.aviso.aviso('Validación', 'El tipo de cambio debe ser mayor a 0');
            return;
        }
        this.actualizandoTc = true;
        this.empresaService.guardar({
            ...this.empresaService.actual(),
            tipo_cambio: Number(this.tipoCambio)
        }).subscribe({
            next: () => {
                this.actualizandoTc = false;
                this.aviso.ok('Tipo de cambio', 'Se actualizó el tipo de cambio de la empresa.');
            },
            error: (err) => {
                this.actualizandoTc = false;
                this.aviso.error(err, 'No se pudo actualizar el tipo de cambio de la empresa');
            }
        });
    }

    guardar(): void {
        if (!this.idProveedor) {
            this.aviso.aviso('Validación', 'Seleccione un proveedor');
            return;
        }
        if (this.esChala) {
            this.guardarChala();
            return;
        }
        this.guardarOtra();
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
                this.recepciones = [];
                this.dialogDetalle = true;
                if (data.anticipada) {
                    this.comprasService.recepciones(data.id).subscribe({
                        next: (recs) => (this.recepciones = recs),
                        error: () => (this.recepciones = [])
                    });
                }
            },
            error: (err) => this.aviso.error(err, 'No se pudo cargar el detalle')
        });
    }

    etiquetaRecepcion(estado?: string | null): string {
        if (estado === 'PARCIAL') {
            return 'Recepción parcial';
        }
        if (estado === 'RECIBIDA') {
            return 'Recibida';
        }
        return 'Pendiente de recepción';
    }

    recibir(): void {
        if (!this.detalle) {
            return;
        }
        const lineas = (this.detalle.detalles || [])
            .filter((linea) => Number(linea.recibir_ahora) > 0)
            .map((linea) => ({ id_detalle: linea.id, cantidad: Number(linea.recibir_ahora) }));
        if (!lineas.length) {
            this.aviso.aviso('Validación', 'Indique cuánto se recibió');
            return;
        }
        this.recibiendo = true;
        this.comprasService.recibir(this.detalle.id, lineas).subscribe({
            next: (res) => {
                this.recibiendo = false;
                this.detalle = res.data;
                this.aviso.ok('Recepción', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.recibiendo = false;
                this.aviso.error(err, 'No se pudo registrar la recepción');
            }
        });
    }

    severidad(estado: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (estado === 'PAGADA') return 'success';
        if (estado === 'PARCIAL') return 'warn';
        if (estado === 'PENDIENTE') return 'info';
        return 'secondary';
    }

    etiquetaTipo(compra: Compra): string {
        const tipo = String(compra.tipo_compra || '').toUpperCase();
        if (tipo === 'CHALA') return 'Arroz en chala';
        if (tipo === 'BOLSAS') return 'Bolsas y empaques';
        if (tipo === 'OTROS') return compra.es_servicio ? 'Otros / servicios' : 'Otros / servicios';
        if (compra.es_servicio) return 'Otros / servicios';
        if (compra.fanegas || compra.boleta) return 'Arroz en chala';
        return 'Compra';
    }

    severidadTipo(compra: Compra): 'success' | 'warn' | 'info' | 'secondary' {
        const tipo = String(compra.tipo_compra || '').toUpperCase();
        if (tipo === 'CHALA' || compra.fanegas || compra.boleta) return 'warn';
        if (tipo === 'BOLSAS') return 'info';
        return 'secondary';
    }

    onProductoCompra(linea: LineaCompra): void {
        const producto = this.productos.find((p) => p.id === linea.id_producto);
        if (producto) {
            linea.descripcion = producto.nombre;
            linea.unidad = producto.unidad_medida || (this.esBolsas ? 'Unidad' : '');
            linea.precio_unitario = Number(producto.precio_compra || 0);
        } else {
            linea.descripcion = '';
            linea.unidad = this.esBolsas ? 'Unidad' : '';
        }
    }

    private guardarChala(): void {
        const producto = this.productos.find((p) => p.id === this.idProductoChala);
        if (!producto || !this.esProductoChala(producto)) {
            this.aviso.aviso('Validación', 'Seleccione un arroz en chala del inventario de la izquierda.');
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
            this.aviso.aviso('Validación', 'Indique el precio por fanega en USD');
            return;
        }
        if (!(Number(this.tipoCambio) > 0)) {
            this.aviso.aviso('Validación', 'El tipo de cambio debe ser mayor a 0');
            return;
        }
        if (!this.validarPago()) {
            return;
        }
        this.enviar({
            id_proveedor: this.idProveedor!,
            ordenante: this.ordenante.trim() || undefined,
            fecha: this.fechaYmd(this.fechaCompra),
            tipo_compra: 'CHALA',
            concepto,
            boleta: this.boleta.trim(),
            chofer: this.chofer.trim() || undefined,
            placa: this.placa.trim() || undefined,
            fanegas: Number(this.fanegas),
            precio_usd: Number(this.precioFanega),
            tipo_cambio: Number(this.tipoCambio),
            lineas: [{
                descripcion: producto.nombre,
                cantidad: Number(this.fanegas),
                precio_unitario: Number(this.precioFanega),
                id_producto: producto.id,
                unidad: producto.unidad_medida || 'Fanega'
            }],
            ...this.extrasPago()
        }, this.pagoAlRegistrar() > 0
            ? 'Compra de chala registrada. El pago en Bs sale de caja.'
            : 'Compra de chala registrada a crédito. El saldo se paga en Pagos a proveedores.');
    }

    private guardarOtra(): void {
        const lineas = this.lineas.filter((l) => Number(l.cantidad) > 0 && (l.id_producto || l.descripcion?.trim()));
        if (!lineas.length) {
            this.aviso.aviso('Validación', 'Agregue al menos un producto o una descripción');
            return;
        }
        if (this.esBolsas && lineas.some((l) => !l.id_producto)) {
            this.aviso.aviso('Validación', 'En bolsas y empaques cada línea debe tener un producto');
            return;
        }
        if (lineas.some((l) => l.unidad?.trim() && !esUnidadMedidaValida(l.unidad))) {
            this.aviso.aviso('Validación', MENSAJE_UNIDAD_MEDIDA);
            return;
        }
        if (!this.validarPago()) {
            return;
        }
        this.enviar({
            id_proveedor: this.idProveedor!,
            ordenante: this.ordenante.trim() || undefined,
            anticipada: this.esBolsas ? this.anticipada : undefined,
            fecha: this.fechaYmd(this.fechaCompra),
            tipo_compra: this.tipoCompra,
            concepto: this.conceptoLibre.trim() || undefined,
            lineas: lineas.map((l) => ({
                descripcion: (l.descripcion || '').trim() || this.nombreProducto(l.id_producto),
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario),
                id_producto: l.id_producto || undefined,
                unidad: (l.unidad || '').trim() || undefined
            })),
            ...this.extrasPago()
        }, 'Compra registrada. Se abre la nota de compra.');
    }

    private enviar(payload: CrearCompraPayload, mensajeOk: string): void {
        this.guardando = true;
        const visor = this.exportarService.abrirVentanaEspera('Generando nota de compra...');
        this.comprasService.crear(payload).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogNueva = false;
                this.aviso.ok('Compra', mensajeOk);
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

    private resetFormulario(): void {
        this.tipoCompra = 'CHALA';
        this.idProveedor = null;
        this.ordenante = '';
        this.anticipada = false;
        this.fechaCompra = new Date();
        this.resetCamposTipo();
        this.sincronizarLineaChala();
    }

    private resetCamposTipo(): void {
        this.lineas = [this.lineaVacia()];
        this.pagoInicial = 0;
        this.modoPago = 'CONTADO';
        this.plazoDias = 0;
        this.plazoDiasPersonal = 7;
        this.fechaVencimiento = null;
        this.hoy = new Date();
        this.metodoPago = 'EFECTIVO';
        this.montoEfectivo = 0;
        this.montoQr = 0;
        this.referencia = '';
        this.observacion = '';
        this.boleta = '';
        this.chofer = '';
        this.placa = '';
        this.fanegas = 0;
        this.precioFanega = 0;
        this.tipoCambio = Number(this.empresaService.actual().tipo_cambio) > 0
            ? Number(this.empresaService.actual().tipo_cambio)
            : 9.96;
        this.actualizandoTc = false;
        this.concepto = 'ORO';
        this.conceptoOtro = '';
        this.conceptoLibre = '';
        this.idProductoChala = null;
    }

    private cargarProductos(): void {
        this.productosService.listar().subscribe({
            next: (data) => {
                this.productos = data;
                if (this.esChala && this.dialogNueva) {
                    this.sincronizarLineaChala();
                }
                this.intentarAgregarProductoQuery();
            }
        });
    }

    private cargarCategorias(): void {
        this.productosService.categorias().subscribe({
            next: (data) => {
                this.categorias = data;
                if (this.dialogNueva) {
                    this.aplicarFiltroCategoriaTipo();
                }
            }
        });
    }

    private aplicarQueryNueva(params: ParamMap): void {
        const nueva = params.get('nueva') === '1' || params.get('nueva') === 'true';
        const tipo = params.get('tipo');
        const productoId = Number(params.get('producto'));
        if (!nueva && !tipo && !productoId) {
            return;
        }
        this.abrirNueva();
        if (tipo === 'BOLSAS' || tipo === 'CHALA' || tipo === 'OTROS') {
            this.tipoCompra = tipo;
            this.onTipoChange();
        }
        if (productoId) {
            this.queryPendienteProducto = productoId;
            this.intentarAgregarProductoQuery();
        }
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    private intentarAgregarProductoQuery(): void {
        if (!this.queryPendienteProducto) {
            return;
        }
        if (!this.productos.length) {
            return;
        }
        const producto = this.productos.find((p) => p.id === this.queryPendienteProducto);
        if (!producto) {
            this.aviso.aviso('Compra', 'No se encontró ese tipo de bolsa en el inventario');
            this.queryPendienteProducto = null;
            return;
        }
        this.agregarDesdeCatalogo(producto);
        this.queryPendienteProducto = null;
    }

    private aplicarFiltroCategoriaTipo(): void {
        this.busquedaProducto = '';
        const nombre = this.esChala ? 'chala' : this.esBolsas ? 'empaque' : '';
        const categoria = nombre
            ? this.categorias.find((c) => (c.nombre || '').toLowerCase().includes(nombre))
            : null;
        this.filtroCategoriaId = categoria?.id ?? null;
    }

    private esProductoChala(p: ProductoLista): boolean {
        const nombre = (p.nombre || '').toLowerCase();
        const categoria = (p.categoria?.nombre || '').toLowerCase();
        if (nombre.includes('pilado')) {
            return false;
        }
        return nombre.includes('chala') || categoria.includes('chala');
    }

    private esProductoBolsa(p: ProductoLista): boolean {
        return esProductoEmpaque(p);
    }

    conceptoValor(): string {
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
        return { descripcion: '', id_producto: null, unidad: this.esBolsas ? 'Unidad' : '', cantidad: 1, precio_unitario: 0, subtotal: 0 };
    }

    private productoVacio(): { nombre: string; id_categoria: number | null; unidad_medida: string; precio_compra: number; stock: number } {
        return { nombre: '', id_categoria: null, unidad_medida: 'Unidad', precio_compra: 0, stock: 0 };
    }

    private proveedorVacio(): { nombre: string; nit_ci: string; telefono: string } {
        return { nombre: '', nit_ci: '', telefono: '' };
    }
}
