import { CommonModule } from '@angular/common';
import { HttpClient,HttpParams } from '@angular/common/http';
import { Component,DestroyRef,Input,OnInit,inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute,RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject,catchError,debounceTime,of,switchMap,tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule,TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { apiUrl } from '../../core/utils/api-url';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService,ParamsExport } from '../../shared/services/exportar.service';
import { permisoEtapa } from './produccion-permisos';

type Datos=Record<string,any>;
@Component({selector:'app-produccion-consultas',standalone:true,
 imports:[CommonModule,FormsModule,RouterModule,ButtonModule,TableModule,SelectModule,DatePickerModule,InputTextModule,SkeletonModule],templateUrl:'./produccion-consultas.html',
 styles:[`:host{display:block;min-width:0} th,td{overflow-wrap:anywhere;white-space:normal} .detalle-evento{border-left:2px solid var(--surface-border);padding:0 0 1.25rem 1.25rem;margin-left:.5rem}`]})
export class ProduccionConsultasPage implements OnInit{
 @Input() reportes=false;
 private http=inject(HttpClient);private aviso=inject(AvisoService);private exportar=inject(ExportarService);private destroy=inject(DestroyRef);private route=inject(ActivatedRoute);
 readonly reportesDisponibles=[{value:'descarguios',label:'Control de descarguíos',permiso:'descarguios'},{value:'secados',label:'Control de secados',permiso:'secados'},
 {value:'guardados',label:'Control de guardados',permiso:'guardados'},{value:'procesados',label:'Control de procesados',permiso:'procesados'},
 {value:'envasados',label:'Control de envasados',permiso:'envasados'},{value:'existencias',label:'Existencias por productor',permiso:'lotes'},{value:'rendimiento',label:'Rendimiento de producción',permiso:'procesados'}].filter(r=>permisoEtapa(r.permiso,'lectura'));
 tipo='';desde:Date|null=null;hasta:Date|null=null;productor:number|null=null;modalidad='';propiedad='';variedad='';estado='';ubicacion='';clasificacion='';fisico='';buscar='';
 catalogos:Datos={};resultado:Datos|null=null;detalle:Datos|null=null;cargando=false;error='';primero=0;filas=10;orden='fecha';direccion=-1;aplicado:Datos={};
 recargar=new Subject<void>();busqueda=new Subject<void>();detalleId:number|null=null;
 modalidades=[{label:'Todas',value:''},{label:'Compra',value:'COMPRA'},{label:'Servicio',value:'SERVICIO'}];
 propiedades=[{label:'Todas',value:''},{label:'Propio',value:'PROPIO'},{label:'Tercero',value:'TERCERO'}];
 get esExistencia(){return !this.reportes||this.tipo==='existencias';}
 get estados(){return this.esExistencia?['ACTIVO','AGOTADO','ANULADO']:['BORRADOR','CONFIRMADO','ANULADO'];}
 get titulo(){return this.reportes?this.reportesDisponibles.find(r=>r.value===this.tipo)?.label||'Reportes de producción':'Lotes y trazabilidad';}
 get columnas():{label:string;field:string}[]{return this.reportes?(this.resultado?.['columnas']||[]).map((label:string,i:number)=>({label,field:String(i)})):
 [{label:'Lote',field:'codigo'},{label:'Recepción',field:'fecha'},{label:'Boleta',field:'boleta'},{label:'Productor',field:'productor'},{label:'Propietario',field:'propietario'},
 {label:'Modalidad',field:'modalidad'},{label:'Variedad',field:'variedad'},{label:'Producto',field:'producto'},{label:'Inicial',field:'cantidad_inicial'},
 {label:'Disponible',field:'cantidad_disponible'},{label:'Unidad',field:'unidad'},{label:'Ubicación',field:'ubicacion'},{label:'Estado',field:'estado'}];}
 ngOnInit(){
  this.tipo=this.reportesDisponibles[0]?.value||'';this.orden=this.reportes?'0':'fecha';
  this.http.get<Datos>(apiUrl('/api/produccion/lotes/opciones')).pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>this.catalogos=r,error:e=>this.aviso.error(e,'No se pudieron cargar filtros de producción')});
  this.recargar.pipe(tap(()=>{this.cargando=true;this.error='';}),switchMap(()=>{
   const path=this.detalleId?'/lotes/'+this.detalleId:this.reportes?'/reportes/'+this.tipo:'/lotes';
   return this.http.get<Datos>(apiUrl('/api/produccion'+path),{params:this.params()}).pipe(catchError(e=>{this.error=this.aviso.error(e,'No se pudo cargar Producción').mensaje;return of(null);}));
  }),takeUntilDestroyed(this.destroy)).subscribe(r=>{if(this.detalleId)this.detalle=r;else this.resultado=r;this.cargando=false;});
  this.busqueda.pipe(debounceTime(350),takeUntilDestroyed(this.destroy)).subscribe(()=>{this.primero=0;this.recargar.next();});
  if(!this.reportes)this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(p=>{this.detalleId=p.get('id')?Number(p.get('id')):null;this.detalle=null;this.recargar.next();});
  else if(this.tipo)this.consultar();
 }
 fecha(d:Date|null){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:undefined;}
 params(){let p=new HttpParams();for(const[k,v]of Object.entries(this.query()))if(v!==undefined&&v!==null&&v!=='')p=p.set(k,String(v));return p;}
 query(){return {...this.aplicado,buscar:this.buscar.trim(),orden:this.reportes?'fecha':this.orden,columna:this.reportes?Number(this.orden):undefined,direccion:this.direccion,limit:this.filas,offset:this.primero};}
 consultar(){if(this.desde&&this.hasta&&this.desde>this.hasta){this.error='La fecha inicial no puede ser posterior a la final.';return;}
  this.aplicado={fecha_desde:this.fecha(this.desde),fecha_hasta:this.fecha(this.hasta),id_productor:this.productor,modalidad:this.modalidad,variedad:this.variedad,estado:this.estado,
   ...(this.esExistencia?{propiedad:this.propiedad,ubicacion:this.ubicacion,clasificacion:this.clasificacion,estado_fisico:this.fisico}:{})};this.primero=0;this.recargar.next();}
 cambiarReporte(){this.estado='';this.orden='0';this.resultado=null;this.consultar();}
 paginar(e:TableLazyLoadEvent){this.primero=e.first||0;this.filas=e.rows||10;this.orden=typeof e.sortField==='string'?e.sortField:this.reportes?'0':'fecha';this.direccion=e.sortOrder===1?1:-1;this.recargar.next();}
 numero(v:unknown){return v==null?'No medido':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(v));}
 celda(r:Datos,c:{field:string;label:string}){const v=this.reportes?r['valores'][Number(c.field)]:r[c.field];return typeof v==='number'||!this.reportes&&['cantidad_inicial','cantidad_disponible'].includes(c.field)?this.numero(v):v??'—';}
 esNumero(r:Datos,c:{field:string}){return this.reportes?typeof r['valores'][Number(c.field)]==='number':['cantidad_inicial','cantidad_disponible'].includes(c.field);}
 archivo(formato:'pdf'|'xlsx'){
  const p:ParamsExport={...this.query(),tipo:this.reportes?'reporte_produccion':'lotes_produccion',reporte:this.tipo,formato};
  const visor=formato==='pdf'?this.exportar.abrirVentanaEspera():null;
  (formato==='pdf'?this.exportar.mostrarPdf(p,visor):this.exportar.descargar(p)).pipe(takeUntilDestroyed(this.destroy)).subscribe({error:e=>{visor?.close();this.aviso.error(e,'No se pudo exportar');}});
 }
}
