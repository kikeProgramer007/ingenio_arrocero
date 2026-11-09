import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { Menu, MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService, ParamsExport } from '../../shared/services/exportar.service';
import { DescarguiosService, OpcionDescarguio } from './descarguios.service';
import { DatosEtapa, ProduccionEtapasService, RutaEtapa } from './produccion-etapas.service';
import { permisoEtapa } from './produccion-permisos';

@Component({selector:'app-produccion-etapas',standalone:true,
    imports:[CommonModule,FormsModule,RouterModule,ButtonModule,DatePickerModule,InputTextModule,SelectModule,TableModule,TagModule,MultiSelectModule,SkeletonModule,MenuModule,TooltipModule,TablaEsqueletoComponent],
    templateUrl:'./produccion-etapas.html'})
export class ProduccionEtapasPage implements OnInit {
    private destroy=inject(DestroyRef);
    private router=inject(Router);
    ruta:RutaEtapa=inject(ActivatedRoute).snapshot.data['etapa'];
    get secado(){return this.ruta==='secados';}
    get nombre():string{return this.secado?'secado':'guardado';}
    get titulo():string{return this.secado?'Control de secados':'Control de guardados';}
    puedeCrear=permisoEtapa(this.ruta,'escritura'); puedeEditar=permisoEtapa(this.ruta,'modificacion');
    desde:Date|null=null;hasta:Date|null=null;productor:number[]=[];productores:OpcionDescarguio[]=[];
    variedad:string[]=[];equipo:string[]=[];ubicacion:string[]=[];estado:string[]=[];catalogos:DatosEtapa={};cargandoFiltros=true;buscar='';aplicado:DatosEtapa={};
    estados=[{label:'Borrador',value:'BORRADOR'},{label:'Confirmado',value:'CONFIRMADO'},{label:'Anulado',value:'ANULADO'}];
    resultado:DatosEtapa|null=null;cargando=false;error='';primero=0;filas=10;orden='fecha';direccion=-1;
    recargar=new Subject<void>();buscarCambios=new Subject<void>();
    itemsAcciones:MenuItem[]=[];
    constructor(private api:ProduccionEtapasService,private desc:DescarguiosService,private aviso:AvisoService,private exportar:ExportarService){}
    ngOnInit(){
        this.recargar.pipe(tap(()=>{this.cargando=true;this.error='';}),switchMap(()=>this.api.listar(this.ruta,this.query()).pipe(catchError(e=>{this.error=this.aviso.error(e,'No se pudo cargar la consulta').mensaje;return of(null);}))),takeUntilDestroyed(this.destroy))
            .subscribe(r=>{this.resultado=r;this.cargando=false;});
        this.buscarCambios.pipe(debounceTime(350),takeUntilDestroyed(this.destroy)).subscribe(()=>{this.primero=0;this.recargar.next();});
        this.api.filtros().pipe(takeUntilDestroyed(this.destroy)).subscribe({next:r=>{this.catalogos=r;this.productores=r['productores'];this.cargandoFiltros=false;},error:e=>{this.cargandoFiltros=false;this.aviso.error(e,'No se pudieron cargar los filtros');}});
        this.consultar();
    }
    private date(d:Date|null){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:undefined;}
    consultar(){if(this.desde&&this.hasta&&this.desde>this.hasta){this.error='Desde no puede ser posterior a Hasta.';return;}
        this.aplicado={fecha_desde:this.date(this.desde),fecha_hasta:this.date(this.hasta),id_productor:this.productor?.join(','),variedad:this.variedad?.join(','),secadora:this.equipo?.join(','),ubicacion:this.ubicacion?.join(','),estado:this.estado?.join(',')};this.primero=0;this.recargar.next();}
    query(){return {...this.aplicado,buscar:this.buscar.trim(),orden:this.orden,direccion:this.direccion,limit:this.filas,offset:this.primero};}
    paginar(e:TableLazyLoadEvent){this.primero=e.first||0;this.filas=e.rows||10;this.orden=typeof e.sortField==='string'?e.sortField:'fecha';this.direccion=e.sortOrder===1?1:-1;this.recargar.next();}
    numero(v:unknown){return v==null?'—':new Intl.NumberFormat('es-BO',{maximumFractionDigits:3}).format(Number(v));}
    get totales():DatosEtapa[]{return (this.resultado?.['resumen']?.cantidades||[]).filter((r:DatosEtapa)=>r['estado']==='CONFIRMADO'&&r['unidad']);}
    archivo(formato:'pdf'|'xlsx'){
        const params:ParamsExport={...this.aplicado,tipo:this.ruta,formato,q:this.buscar.trim(),orden:this.orden,direccion:this.direccion};
        const visor=formato==='pdf'?this.exportar.abrirVentanaEspera():null;
        const request=formato==='pdf'?this.exportar.mostrarPdf(params,visor):this.exportar.descargar(params);
        request.pipe(takeUntilDestroyed(this.destroy)).subscribe({error:e=>{visor?.close();this.aviso.error(e,'No se pudo generar el documento');}});
    }
    abrirAcciones(event:Event, menu:Menu, fila:DatosEtapa){
        const editar=fila['estado']==='BORRADOR'&&this.puedeEditar;
        this.itemsAcciones=[{
            label:editar?'Editar':'Ver detalle',
            icon:editar?'pi pi-pencil':'pi pi-eye',
            iconStyle:{color:'#3b82f6'},
            command:()=>this.router.navigate(['/produccion',this.ruta,fila['id']])
        }];
        if(this.secado){
            this.itemsAcciones.push({
                label:'Ver documento',
                icon:'pi pi-file-pdf',
                iconStyle:{color:'#ef4444'},
                command:()=>this.verDocumento(fila)
            });
        }
        if(fila['estado']!=='ANULADO'&&this.puedeEditar){
            this.itemsAcciones.push({
                label:'Anular',
                icon:'pi pi-ban',
                iconStyle:{color:'#ef4444'},
                command:()=>this.router.navigate(['/produccion',this.ruta,fila['id']],{queryParams:{anular:1}})
            });
        }
        menu.toggle(event);
    }
    verDocumento(fila:DatosEtapa){
        const ventana=this.exportar.abrirVentanaEspera(`Control de secado ${fila['codigo']||''}...`);
        this.exportar.mostrarPdf({tipo:'secado',formato:'pdf',id:fila['id']},ventana).subscribe({error:e=>this.aviso.error(e,'No se pudo generar el documento')});
    }
}
