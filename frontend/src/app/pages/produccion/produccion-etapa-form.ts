import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputNumeroComponent } from '../../shared/components/input-numero';
import { AvisoService } from '../../shared/services/aviso.service';
import { ConfirmarService } from '../../shared/services/confirmar.service';
import { ExportarService } from '../../shared/services/exportar.service';
import { DatosEtapa, ProduccionEtapasService, RutaEtapa } from './produccion-etapas.service';
import { permisoEtapa } from './produccion-permisos';

export interface OrigenForm {id_lote:number|null;cantidad:number|null;seleccion:DatosEtapa|null;sugerencias:DatosEtapa[];request?:Subscription;}
@Component({selector:'app-produccion-etapa-form',standalone:true,
    imports:[AyudaCampoComponent,CommonModule,FormsModule,RouterModule,MultiSelectModule,ButtonModule,DatePickerModule,InputTextModule,TextareaModule,SelectModule,SkeletonModule,DialogModule,TagModule,InputNumeroComponent],
    templateUrl:'./produccion-etapa-form.html',
    styles:[`:host{display:block;min-width:0}.etiqueta{display:block;font-weight:600;font-size:.9rem;margin-bottom:.5rem}.campo-error{color:var(--p-red-600,#dc2626);font-size:.85rem;display:block;margin-top:.35rem}:host ::ng-deep .p-autocomplete{width:100%}:host ::ng-deep .p-autocomplete-input{width:100%;min-width:0}`]})
