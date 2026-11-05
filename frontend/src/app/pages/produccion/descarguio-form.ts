import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { AvisoService } from '../../shared/services/aviso.service';
import { ConfirmarService } from '../../shared/services/confirmar.service';
import { Descarguio, DescarguiosService, OpcionDescarguio } from './descarguios.service';
import { permisoDescarguio } from './produccion-permisos';

type Formulario = Omit<Descarguio, 'id' | 'codigo' | 'fecha' | 'estado' | 'version' | 'historial'> & { fecha: Date };
@Component({
    selector: 'app-descarguio-form', standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, AutoCompleteModule, ButtonModule, DatePickerModule, SelectModule, InputTextModule,
        TextareaModule, DialogModule, TagModule, SkeletonModule, InputNumeroComponent, AyudaCampoComponent],
    templateUrl: './descarguio-form.html',
    styles: [`:host{display:block;min-width:0}.campo-error{color:var(--p-red-600,#dc2626);font-size:.85rem;display:block;margin-top:.35rem}.etiqueta{display:flex;gap:.35rem;align-items:center;font-weight:600;font-size:.9rem;margin-bottom:.5rem}:host ::ng-deep .p-autocomplete{width:100%}:host ::ng-deep .p-autocomplete-input{min-width:0;width:100%}`]
})
export class DescarguioFormPage implements OnInit {
    private destroyRef = inject(DestroyRef);
    private solicitudes: Record<string, Subscription> = {};
    private claveCreacion = crypto.randomUUID();
    private claveConfirmacion = crypto.randomUUID();
    private confirmacionPendiente: { id: number; version: number } | null = null;
    private solicitudRecepciones?: Subscription;
    documento: Descarguio | null = null;
    form: Formulario = {
        fecha: new Date(), modalidad: 'COMPRA', id_productor: null, id_producto: null, id_compra_detalle: null, id_recepcion_compra: null,
        id_campana: null, id_ubicacion: null, id_lote: null, boleta: null, chofer: null, placa: null, procedencia: null, localidad: null,
        variedad: null, cantidad: null, unidad: null, humedad_entrada: null, impurezas_entrada: null, impurezas_salida: null,
        peso_real_kg: null, punto_descarga: null, ubicacion_detalle: null, responsable: null, observacion: null
    };
    productor: OpcionDescarguio | string | null = null; producto: OpcionDescarguio | string | null = null;
    compra: OpcionDescarguio | string | null = null; ubicacion: OpcionDescarguio | string | null = null; campana: OpcionDescarguio | string | null = null;
    sugerencias: Record<string, OpcionDescarguio[]> = {}; variedades: string[] = [];
    recepciones: { id: number; etiqueta: string }[] = [];
    unidades = ['Fanega', 'Quintal', 'Kilo', 'Unidad'];
    modalidades = [{ label: 'Arroz comprado por el ingenio', value: 'COMPRA' }, { label: 'Servicio a terceros', value: 'SERVICIO' }];
    cargando = false; guardando = false; errorCarga = ''; errorGuardar = ''; campos: Record<string, string> = {};
    nuevoProductor = false; creandoProductor = false; productorForm = { nombre: '', nit_ci: '', telefono: '' }; errorProductor = '';
    dialogAnular = false; anulando = false; motivo = ''; errorAnular = '';
    puedeCrear = permisoDescarguio('escritura'); puedeModificar = permisoDescarguio('modificacion');
    constructor(private api: DescarguiosService, private route: ActivatedRoute, private aviso: AvisoService, private confirmar: ConfirmarService, private location: Location) {}
    get soloLectura() { return this.documento ? this.documento.estado !== 'BORRADOR' || !this.puedeModificar : !this.puedeCrear; }
    get permiteConfirmar() { return this.puedeCrear && (!this.documento || this.documento.estado === 'BORRADOR'); }
    get nombrePropietario() { return this.form.modalidad === 'COMPRA' ? 'Ingenio (propio)' : this.opcion(this.productor)?.nombre || 'Seleccione el productor propietario'; }
    get compraSeleccionada() { return this.opcion(this.compra); }
    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.cargar(Number(id));
    }
    cargar(id: number) {
        this.cargando = true; this.errorCarga = '';
        this.api.obtener(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: datos => { this.aplicar(datos); this.cargando = false; },
            error: e => { this.cargando = false; this.errorCarga = this.aviso.error(e, 'No se pudo abrir el descarguío').mensaje; } });
    }
    private aplicar(d: Descarguio) {
        this.documento = d;
        this.form = { ...d, fecha: new Date(d.fecha) };
        for (const campo of ['cantidad','humedad_entrada','impurezas_entrada','impurezas_salida','peso_real_kg'] as const)
            this.form[campo] = d[campo] == null ? null : Number(d[campo]);
        this.productor = d.id_productor ? { id: d.id_productor, nombre: d.productor_nombre || '' } : null;
        this.producto = d.id_producto ? { id: d.id_producto, nombre: d.producto_nombre || '', unidad_medida: d.unidad || undefined } : null;
        this.ubicacion = d.id_ubicacion ? { id: d.id_ubicacion, nombre: d.punto_descarga || '' } : d.punto_descarga;
        if (d.id_ubicacion) this.seleccionExistente('ubicaciones', d.id_ubicacion, o => { if (this.opcion(this.ubicacion)?.id === d.id_ubicacion) this.ubicacion = o; });
        this.campana = d.id_campana ? { id: d.id_campana, nombre: `Campaña #${d.id_campana}` } : null;
        if (d.id_campana) this.seleccionExistente('campanas', d.id_campana, o => { if (this.opcion(this.campana)?.id === d.id_campana) this.campana = o; });
        this.compra = null;
        if (d.id_compra_detalle) {
            this.compra = { id: d.id_compra_detalle, nombre: '', etiqueta: `Compra vinculada · línea ${d.id_compra_detalle}` };
            this.seleccionExistente('compras', d.id_compra_detalle, o => { if (this.opcion(this.compra)?.id === d.id_compra_detalle) this.compra = this.etiquetarCompra(o); });
            this.cargarRecepciones(d.id_compra_detalle);
        }
    }
    opciones(grupo: string, q: string) {
        this.solicitudes[grupo]?.unsubscribe();
        this.solicitudes[grupo] = this.api.opciones(grupo, q).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: datos => {
            if (grupo === 'variedades') this.variedades = datos.map(d => d.nombre);
            else this.sugerencias[grupo] = grupo === 'compras' ? datos.map(d => this.etiquetarCompra(d)) : datos;
        }, error: e => this.aviso.error(e, 'No se pudo consultar las opciones') });
    }
    private seleccionExistente(grupo: string, id: number, asignar: (o: OpcionDescarguio) => void) {
        this.api.opciones(grupo, '', id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: datos => { if (datos[0]) asignar(datos[0]); }, error: e => this.aviso.error(e, 'No se pudo recuperar una referencia del descarguío') });
    }
    private etiquetarCompra(o: OpcionDescarguio) { return { ...o, nombre: o.producto || o.descripcion || '', etiqueta: `#${o.id_compra} · ${o.boleta || 'Sin boleta'} · ${o.producto} · ${this.numero(o.disponible)} ${o.unidad || o.unidad_medida || ''} sin vincular` }; }
    seleccionarCompra(o: OpcionDescarguio) {
        this.compra = o;
        this.form.id_recepcion_compra = null;
        this.producto = { id: Number(o.id_producto), nombre: o.producto || o.descripcion || '', unidad_medida: o.unidad_medida };
        this.form.unidad = o.unidad || o.unidad_medida || null;
        this.form.cantidad = Number(o.disponible) > 0 ? Number(o.disponible) : null;
        this.form.boleta = o.boleta || this.form.boleta; this.form.chofer = o.chofer || this.form.chofer; this.form.placa = o.placa || this.form.placa;
        if (o.id_productor) this.productor = { id: o.id_productor, nombre: o.productor || '' };
        this.cargarRecepciones(o.id);
    }
    seleccionarProducto(o: OpcionDescarguio) { this.producto = o; this.form.unidad = o.unidad_medida || this.form.unidad; }
    cambiarModalidad() { this.solicitudRecepciones?.unsubscribe(); this.compra = null; this.form.id_compra_detalle = null; this.form.id_recepcion_compra = null; this.recepciones = []; }
    limpiarCompra() { this.solicitudRecepciones?.unsubscribe(); this.compra = null; this.form.id_recepcion_compra = null; this.recepciones = []; }
    private cargarRecepciones(id: number) {
        this.solicitudRecepciones?.unsubscribe();
        this.solicitudRecepciones = this.api.recepciones(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: datos => {
            if (this.opcion(this.compra)?.id === id) this.recepciones = datos.map(r => ({ id: r.id, etiqueta: `${new Date(r.fecha).toLocaleDateString('es-BO')} · ${this.numero(r.disponible)} disponibles (recepción #${r.id})` }));
        }, error: e => this.aviso.error(e, 'No se pudieron recuperar las recepciones') });
    }
    opcion(valor: OpcionDescarguio | string | null): OpcionDescarguio | null { return valor && typeof valor === 'object' && valor.id ? valor : null; }
    private datos() {
        return { ...this.form, fecha: this.form.fecha.toISOString(), clave_creacion: this.claveCreacion, version: this.documento?.version,
            id_productor: this.opcion(this.productor)?.id || null, id_producto: this.opcion(this.producto)?.id || null,
            id_compra_detalle: this.form.modalidad === 'COMPRA' ? this.opcion(this.compra)?.id || null : null,
            id_recepcion_compra: this.form.modalidad === 'COMPRA' ? this.form.id_recepcion_compra : null,
            id_campana: this.opcion(this.campana)?.id || null, id_ubicacion: this.opcion(this.ubicacion)?.id || null,
            punto_descarga: typeof this.ubicacion === 'string' ? this.ubicacion.trim() || null : this.opcion(this.ubicacion)?.nombre || null };
    }
    async guardar(confirmar = false) {
        if (this.guardando || this.cargando) return;
        this.campos = {}; this.errorGuardar = '';
        if (!(this.form.fecha instanceof Date) || !Number.isFinite(this.form.fecha.getTime())) { this.campos['fecha'] = 'Ingrese una fecha y hora válidas.'; return; }
        if (confirmar && !this.soloLectura) {
            if (!this.opcion(this.productor)) this.campos['id_productor'] = 'Seleccione un productor.';
            if (!this.opcion(this.producto)) this.campos['id_producto'] = 'Seleccione el producto.';
            if (!this.form.boleta?.trim()) this.campos['boleta'] = 'Ingrese la boleta.';
            if (!this.form.variedad?.trim()) this.campos['variedad'] = 'Ingrese la variedad.';
            if (!this.form.cantidad || this.form.cantidad <= 0) this.campos['cantidad'] = 'Ingrese una cantidad mayor que cero.';
            if (!this.form.unidad) this.campos['unidad'] = 'Seleccione la unidad.';
            if (this.form.modalidad === 'COMPRA' && !this.opcion(this.compra)) this.campos['id_compra_detalle'] = 'Vincule una compra recibida.';
            if (Object.keys(this.campos).length) { this.errorGuardar = 'Revise los campos obligatorios señalados.'; return; }
        }
        this.guardando = true;
        try {
            if (confirmar && this.confirmacionPendiente) {
                this.aplicar(await firstValueFrom(this.api.confirmar(this.confirmacionPendiente.id, this.confirmacionPendiente.version, this.claveConfirmacion)));
                this.confirmacionPendiente = null; this.aviso.ok('Descarguío confirmado'); return;
            }
            if (confirmar && !await this.confirmar.pedir({ titulo: 'Confirmar descarguío', mensaje: this.form.modalidad === 'COMPRA'
                ? 'Se creará el lote vinculándolo al arroz ya recibido en Compras. El stock propio no volverá a sumarse.'
                : 'Se registrará el arroz en custodia a nombre del productor. No se generarán compras, cobros ni stock propio.', aceptar: 'Confirmar' })) return;
            let guardado = this.documento;
            if (!this.soloLectura) {
                guardado = await firstValueFrom(this.documento ? this.api.editar(this.documento.id, this.datos()) : this.api.crear(this.datos()));
                this.aplicar(guardado);
                this.location.replaceState(`/produccion/descarguios/${guardado.id}`);
            }
            if (confirmar && guardado) {
                this.confirmacionPendiente = { id: guardado.id, version: guardado.version };
                this.aplicar(await firstValueFrom(this.api.confirmar(guardado.id, guardado.version, this.claveConfirmacion)));
                this.confirmacionPendiente = null;
            }
            this.aviso.ok(confirmar ? 'Descarguío confirmado' : 'Borrador guardado', this.documento?.codigo);
        } catch (e: unknown) {
            if ([400,403,404,409].includes(Number((e as { status?: number }).status))) this.confirmacionPendiente = null;
            this.errorGuardar = this.aviso.error(e, 'No se pudo guardar el descarguío').mensaje;
            this.campos = (e as { error?: { campos?: Record<string, string> } }).error?.campos || {};
        } finally { this.guardando = false; }
    }
    async crearProductor() {
        if (this.creandoProductor) return;
        this.errorProductor = ''; this.creandoProductor = true;
        try { this.productor = await firstValueFrom(this.api.crearProductor(this.productorForm)); this.nuevoProductor = false; this.productorForm = { nombre: '', nit_ci: '', telefono: '' }; }
        catch (e) { this.errorProductor = this.aviso.error(e, 'No se pudo crear el productor').mensaje; }
        finally { this.creandoProductor = false; }
    }
    async anular() {
        if (!this.documento || this.anulando) return;
        if (this.motivo.trim().length < 5) { this.errorAnular = 'Describa el motivo con al menos 5 caracteres.'; return; }
        this.anulando = true; this.errorAnular = '';
        try { this.aplicar(await firstValueFrom(this.api.anular(this.documento.id, this.documento.version, this.motivo))); this.dialogAnular = false; this.aviso.ok('Descarguío anulado'); }
        catch (e) { this.errorAnular = this.aviso.error(e, 'No se pudo anular el descarguío').mensaje; }
        finally { this.anulando = false; }
    }
    numero(valor: unknown) { return valor == null ? '—' : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 3 }).format(Number(valor)); }
    evento(valor: string) { return ({ CREAR_BORRADOR: 'Borrador creado', EDITAR_BORRADOR: 'Borrador editado', CONFIRMAR: 'Confirmado', ANULAR: 'Anulado' } as Record<string, string>)[valor] || valor; }
}
