import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { AvisoService } from '../../shared/services/aviso.service';
import { ExportarService } from '../../shared/services/exportar.service';
import { DescarguiosService } from './descarguios.service';
import { ProduccionEtapasPage } from './produccion-etapas';
import { DatosEtapa, ProduccionEtapasService } from './produccion-etapas.service';
@Component({selector:'app-produccion-transformaciones',standalone:true,
    imports:[CommonModule,FormsModule,RouterModule,ButtonModule,DatePickerModule,InputTextModule,SelectModule,TableModule,TagModule,MultiSelectModule,SkeletonModule,MenuModule,TooltipModule,TablaEsqueletoComponent],templateUrl:'./produccion-transformaciones.html'})
export class ProduccionTransformacionesPage extends ProduccionEtapasPage {
    private life=inject(DestroyRef);private catalogo=inject(ProduccionEtapasService);private avisos=inject(AvisoService);
    get procesado(){return this.ruta==='procesados';}
    override get nombre(){return this.procesado?'procesado':'envasado';}
    override get titulo(){return this.procesado?'Control de procesados':'Control de envasados';}
    modalidad:string[]=[];presentacion:string[]=[];producto:number[]=[];productos:DatosEtapa[]=[];
    modalidades=[{label:'Arroz propio',value:'COMPRA'},{label:'Servicio a terceros',value:'SERVICIO'}];
    constructor(api:ProduccionEtapasService,desc:DescarguiosService,aviso:AvisoService,exportar:ExportarService){super(api,desc,aviso,exportar);}
    override consultar(){if(this.desde&&this.hasta&&this.desde>this.hasta){this.error='Desde no puede ser posterior a Hasta.';return;}
        const fecha=(d:Date|null)=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:undefined;
        this.aplicado={fecha_desde:fecha(this.desde),fecha_hasta:fecha(this.hasta),id_productor:this.productor?.join(','),variedad:this.variedad?.join(','),modalidad:this.modalidad?.join(','),estado:this.estado?.join(','),presentacion:this.presentacion?.join(','),id_producto:this.producto?.join(',')};this.primero=0;this.recargar.next();}
    get resultados():DatosEtapa[]{return this.resultado?.['resumen']?.resultados||[];}
}
