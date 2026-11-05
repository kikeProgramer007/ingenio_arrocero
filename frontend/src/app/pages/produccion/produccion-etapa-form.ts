import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { AutoCompleteModule } from 'primeng/autocomplete';
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
import { DatosEtapa, ProduccionEtapasService, RutaEtapa } from './produccion-etapas.service';
import { permisoEtapa } from './produccion-permisos';

export interface OrigenForm {id_lote:number|null;cantidad:number|null;seleccion:DatosEtapa|null;sugerencias:DatosEtapa[];request?:Subscription;}
@Component({selector:'app-produccion-etapa-form',standalone:true,
    imports:[CommonModule,FormsModule,RouterModule,AutoCompleteModule,ButtonModule,DatePickerModule,InputTextModule,TextareaModule,SelectModule,SkeletonModule,DialogModule,TagModule,InputNumeroComponent],
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
    get duracion(){const a=this.form['inicio'],b=this.form['fin'];return a&&b&&b>=a?Math.round((b.getTime()-a.getTime())/60000)+' min':'Pendiente';}
    get camposTexto(){return this.secado?[{key:'secadora',label:'Secadora *',max:150},{key:'operador',label:'Operador',max:150},{key:'silo',label:'Silo de secado',max:150},{key:'responsable',label:'Responsable',max:150}]:[{key:'responsable',label:'Responsable',max:150},{key:'condicion',label:'Condición del arroz',max:150}];}
    get mediciones(){return [{key:'humedad_entrada',label:'Humedad inicial (%)',unidad:false},{key:'humedad_salida',label:'Humedad final (%) *',unidad:false},{key:'peso_salida',label:'Cantidad real de salida (si se midió)',unidad:true,unit:'unidad_peso_salida'},{key:'merma_medida',label:'Merma medida (si corresponde)',unidad:true,unit:'unidad_merma'}];}
    constructor(private api:ProduccionEtapasService,private aviso:AvisoService,private confirmar:ConfirmarService,private location:Location){}
    ngOnInit(){const id=this.route.snapshot.paramMap.get('id');if(id)this.cargar(Number(id));}
    cargar(id:number){this.cargando=true;this.errorCarga='';this.api.obtener(this.ruta,id).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:d=>{this.aplicar(d);this.cargando=false;},error:e=>{this.cargando=false;this.errorCarga=this.aviso.error(e,'No se pudo abrir el documento').mensaje;}});}
    protected aplicar(d:DatosEtapa){
        this.documento=d;this.form={...d};for(const key of ['fecha','inicio','fin'])this.form[key]=d[key]?new Date(d[key]):null;
        for(const key of ['humedad_entrada','humedad_salida','peso_salida','merma_medida'])this.form[key]=d[key]==null?null:Number(d[key]);
        this.origenes=(d['origenes']||[]).map((o:DatosEtapa)=>({id_lote:Number(o['id_lote']),cantidad:o['cantidad']==null?null:Number(o['cantidad']),seleccion:{...o,id:Number(o['id_lote']),etiqueta:`${o['codigo']} · ${o['productor']||'Ingenio'} · ${o['variedad']||''}`},sugerencias:[]}));
        if(!this.origenes.length)this.agregar();
        this.ubicacion=d['id_ubicacion']?{id:d['id_ubicacion'],nombre:d['ubicacion']||d['destino_nombre']}:d['destino_nombre']||null;
        this.location.replaceState(`/produccion/${this.ruta}/${d['id']}`);
    }
    agregar(){this.origenes.push({id_lote:null,cantidad:null,seleccion:null,sugerencias:[]});}
    quitar(i:number){this.origenes[i].request?.unsubscribe();this.origenes.splice(i,1);}
    buscarLotes(o:OrigenForm,q:string){o.request?.unsubscribe();o.request=this.api.opciones(this.ruta,'lotes',q).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>o.sugerencias=r,error:e=>this.aviso.error(e,'No se pudieron buscar lotes')});}
    elegir(o:OrigenForm){o.id_lote=o.seleccion?.['id']||null;o.cantidad=null;
        if(o.seleccion){o.cantidad=Number(o.seleccion['cantidad_disponible']);if(this.secado&&this.origenes.length===1)this.form['humedad_entrada']=o.seleccion['humedad_origen']==null?null:Number(o.seleccion['humedad_origen']);}}
    buscarUbicacion(q:string){this.ubicacionRequest?.unsubscribe();this.ubicacionRequest=this.api.opciones(this.ruta,'ubicaciones',q).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>this.ubicaciones=r,error:e=>this.aviso.error(e,'No se pudieron cargar ubicaciones')});}
    numero(v:any){return v==null?'No informado':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(v));}
    protected datos(){const d:DatosEtapa={...this.form,origenes:this.origenes.map(o=>({id_lote:o.seleccion?.['id']||null,cantidad:o.cantidad})),clave_creacion:this.claveCreacion,version:this.documento?.['version'],
        id_ubicacion:typeof this.ubicacion==='object'?this.ubicacion?.['id']||null:null,destino_nombre:typeof this.ubicacion==='string'?this.ubicacion.trim():this.ubicacion?.['nombre']||null};
        for(const key of ['fecha','inicio','fin'])d[key]=d[key] instanceof Date?d[key].toISOString():null;return d;}
    async guardar(confirmar=false){
        if(this.guardando)return;
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
    async anular(){if(this.guardando||!this.documento)return;this.guardando=true;this.error='';
        try{const d=await firstValueFrom(this.api.anular(this.ruta,this.documento['id'],this.documento['version'],this.motivo));this.aplicar(d);this.anularVisible=false;this.aviso.ok('Operación anulada');}
        catch(e:any){this.error=this.aviso.error(e,'No se pudo anular').mensaje;this.campos=e.error?.campos||{};}finally{this.guardando=false;}}
    protected get mensajeConfirmacion(){return 'Se trasladará únicamente la cantidad indicada, conservando su propietario y el saldo restante de cada lote.';}
}
