import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { apiUrl } from '../../core/utils/api-url';
export type RutaEtapa = 'secados' | 'guardados' | 'procesados' | 'envasados';
export type DatosEtapa = Record<string, any>;
@Injectable({providedIn:'root'})
export class ProduccionEtapasService {
    constructor(private http: HttpClient) {}
    private base(ruta:RutaEtapa) {return apiUrl('/api/produccion/'+ruta);}
    private params(q:DatosEtapa) {let p=new HttpParams();for(const [k,v] of Object.entries(q)) if(v!=null&&v!=='')p=p.set(k,String(v));return p;}
    listar(r:RutaEtapa,q:DatosEtapa){return this.http.get<DatosEtapa>(this.base(r),{params:this.params(q)});}
    opciones(r:RutaEtapa,grupo:string,q='',id?:number){return this.http.get<DatosEtapa[]>(this.base(r)+'/opciones',{params:this.params({grupo,q,id})});}
    obtener(r:RutaEtapa,id:number){return this.http.get<DatosEtapa>(this.base(r)+'/'+id);}
    guardar(r:RutaEtapa,id:number|null,d:DatosEtapa){return id ? this.http.put<DatosEtapa>(this.base(r)+'/'+id,d):this.http.post<DatosEtapa>(this.base(r),d);}
    confirmar(r:RutaEtapa,id:number,version:number,clave_confirmacion:string){return this.http.post<DatosEtapa>(this.base(r)+'/'+id+'/confirmar',{version,clave_confirmacion});}
    anular(r:RutaEtapa,id:number,version:number,motivo:string){return this.http.post<DatosEtapa>(this.base(r)+'/'+id+'/anular',{version,motivo});}
}
