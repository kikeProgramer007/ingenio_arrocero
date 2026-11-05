import { CommonModule, Location } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { normalizarUnidadMedida } from '../../shared/utils/unidad-medida';
import { OrigenForm, ProduccionEtapaFormPage } from './produccion-etapa-form';
import { DatosEtapa, ProduccionEtapasService } from './produccion-etapas.service';

@Component({selector:'app-produccion-transformacion-form',standalone:true,
    imports:[CommonModule,FormsModule,RouterModule,AutoCompleteModule,ButtonModule,DatePickerModule,InputTextModule,TextareaModule,SelectModule,SkeletonModule,DialogModule,TagModule,InputNumeroComponent],
    templateUrl:'./produccion-transformacion-form.html',styles:[`:host{display:block;min-width:0}.etiqueta{display:block;font-weight:600;font-size:.9rem;margin-bottom:.5rem}.campo-error{color:var(--p-red-600,#dc2626);font-size:.85rem;display:block;margin-top:.35rem}:host ::ng-deep .p-autocomplete{width:100%}:host ::ng-deep .p-autocomplete-input{width:100%;min-width:0}`]})
export class ProduccionTransformacionFormPage extends ProduccionEtapaFormPage {
    private vida=inject(DestroyRef);private catalogo=inject(ProduccionEtapasService);private avisos=inject(AvisoService);
    private requests=new Map<object,Subscription>();
    get procesado(){return this.ruta==='procesados';}
    override get nombre(){return this.procesado?'procesado':'envasado';}
    protected override get mensajeConfirmacion(){return this.procesado?'Se descontará la chala indicada y se registrarán únicamente los productos obtenidos, conservando su propietario.':'Se descontará el producto a granel y las bolsas, y se ingresará la presentación terminada con el mismo propietario.';}
    get resultados():DatosEtapa[]{return this.form['resultados']||[];}
    destino:DatosEtapa|null=null;bolsa:DatosEtapa|null=null;destinos:DatosEtapa[]=[];bolsas:DatosEtapa[]=[];
    constructor(api:ProduccionEtapasService,aviso:AvisoService,confirmar:ConfirmarService,location:Location){super(api,aviso,confirmar,location);this.form['resultados']=[];}
    protected override aplicar(d:DatosEtapa){super.aplicar(d);
        for(const k of ['peso_entrada_kg','merma_medida','numero_bolsas','contenido_bolsa_kg','equivalencia_kg_origen','equivalencia_kg_destino','peso_total_kg','cantidad_destino'])this.form[k]=d[k]==null?null:Number(d[k]);
        this.form['resultados']=(d['resultados']||[]).map((r:DatosEtapa)=>({...r,cantidad:r['cantidad']==null?null:Number(r['cantidad']),peso_real_kg:r['peso_real_kg']==null?null:Number(r['peso_real_kg']),seleccion:r['id_producto']?{id:r['id_producto'],nombre:r['producto'],unidad_medida:r['unidad']}:null,sugerencias:[]}));
        this.destino=d['id_producto_destino']?{id:d['id_producto_destino'],nombre:d['producto_destino'],unidad_medida:d['destino_unidad']||d['unidad_destino']}:null;
        this.bolsa=d['id_producto_empaque']?{id:d['id_producto_empaque'],nombre:d['empaque']}:null;
    }
    protected override datos(){const d=super.datos();d['resultados']=this.resultados.map(r=>({...r,id_producto:typeof r['seleccion']==='object'?r['seleccion']?.id||null:null}));
        d['id_producto_destino']=typeof this.destino==='object'?this.destino?.['id']||null:null;d['id_producto_empaque']=typeof this.bolsa==='object'?this.bolsa?.['id']||null:null;return d;}
    override elegir(o:OrigenForm){super.elegir(o);if(this.procesado)this.form['peso_entrada_kg']=null;else{this.form['equivalencia_kg_origen']=null;this.recalcularEnvase();}}
    agregarResultado(){this.resultados.push({id_producto:null,seleccion:null,sugerencias:[],clasificacion:null,cantidad:null,unidad:null,peso_real_kg:null,observacion:null});}
    quitarResultado(i:number){this.requests.get(this.resultados[i])?.unsubscribe();this.resultados.splice(i,1);}
    buscarResultado(r:DatosEtapa,q:string){this.requests.get(r)?.unsubscribe();this.requests.set(r,this.catalogo.opciones(this.ruta,'productos',q).pipe(takeUntilDestroyed(this.vida)).subscribe({next:rows=>r['sugerencias']=rows,error:e=>this.avisos.error(e,'No se pudieron cargar productos')}));}
    elegirResultado(r:DatosEtapa){const p=r['seleccion'];r['id_producto']=typeof p==='object'?p?.id||null:null;r['unidad']=p?.unidad_medida?normalizarUnidadMedida(p.unidad_medida):null;r['peso_real_kg']=null;if(!r['clasificacion']&&p?.nombre)r['clasificacion']=p.nombre;}
    buscarProducto(grupo:'productos'|'empaques',q:string){const key=grupo==='empaques'?this.bolsas:this.destinos;this.requests.get(key)?.unsubscribe();this.requests.set(key,this.catalogo.opciones(this.ruta,grupo,q).pipe(takeUntilDestroyed(this.vida)).subscribe({next:r=>{key.splice(0,key.length,...r);},error:e=>this.avisos.error(e,'No se pudieron cargar productos')}));}
    get unidadDestino(){return normalizarUnidadMedida(this.destino?.['unidad_medida']||'');}
    get pesoTotal(){return this.form['numero_bolsas']!=null&&this.form['contenido_bolsa_kg']!=null?Math.round(this.form['numero_bolsas']*this.form['contenido_bolsa_kg']*1000)/1000:null;}
    recalcularEnvase(){const factor=this.origenPrincipal?.['unidad']==='Kilo'?1:Number(this.form['equivalencia_kg_origen']);if(this.origenes[0]&&this.pesoTotal!=null&&factor>0)this.origenes[0].cantidad=Math.round(this.pesoTotal/factor*1000)/1000;}
    get cantidadEnvasada(){if(this.pesoTotal==null)return null;if(this.unidadDestino==='Unidad')return this.form['numero_bolsas'];const factor=this.unidadDestino==='Kilo'?1:Number(this.form['equivalencia_kg_destino']);return factor>0?Math.round(this.pesoTotal/factor*1000)/1000:null;}
    get resumenProduccion(){
        const input=this.origenPrincipal?.['unidad']==='Kilo'?this.cantidadTotal:this.form['peso_entrada_kg']==null?null:Number(this.form['peso_entrada_kg']);
        const known=this.resultados.length&&this.resultados.every(r=>r['unidad']==='Kilo'&&r['cantidad']!=null||r['peso_real_kg']!=null);
        const output=known?this.resultados.reduce((sum,r)=>sum+Math.round(Number(r['unidad']==='Kilo'?r['cantidad']:r['peso_real_kg'])*1000),0)/1000:null;
        return {input,output,rendimiento:input!=null&&input>0&&output!=null?output/input*100:null,diferencia:input!=null&&output!=null?Math.round((input-output)*1000)/1000:null};
    }
    get totalesSalida(){const totals=new Map<string,number>();for(const r of this.resultados)if(r['unidad']&&r['cantidad']!=null)totals.set(r['unidad'],(totals.get(r['unidad'])||0)+Math.round(Number(r['cantidad'])*1000));return [...totals].map(([unidad,cantidad])=>({unidad,cantidad:cantidad/1000}));}
}
