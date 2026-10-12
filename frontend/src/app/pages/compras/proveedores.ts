import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisoService } from '../../shared/services/aviso.service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Proveedor, CuentaProveedor } from './compras.models';
import { ProveedoresService } from './compras.service';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { imagenDefault, mediaUrl } from '../../core/utils/media-url';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { formatBs, formatFecha } from '../caja/caja.utils';
import { formatUsd } from '../../shared/utils/money';
import { BotonesExportarComponent } from '../../shared/components/botones-exportar';

@Component({
    selector: 'app-proveedores',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        DatePickerModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToggleSwitchModule,
        ImagenCampoComponent,
        TablaEsqueletoComponent,
        AyudaCampoComponent,
        TooltipModule,
        MenuModule,
        TablaBusquedaComponent,
        BotonesExportarComponent
    ],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Proveedores</div>
                <div class="text-muted-color">Quienes venden arroz en chala, insumos y servicios</div>
            </div>
            <p-button label="Nuevo proveedor" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <div class="flex flex-wrap items-end gap-3 mb-4">
                <div class="w-full lg:w-[18rem] min-w-0 lg:ml-auto">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar por nombre o NIT/CI" (buscar)="filtrarTabla(dt, $event)" />
                </div>
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : proveedores"
                [loading]="cargando"
                [showLoader]="false"
                [paginator]="true"
                [alwaysShowPaginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} proveedores"
                [globalFilterFields]="['nombre', 'nit_ci', 'telefono', 'direccion']"
                [rowHover]="true"
                sortMode="single"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th></th>
                        <th>Nombre</th>
                        <th>NIT / CI</th>
                        <th>Teléfono</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td><img [src]="foto(item.path_imagen)" alt="" class="w-10 h-10 rounded-border object-cover" /></td>
                        <td>{{ item.nombre }}</td>
                        <td>{{ item.nit_ci || '-' }}</td>
                        <td>{{ item.telefono || '-' }}</td>
                        <td>{{ item.direccion || '-' }}</td>
                        <td><p-tag [value]="item.activo ? 'Activo' : 'Inactivo'" [severity]="item.activo ? 'success' : 'secondary'" /></td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del proveedor"
                                (onClick)="abrirAcciones($event, menuAcciones, item)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="7" [fila]="f" [conAvatar]="true"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="7">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-truck text-4xl mb-3 block"></i>
                                No hay proveedores registrados.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar proveedor' : 'Nuevo proveedor'" [(visible)]="dialog" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Imagen <app-ayuda-campo texto="Logo o foto del proveedor. Opcional." posicion="right" /></label>
                    <app-imagen-campo tipo="proveedor" [path]="form.path_imagen" (pathChange)="form.path_imagen = $event" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Nombre <app-ayuda-campo texto="Nombre comercial. Ej.: Cooperativa Norte." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nombre" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">NIT / CI <app-ayuda-campo texto="Documento fiscal. Puede dejarse vacío." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.nit_ci" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Teléfono <app-ayuda-campo texto="Para coordinar acopio o pagos. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.telefono" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Dirección <app-ayuda-campo texto="Dónde recoger o entregar. Opcional." posicion="right" /></label>
                    <input pInputText class="w-full" [(ngModel)]="form.direccion" />
                </div>
                <div>
                    <label class="flex items-center gap-1 font-bold mb-2">Observación <app-ayuda-campo texto="Nota interna: condiciones, zona, etc." posicion="top" /></label>
                    <textarea pTextarea class="w-full" rows="2" [(ngModel)]="form.observacion"></textarea>
                </div>
                <div class="flex items-center gap-2" *ngIf="form.id">
                    <p-toggleswitch [(ngModel)]="form.activo" />
                    <span>Activo</span>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Estado de cuenta de {{ cuenta?.proveedor?.nombre || proveedorCuenta?.nombre }}" [(visible)]="dialogCuenta" [modal]="true" [style]="{ width: '80rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="grid grid-cols-12 gap-3 mb-4">
                <div class="col-span-12 md:col-span-4">
                    <label class="block font-bold mb-2 text-sm">Período</label>
                    <p-datepicker [(ngModel)]="filtroPeriodo" selectionMode="range" dateFormat="dd/mm/yy" [showIcon]="true" iconDisplay="input" [readonlyInput]="true" placeholder="Todas las fechas" fluid />
                </div>
                <div class="col-span-12 md:col-span-3">
                    <label class="block font-bold mb-2 text-sm">Productor</label>
                    <p-select [options]="opcionesProductor" optionLabel="label" optionValue="value" [(ngModel)]="filtroProductorId" placeholder="Todos" [showClear]="true" fluid appendTo="body" [baseZIndex]="2100" />
                </div>
                <div class="col-span-12 md:col-span-3">
                    <label class="block font-bold mb-2 text-sm">Tipo de compra</label>
                    <p-select [options]="tiposCompraFiltro" optionLabel="label" optionValue="value" [(ngModel)]="filtroTipoCompra" placeholder="Todos" [showClear]="true" fluid appendTo="body" [baseZIndex]="2100" />
                </div>
                <div class="col-span-12 md:col-span-2 flex items-end">
                    <p-button label="Consultar" icon="pi pi-filter" (onClick)="consultarCuenta()" [loading]="cargandoCuenta" fluid />
                </div>
            </div>
            <div class="grid grid-cols-12 gap-3 mb-4" *ngIf="cuenta">
                <div class="col-span-4">
                    <div class="text-muted-color">Cargo</div>
                    <div class="font-semibold text-xl">{{ formatBs(cuenta.resumen.cargo) }}</div>
                    <div class="text-muted-color text-xs" *ngIf="cuenta.resumen.saldo_anterior">Anterior {{ formatBs(cuenta.resumen.saldo_anterior) }}</div>
                    <div class="text-muted-color text-xs" *ngIf="cuenta.resumen.compras_usd">USD ref. {{ formatUsd(cuenta.resumen.compras_usd) }}</div>
                    <div class="text-muted-color text-xs">Compras {{ formatBs(cuenta.resumen.compras) }} · Servicios {{ formatBs(cuenta.resumen.servicios) }} · Acopio {{ formatBs(cuenta.resumen.acopios) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">Abonado</div>
                    <div class="font-semibold text-xl text-green-600">{{ formatBs(cuenta.resumen.abono) }}</div>
                    <div class="text-muted-color text-xs" *ngIf="cuenta.resumen.pagado_usd">USD ref. {{ formatUsd(cuenta.resumen.pagado_usd) }}</div>
                    <div class="text-muted-color text-xs">Pagos {{ formatBs(cuenta.resumen.pagado_compras) }} · Acopio {{ formatBs(cuenta.resumen.pagado_acopios) }}</div>
                </div>
                <div class="col-span-4">
                    <div class="text-muted-color">{{ (cuenta.resumen.saldo || 0) < 0 ? 'Saldo a favor' : 'Saldo por pagar' }}</div>
                    <div class="font-semibold text-xl" [class.text-orange-500]="(cuenta.resumen.saldo || 0) >= 0" [class.text-green-600]="(cuenta.resumen.saldo || 0) < 0">{{ formatBs(cuenta.resumen.saldo) }}</div>
                    <div class="text-muted-color text-xs" *ngIf="cuenta.resumen.saldo_usd">USD ref. {{ formatUsd(cuenta.resumen.saldo_usd) }}</div>
                </div>
            </div>
            <p class="text-muted-color text-sm mb-2">Entregas de inventario de esta cuenta. El stock del almacén es único: no se reserva ni se descuenta el pilado por productor.</p>
            <p-table [value]="cuenta?.inventario || []" [paginator]="(cuenta?.inventario?.length || 0) > 5" [rows]="5" responsiveLayout="scroll" styleClass="mb-4">
                <ng-template #header>
                    <tr><th>Producto</th><th>Unidad</th><th>Compras</th><th>Acopio</th><th>Entregado</th></tr>
                </ng-template>
                <ng-template #body let-i>
                    <tr>
                        <td>{{ i.producto }}</td>
                        <td>{{ i.unidad }}</td>
                        <td>{{ formatCantidad(i.compras) }}</td>
                        <td>{{ formatCantidad(i.acopio) }}</td>
                        <td class="font-medium">{{ formatCantidad(i.entregado) }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5"><div class="text-center py-3 text-muted-color">Sin entregas de inventario. Un servicio (compra sin producto) no suma kilos.</div></td></tr>
                </ng-template>
            </p-table>
            <p class="text-muted-color text-sm mb-3">Kardex por proveedor. Incluye sus distintos productores. La deuda y los pagos son en Bs; el USD es referencial.</p>
            <p-table [value]="cuenta?.kardex || []" [paginator]="true" [alwaysShowPaginator]="true" [rows]="8" sortMode="single" responsiveLayout="scroll">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Productor</th>
                        <th>Tipo de operación</th>
                        <th>Concepto/Producto</th>
                        <th>Boleta</th>
                        <th>Chofer</th>
                        <th>Placa</th>
                        <th>Fanegas</th>
                        <th>Precio</th>
                        <th>Compra</th>
                        <th>Pago/Amortización</th>
                        <th>Saldo</th>
                    </tr>
                </ng-template>
                <ng-template #body let-l>
                    <tr>
                        <td>{{ formatFecha(l.fecha) }}</td>
                        <td>{{ l.productor || '-' }}</td>
                        <td><p-tag [value]="l.tipo" [severity]="severidadKardex(l.tipo)" /></td>
                        <td>{{ l.detalle }}</td>
                        <td>{{ l.boleta || '-' }}</td>
                        <td>{{ l.chofer || '-' }}</td>
                        <td>{{ l.placa || '-' }}</td>
                        <td>{{ l.fanegas ? formatCantidad(l.fanegas) : '-' }}</td>
                        <td>
                            <div *ngIf="l.precio_usd">{{ formatUsd(l.precio_usd) }}</div>
                            <div [class.text-xs]="l.precio_usd" [class.text-muted-color]="l.precio_usd">{{ l.precio ? formatBs(l.precio) : '-' }}</div>
                        </td>
                        <td>
                            <div>{{ l.cargo ? formatBs(l.cargo) : '-' }}</div>
                            <div class="text-xs text-muted-color" *ngIf="l.cargo_usd">{{ formatUsd(l.cargo_usd) }}</div>
                        </td>
                        <td>
                            <div>{{ l.abono ? formatBs(l.abono) : '-' }}</div>
                            <div class="text-xs text-muted-color" *ngIf="l.abono_usd">{{ formatUsd(l.abono_usd) }}</div>
                        </td>
                        <td class="font-medium">
                            <div>{{ formatBs(l.saldo) }}</div>
                            <div class="text-xs text-muted-color" *ngIf="l.saldo_usd">{{ formatUsd(l.saldo_usd) }}</div>
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="12"><div class="text-center py-4 text-muted-color">Sin movimientos para estos filtros.</div></td></tr>
                </ng-template>
            </p-table>
            <ng-template #footer>
                <app-botones-exportar
                    *ngIf="proveedorCuenta?.id"
                    tipo="cuenta_proveedor"
                    [id]="proveedorCuenta?.id"
                    [fechaDesde]="fechaDesdeYmd"
                    [fechaHasta]="fechaHastaYmd"
                    [idProductor]="filtroProductorId"
                    [tipoCompra]="filtroTipoCompra"
                />
                <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="dialogCuenta = false" />
            </ng-template>
        </p-dialog>
    `
})
export class ProveedoresPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    proveedores: Proveedor[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    dialogCuenta = false;
    cargandoCuenta = false;
    form: Proveedor = this.vacio();
    cuenta: CuentaProveedor | null = null;
    proveedorCuenta: Proveedor | null = null;
    filtroPeriodo: Date[] | null = null;
    filtroProductorId: number | null = null;
    filtroTipoCompra = '';
    tiposCompraFiltro = [
        { label: 'Arroz en chala', value: 'CHALA' },
        { label: 'Bolsas y empaques', value: 'BOLSAS' },
        { label: 'Otros / servicios', value: 'OTROS' }
    ];
    itemsAcciones: MenuItem[] = [];
    formatBs = formatBs;
    formatUsd = formatUsd;
    formatFecha = formatFecha;

    constructor(private proveedoresService: ProveedoresService, private aviso: AvisoService) {}

    ngOnInit(): void {
        this.cargar();
    }

    cargar(): void {
        this.cargando = true;
        this.proveedoresService.listar({ activos: 'todos' }).subscribe({
            next: (data) => {
                this.proveedores = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar proveedores');
            }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.dialog = true;
    }

    abrirAcciones(event: Event, menu: Menu, item: Proveedor): void {
        this.itemsAcciones = [
            {
                label: 'Estado de cuenta',
                icon: 'pi pi-book menu-icon-ver',
                iconStyle: { color: '#3b82f6' },
                command: () => this.verCuenta(item)
            },
            {
                label: 'Editar',
                icon: 'pi pi-pencil menu-icon-editar',
                iconStyle: { color: '#f59e0b' },
                command: () => this.editar(item)
            }
        ];
        menu.toggle(event);
    }

    editar(item: Proveedor): void {
        this.form = { ...item };
        this.dialog = true;
    }

    verCuenta(item: Proveedor): void {
        this.proveedorCuenta = item;
        this.cuenta = null;
        this.filtroPeriodo = null;
        this.filtroProductorId = null;
        this.filtroTipoCompra = '';
        this.dialogCuenta = true;
        this.consultarCuenta();
    }

    consultarCuenta(): void {
        if (!this.proveedorCuenta?.id) {
            return;
        }
        this.cargandoCuenta = true;
        this.proveedoresService.cuenta(this.proveedorCuenta.id, {
            fecha_desde: this.fechaDesdeYmd,
            fecha_hasta: this.fechaHastaYmd,
            id_productor: this.filtroProductorId || undefined,
            tipo_compra: this.filtroTipoCompra || undefined
        }).subscribe({
            next: (data) => {
                this.cuenta = data;
                this.cargandoCuenta = false;
            },
            error: (err) => {
                this.cargandoCuenta = false;
                this.aviso.error(err, 'No se pudo cargar el estado de cuenta');
            }
        });
    }

    get opcionesProductor(): { label: string; value: number | null }[] {
        const lista = (this.cuenta?.productores || []).map((p) => ({ label: p.nombre, value: p.id }));
        return [{ label: 'Todos', value: null }, ...lista];
    }

    get fechaDesdeYmd(): string | undefined {
        const desde = this.filtroPeriodo?.[0];
        return desde ? this.ymd(desde) : undefined;
    }

    get fechaHastaYmd(): string | undefined {
        const hasta = this.filtroPeriodo?.[1] || this.filtroPeriodo?.[0];
        return hasta ? this.ymd(hasta) : undefined;
    }

    private ymd(fecha: Date): string {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    guardar(): void {
        if (!this.form.nombre?.trim()) {
            this.aviso.aviso('Validación', 'El nombre es obligatorio');
            return;
        }
        this.guardando = true;
        const payload = {
            nombre: this.form.nombre,
            nit_ci: this.form.nit_ci || '',
            telefono: this.form.telefono || '',
            direccion: this.form.direccion || '',
            observacion: this.form.observacion || '',
            activo: this.form.activo,
            path_imagen: this.form.path_imagen || imagenDefault('proveedor')
        };
        const req = this.form.id
            ? this.proveedoresService.actualizar(this.form.id, payload)
            : this.proveedoresService.crear(payload);
        req.subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo guardar');
            }
        });
    }

    private vacio(): Proveedor {
        return { id: 0, nombre: '', nit_ci: '', telefono: '', direccion: '', observacion: '', activo: true, path_imagen: imagenDefault('proveedor') };
    }

    foto(path?: string | null): string {
        return mediaUrl(path, 'proveedor');
    }

    formatCantidad(valor: number): string {
        return Number(valor || 0).toLocaleString('es-BO', { maximumFractionDigits: 3 });
    }

    severidadKardex(tipo: string): 'success' | 'warn' | 'info' | 'secondary' {
        if (tipo === 'PAGO' || tipo === 'PAGO ACOPIO') return 'success';
        if (tipo === 'ACOPIO') return 'info';
        if (tipo === 'SERVICIO' || tipo === 'SALDO ANTERIOR') return 'secondary';
        return 'warn';
    }
}
