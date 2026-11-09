import '../load-env';
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {randomUUID} from 'crypto';
import {QueryTypes, Transaction} from 'sequelize';
import {sequelize, User, Productos, Proveedor} from '../models';
import {listarTransformacion, opcionesTransformacion, hojaTransformacion} from '../servicios/produccion-transformaciones-consulta.servicio';
import {obtenerTransformacion} from '../servicios/produccion-transformaciones.servicio';
import {bufferReportePdf} from '../utils/exportar';
async function insert(table:string,data:Record<string,any>,t:Transaction){const keys=Object.keys(data),[id]=await sequelize.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k=>':'+k).join(',')})`,{replacements:data,type:QueryTypes.INSERT,transaction:t});return Number(id);}
async function main(){
    if(process.env.NODE_ENV!=='development')throw new Error('Solo en desarrollo.');await sequelize.authenticate();const t=await sequelize.transaction();
    try{
        const u=await User.findOne({where:{activo:true,eliminado:false},transaction:t});assert(u);const uid=Number(u.get('id')),mark=randomUUID().slice(0,8);
        const p=await Proveedor.create({nombre:'PRODUCTOR DE PRUEBA '+mark+' CON NOMBRE EXTENSO PARA VALIDAR CONTINUIDAD DE CELDAS Y SALTOS DE PAGINA',activo:true},{transaction:t}),pid=Number(p.get('id'));
        const a=await Productos.create({nombre:'CHALA DE PRUEBA '+mark,unidad_medida:'Kilo'},{transaction:t}),b=await Productos.create({nombre:'ARROZ ENTERO DE PRUEBA '+mark,unidad_medida:'Quintal'},{transaction:t}),bag=await Productos.create({nombre:'BOLSA VACIA PRUEBA '+mark,unidad_medida:'Unidad',stock:20},{transaction:t}),dest=await Productos.create({nombre:'ARROZ ENVASADO PRUEBA '+mark,unidad_medida:'Unidad'},{transaction:t});
        const op=async(tipo:string)=>insert('produccion_operaciones',{codigo:tipo+'-PRUEBA-'+mark,tipo,fecha:new Date('2026-11-05T18:00:00Z'),estado:'CONFIRMADO',modalidad:'SERVICIO',id_propietario:pid,id_productor:pid,id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
        const g=await op('GUARDADO'),pr=await op('PROCESADO'),e=await op('ENVASADO');
        const lot=async(o:number,product:number,unit:string,qty:number,etapa:string)=>insert('produccion_lotes',{codigo:'LOTE-PRUEBA-'+etapa+'-'+mark,id_operacion_origen:o,id_producto:product,modalidad:'SERVICIO',id_propietario:pid,id_productor:pid,variedad:'MAC-18',cantidad_inicial:qty,cantidad_disponible:qty,unidad:unit,etapa,estado_fisico:etapa==='GUARDADO'?'CHALA_SECA':etapa,estado:'ACTIVO',id_usuario:uid,version:0,created_at:new Date(),updated_at:new Date()},t);
        const source=await lot(g,Number(a.get('id')),'Kilo',1000,'GUARDADO'),result=await lot(pr,Number(b.get('id')),'Quintal',10,'PROCESADO');
        await insert('produccion_procesados',{id_operacion:pr,peso_entrada_kg:1000,peso_salida_kg:600},t);
        await insert('produccion_etapa_origenes',{id_operacion:pr,id_lote:source,cantidad:1000},t);
        await insert('produccion_procesado_detalles',{id_operacion:pr,id_producto:b.get('id'),id_lote_resultado:result,clasificacion:'Entero de prueba',cantidad:10,unidad:'Quintal',peso_real_kg:600},t);
        await insert('produccion_envasados',{id_operacion:e,id_producto_empaque:bag.get('id'),id_producto_destino:dest.get('id'),presentacion:'Presentación de prueba',numero_bolsas:2,contenido_bolsa_kg:46,peso_total_kg:92,cantidad_destino:2,unidad_destino:'Unidad'},t);
        await insert('produccion_etapa_origenes',{id_operacion:e,id_lote:result,cantidad:2},t);
        const q={id_productor:pid,estado:'CONFIRMADO',limit:100};
        const listado=await listarTransformacion('PROCESADO',q,t);assert.equal(listado.total,1);assert.equal(listado.resumen.rendimiento,60);
        const origins=await opcionesTransformacion('ENVASADO',{grupo:'lotes',id:result},t);assert.equal(origins[0].clasificacion,'Entero de prueba');
        assert.equal((await obtenerTransformacion('ENVASADO',e,t)).origenes[0].clasificacion,'Entero de prueba');
        const bolsas=await opcionesTransformacion('ENVASADO',{grupo:'empaques',q:mark},t);assert.equal(bolsas.length,1);assert.equal(Number(bolsas[0].id),Number(bag.get('id')));
        const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-transformaciones-pdf-final-'));
        for(const tipo of ['PROCESADO','ENVASADO'] as const){
            const hoja=await hojaTransformacion(tipo,q,'pdf',t);assert(hoja.consulta?.some(c=>c.label==='Proveedor'&&c.valor.includes(mark)));
            assert(!hoja.columnas.some(c=>c.includes('(Bs)')),'Los pesos no son importes monetarios');
            hoja.filas=Array.from({length:tipo==='PROCESADO'?14:5},(_,i)=>hoja.filas[0].map((v,j)=>j===0?i+1:v));
            const pdf=await bufferReportePdf([hoja]),file=path.join(dir,tipo.toLowerCase()+'.pdf');fs.writeFileSync(file,pdf.buffer);console.log(JSON.stringify({tipo,archivo:file,paginas:pdf.paginas}));
        }
        console.log(JSON.stringify({rendimientoPonderado:'OK',clasificacionRecuperada:'OK',catalogoEmpaques:'OK',filtrosHumanosYPesosPDF:'OK'}));
    }finally{await t.rollback();}
    console.log('Fixtures de consulta revertidos; sin registros de prueba persistidos.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sequelize.close());