export class ProduccionEtapaFormPage implements OnInit {
    private destroy=inject(DestroyRef);private route=inject(ActivatedRoute);
    ruta:RutaEtapa=this.route.snapshot.data['etapa'];
    get secado(){return this.ruta==='secados';} get nombre():string{return this.secado?'secado':'guardado';}
    puedeCrear=permisoEtapa(this.ruta,'escritura');puedeModificar=permisoEtapa(this.ruta,'modificacion');
    documento:DatosEtapa|null=null;form:DatosEtapa={fecha:new Date(),inicio:null,fin:null};
    origenes:OrigenForm[]=[{id_lote:null,cantidad:null,seleccion:null,sugerencias:[]}];
    ubicacion:DatosEtapa|string|null=null;ubicaciones:DatosEtapa[]=[];private ubicacionRequest?:Subscription;
    private claveCreacion=crypto.randomUUID();private claveConfirmacion=crypto.randomUUID();private pendiente:{id:number;version:number}|null=null;
    cargando=false;guardando=false;error='';errorCarga='';campos:Record<string,string>={};anularVisible=false;motivo='';
    unidades=['Fanega','Quintal','Kilo','Unidad'];
    get soloLectura(){return !!this.pendiente || (this.documento ? this.documento['estado']!=='BORRADOR'||!this.puedeModificar:!this.puedeCrear);}
    get origenPrincipal(){return this.origenes[0]?.seleccion;}
    get cantidadTotal(){return this.origenes.reduce((a,o)=>a+Math.round(Number(o.cantidad||0)*1000),0)/1000;}
    get duracion(){
        const a=this.inicioCompleto,b=this.finCompleto;
        return a&&b&&b>=a?Math.round((b.getTime()-a.getTime())/60000)+' min':'Pendiente';
    }
    private get inicioCompleto(){return this.combinarFechaHora(this.form['fecha'],this.form['inicio']);}
    private get finCompleto(){return this.combinarFechaHora(this.form['fecha'],this.form['fin']);}
    private combinarFechaHora(fecha:unknown,hora:unknown):Date|null{
        if(!(fecha instanceof Date)||!Number.isFinite(fecha.getTime()))return null;
        if(!(hora instanceof Date)||!Number.isFinite(hora.getTime()))return null;
        return new Date(fecha.getFullYear(),fecha.getMonth(),fecha.getDate(),hora.getHours(),hora.getMinutes(),0,0);
    }
    readonly camposTexto=this.secado?[{key:'proc',label:'Proc.',max:50,req:false},{key:'secadora',label:'Secadora',max:150,req:true},{key:'operador',label:'Operador',max:150,req:false},{key:'silo',label:'Silo de secado',max:150,req:false},{key:'responsable',label:'Responsable',max:150,req:false}]:[{key:'orden_guardado',label:'O',max:50,req:false},{key:'responsable',label:'Responsable',max:150,req:false}];
    readonly mediciones=[{key:'humedad_entrada',label:'Humedad inicial (%)',unidad:false,req:false},{key:'humedad_salida',label:'Humedad final (%)',unidad:false,req:true}];
    ayudaCampo(key:string){return ({proc:'Escriba la referencia Proc. usada en su control.',orden_guardado:'Escriba el orden o referencia O de este guardado.',secadora:'Nombre de la secadora utilizada.',operador:'Persona que realizó el secado.',silo:'Silo desde el que se realizó el secado.',responsable:'Persona encargada de esta operación.',humedad_entrada:'Humedad medida antes del secado.',humedad_salida:'Humedad medida al finalizar el secado.'} as Record<string,string>)[key]||'Complete este dato si corresponde.';}
    private exportar=inject(ExportarService);
    constructor(private api:ProduccionEtapasService,private aviso:AvisoService,private confirmar:ConfirmarService,private location:Location){}
    catalogos:Record<string,DatosEtapa[]>={};
    get opcionesLotes(){const opciones=new Map<number,DatosEtapa>();for(const l of [...(this.catalogos['lotes']||[]),...this.origenes.map(o=>o.seleccion).filter(Boolean)])opciones.set(Number(l!['id']),l!);return [...opciones.values()];}
    async ngOnInit(){
        this.cargando=true;this.errorCarga='';
        try{
            const grupos=['lotes','ubicaciones',...(['procesados','envasados'].includes(this.ruta)?['productos']:[]),...(this.ruta==='envasados'?['empaques']:[])];
            await Promise.all(grupos.map(async grupo=>{this.catalogos[grupo]=await firstValueFrom(this.api.opciones(this.ruta,grupo,'',undefined,true).pipe(takeUntilDestroyed(this.destroy)));}));
            this.ubicaciones=this.catalogos['ubicaciones'];
            const id=this.route.snapshot.paramMap.get('id');if(id)this.aplicar(await firstValueFrom(this.api.obtener(this.ruta,Number(id)).pipe(takeUntilDestroyed(this.destroy))));
            if(this.documento&&this.documento['estado']!=='ANULADO'&&this.puedeModificar&&this.route.snapshot.queryParamMap.get('anular')==='1')this.anularVisible=true;
        }catch(e){this.errorCarga=this.aviso.error(e,'No se pudieron cargar los datos del formulario').mensaje;}
        finally{this.cargando=false;}
    }
    cargar(id:number){this.cargando=true;this.errorCarga='';this.api.obtener(this.ruta,id).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:d=>{this.aplicar(d);this.cargando=false;},error:e=>{this.cargando=false;this.errorCarga=this.aviso.error(e,'No se pudo abrir el documento').mensaje;}});}
    protected aplicar(d:DatosEtapa){
        this.documento=d;this.form={...d};for(const key of ['fecha','inicio','fin'])this.form[key]=d[key]?new Date(d[key]):null;
        for(const key of ['humedad_entrada','humedad_salida','peso_salida','merma_medida'])this.form[key]=d[key]==null?null:Number(d[key]);
        this.origenes=(d['origenes']||[]).map((o:DatosEtapa)=>({id_lote:Number(o['id_lote']),cantidad:o['cantidad']==null?null:Number(o['cantidad']),seleccion:{...o,id:Number(o['id_lote']),etiqueta:o['origen_codigo']||o['codigo']},sugerencias:[]}));
        if(!this.origenes.length)this.agregar();
        this.ubicacion=d['id_ubicacion']?{id:d['id_ubicacion'],nombre:d['ubicacion']||d['destino_nombre']}:d['destino_nombre']||null;
        this.location.replaceState(`/produccion/${this.ruta}/${d['id']}`);
    }
    private clavesFila=new WeakMap<object,string>();
    claveFila(fila:object){let clave=this.clavesFila.get(fila);if(!clave){clave=crypto.randomUUID();this.clavesFila.set(fila,clave);}return clave;}
    trackFila=(_:number,fila:object)=>this.claveFila(fila);
    trackCampo=(_:number,campo:{key:string})=>campo.key;
    agregar(){if(this.soloLectura||this.guardando||this.origenes.length>=20)return;this.campos={};this.origenes.push({id_lote:null,cantidad:null,seleccion:null,sugerencias:[]});}
    quitar(i:number){if(this.soloLectura||this.guardando||!this.origenes[i])return;this.origenes[i].request?.unsubscribe();this.origenes.splice(i,1);this.campos={};if(!this.origenes.length)this.agregar();}
    elegir(o:OrigenForm){o.id_lote=o.seleccion?.['id']||null;o.cantidad=null;
        if(o.seleccion){
            o.cantidad=Number(o.seleccion['cantidad_disponible']);
            if(this.origenes.length===1){
                if(this.secado&&o.seleccion['humedad_origen']!=null)this.form['humedad_entrada']=Number(o.seleccion['humedad_origen']);
                if(o.seleccion['responsable_origen']&&!this.form['responsable']&&!this.form['operador']){
                    if(this.secado)this.form['operador']=o.seleccion['responsable_origen'];
                    else this.form['responsable']=o.seleccion['responsable_origen'];
                }
                if(o.seleccion['id_ubicacion']&&o.seleccion['ubicacion_nombre']&&!this.ubicacion){
                    this.ubicacion={id:Number(o.seleccion['id_ubicacion']),nombre:String(o.seleccion['ubicacion_nombre'])};
                    if(!this.ubicaciones.some(u=>Number(u['id'])===Number(o.seleccion?.['id_ubicacion'])))this.ubicaciones=[...this.ubicaciones,this.ubicacion];
                }
            }
        }}
    numero(v:any){return v==null?'No informado':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(v));}
    protected datos(){const d:DatosEtapa={...this.form,origenes:this.origenes.map(o=>({id_lote:o.seleccion?.['id']||null,cantidad:o.cantidad})),clave_creacion:this.claveCreacion,version:this.documento?.['version'],
        id_ubicacion:typeof this.ubicacion==='object'?this.ubicacion?.['id']||null:null,destino_nombre:typeof this.ubicacion==='string'?this.ubicacion.trim():this.ubicacion?.['nombre']||null};
        if(this.secado){
            const fecha=this.form['fecha'] instanceof Date&&Number.isFinite(this.form['fecha'].getTime())
                ?new Date(this.form['fecha'].getFullYear(),this.form['fecha'].getMonth(),this.form['fecha'].getDate(),12,0,0,0):null;
            d['fecha']=fecha?fecha.toISOString():null;
            d['inicio']=this.inicioCompleto?.toISOString()??null;
            d['fin']=this.finCompleto?.toISOString()??null;
            for(const key of ['peso_salida','unidad_peso_salida','merma_medida','unidad_merma','justificacion_merma','ubicacion_detalle'])d[key]=null;
        }else{
            for(const key of ['fecha','inicio','fin'])d[key]=d[key] instanceof Date?d[key].toISOString():null;
        }
        return d;}
    async guardar(confirmar=false){
        if(this.guardando||this.cargando||this.errorCarga)return;
        if(!this.pendiente && !this.validarFormulario(confirmar))return;
        if(confirmar&&!await this.confirmar.pedir({titulo:'Confirmar '+this.nombre,mensaje:this.mensajeConfirmacion}))return;
        this.guardando=true;this.error='';this.campos={};
        try{
            let d:DatosEtapa;
            if(confirmar&&this.pendiente)d=await firstValueFrom(this.api.confirmar(this.ruta,this.pendiente.id,this.pendiente.version,this.claveConfirmacion));
            else{
                d=confirmar && this.documento && !this.puedeModificar ? this.documento : await firstValueFrom(this.api.guardar(this.ruta,this.documento?.['id']||null,this.datos()));this.aplicar(d);
                if(confirmar){this.pendiente={id:d['id'],version:d['version']};d=await firstValueFrom(this.api.confirmar(this.ruta,d['id'],d['version'],this.claveConfirmacion));}
            }
            this.pendiente=null;this.aplicar(d);this.aviso.ok(confirmar?'Operación confirmada':'Borrador guardado');
        }catch(e:any){this.error=this.aviso.error(e,'No se pudo guardar la operación').mensaje;this.campos=e.error?.campos||{};
            if(e.status&&e.status<500)this.pendiente=null;
        }finally{this.guardando=false;}
    }
    protected validarFormulario(confirmar:boolean){
        this.campos={};this.error='';
        const ids=new Set<number>();
        this.origenes.forEach((o,i)=>{
            const id=typeof o.seleccion==='object'?Number(o.seleccion?.['id']):0;
            if(!Number.isSafeInteger(id)||id<=0)this.campos[`origenes.${i}.id_lote`]='Seleccione un código de la lista.';
            else if(ids.has(id))this.campos[`origenes.${i}.id_lote`]='Este código ya está agregado.';
            else ids.add(id);
            const principal=this.origenes.find(f=>typeof f.seleccion==='object'&&f.seleccion?.['id'])?.seleccion;
            if(id>0&&principal&&['modalidad','id_propietario','id_productor','id_producto','unidad','variedad'].some(k=>String(o.seleccion?.[k]??'')!==String(principal[k]??'')))this.campos[`origenes.${i}.id_lote`]='Use orígenes del mismo propietario, productor/proveedor, producto, variedad y unidad.';
            const cantidad=o.cantidad;
            if(cantidad!=null&&(!Number.isFinite(cantidad)||cantidad<=0||cantidad>999999999.999||Math.abs(cantidad*1000-Math.round(cantidad*1000))>0.00001))this.campos[`origenes.${i}.cantidad`]='Ingrese una cantidad mayor que cero, hasta 3 decimales.';
            else if(confirmar&&cantidad==null)this.campos[`origenes.${i}.cantidad`]='Indique la cantidad de este origen.';
            else if(cantidad!=null&&o.seleccion?.['cantidad_disponible']!=null&&cantidad>Number(o.seleccion['cantidad_disponible']))this.campos[`origenes.${i}.cantidad`]='La cantidad supera el saldo disponible.';
        });
        if(!(this.form['fecha'] instanceof Date)||!Number.isFinite(this.form['fecha'].getTime()))this.campos['fecha']=this.secado?'Indique una fecha válida.':'Indique una fecha y hora válidas.';
        if(this.secado){
            for(const key of ['inicio','fin'])if(this.form[key]!=null&&(!(this.form[key] instanceof Date)||!Number.isFinite(this.form[key].getTime())))this.campos[key]='Indique una hora válida.';
            const inicio=this.inicioCompleto,fin=this.finCompleto;
            if(fin&&(!inicio||fin<inicio))this.campos['fin']='La hora de fin debe ser posterior o igual a la inicial.';
            for(const key of ['humedad_entrada','humedad_salida'])if(this.form[key]!=null&&(!Number.isFinite(this.form[key])||this.form[key]<0||this.form[key]>100))this.campos[key]='La humedad debe estar entre 0 y 100 %.';
            if(confirmar)for(const key of ['secadora','inicio','fin','humedad_salida'])if(this.form[key]==null||(typeof this.form[key]==='string'&&!this.form[key].trim())||this.form[key]==='')this.campos[key]='Obligatorio para confirmar el ciclo.';
        }
        if(this.ruta==='guardados'&&confirmar&&!this.ubicacion)this.campos['destino_nombre']='Seleccione o escriba el silo/almacén destino.';
        if(Object.keys(this.campos).length){this.error='Revise los campos señalados antes de continuar.';return false;}return true;
    }
    async anular(){if(this.guardando||!this.documento)return;this.guardando=true;this.error='';
        try{const d=await firstValueFrom(this.api.anular(this.ruta,this.documento['id'],this.documento['version'],this.motivo));this.aplicar(d);this.anularVisible=false;this.aviso.ok('Operación anulada');}
        catch(e:any){this.error=this.aviso.error(e,'No se pudo anular').mensaje;this.campos=e.error?.campos||{};}finally{this.guardando=false;}}
    verDocumento(){
        if(!this.documento||!this.secado)return;
        const ventana=this.exportar.abrirVentanaEspera(`Control de secado ${this.documento['codigo']||''}...`);
        this.exportar.mostrarPdf({tipo:'secado',formato:'pdf',id:this.documento['id']},ventana).subscribe({error:e=>this.aviso.error(e,'No se pudo generar el documento')});
    }
    protected get mensajeConfirmacion(): string {
        return this.secado
            ? 'Se registrará el ciclo de secado con la cantidad indicada. El saldo no utilizado de cada origen permanecerá disponible y se conservará el propietario.'
            : 'Se guardará únicamente la cantidad indicada. El saldo restante de cada origen permanecerá disponible y se conservará el propietario.';
    }
}
