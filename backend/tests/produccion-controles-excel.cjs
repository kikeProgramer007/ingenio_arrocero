const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {proyectarControl,libroControlOriginal,columnasOriginales}=require('../dist/servicios/produccion-controles-excel.servicio');
(async()=>{
const base={id:1,codigo:'G-01',fecha:'2026-02-24T16:00:00Z',estado:'CONFIRMADO',modalidad:'SERVICIO',productor:'RUBEN ORELLANA',cantidad:100,unidad:'Fanega',variedad:'MAC-18'};
const origins=[{id:11,id_operacion:1,id_lote:3,lote:'L-S1',cantidad:60},{id:12,id_operacion:1,id_lote:4,lote:'L-S2',cantidad:40}];
const ancestors=origins.flatMap((e,i)=>[{raiz:e.id,tipo:'DESCARGUIO',codigo:'D-0'+i,boleta:'P-41484'+i,impurezas_entrada:4.4,impurezas_salida:3.8},{raiz:e.id,tipo:'SECADO',codigo:'S-0'+i,humedad_entrada:18.5,humedad_salida:11.3}]);
const g=proyectarControl('guardados',[base],origins,ancestors,[]);
assert.equal(g.filas.length,2);assert.equal(g.filas.reduce((n,r)=>n+r[8],0),100);assert.equal(g.totales[0][1],100);assert.equal(g.filas[0][11],4.4);assert.equal(g.filas[0][12],3.8);assert.equal(g.filas[0][4],null);
const s=proyectarControl('secados',[{...base,inicio:'2026-02-21T15:05:00Z',fin:'2026-02-22T06:32:00Z',duracion:927}],origins,ancestors,[]);
assert.equal(s.filas[0][6],665/1440);assert.equal(s.filas[0][8],152/1440);assert.equal(s.detalle[0][18],927);
const p=proyectarControl('procesados',[{...base,resultados:[{producto:'Entero',clasificacion:'Entero',cantidad:10,unidad:'Quintal'},{producto:'Granillo',clasificacion:'Granillo',cantidad:2,unidad:'Quintal'},{producto:'Afrecho',clasificacion:'Afrecho',cantidad:3,unidad:'Kilo'}],resumen:{rendimiento:null}}],origins,ancestors,[]);
assert.equal(p.filas[0][8],'10 Quintal');assert.equal(p.filas[0][12],'12 Quintal\n3 Kilo');assert.equal(p.filas[0][13],null);assert.equal(p.detalle.length,5);assert.equal(p.totales.length,3);
for(const tipo of Object.keys(columnasOriginales)){
 const rows=Array.from({length:65},(_,i)=>({...base,id:i+1,codigo:'D-'+i,boleta:'P-'+i,productor:i%2?'RUBEN ORELLANA':'FILIBERTO CHAVEZ',resultados:[{clasificacion:'Entero',cantidad:2,unidad:'Quintal'}]}));
 const data=proyectarControl(tipo,rows,[],[],[{label:'Desde',valor:'2026-02-01'}]);
 const wb=libroControlOriginal(data),buffer=await wb.xlsx.writeBuffer();assert.equal(buffer[0],80);assert.equal(buffer[1],75);
 const reloaded=new ExcelJS.Workbook();await reloaded.xlsx.load(buffer);
 const ws=reloaded.worksheets[0],hr=tipo==='descarguios'?4:3;assert.deepEqual(ws.getRow(hr).values.slice(1),columnasOriginales[tipo]);assert.equal(ws.getRow(hr+1).getCell(1).value,'D-0');assert.equal(ws.getRow(hr+65).getCell(1).value,'D-64');assert(ws.autoFilter);assert.equal(ws.pageSetup.printTitlesRow,'1:'+hr);assert(ws.pageSetup.printArea);assert.equal(reloaded.worksheets.length,1);
 assert.equal(reloaded.worksheets[0].getRow(hr+1).getCell(tipo==='descarguios'?2:tipo==='secados'?3:tipo==='guardados'?4:8).value instanceof Date,true);
 const empty=libroControlOriginal(proyectarControl(tipo,[],[],[],[]));await empty.xlsx.writeBuffer();
 console.log(tipo+': XLSX, 65 filas, fechas, orden, filtros Excel, impresión y vacíos OK');
}
console.log('Orígenes parciales sin duplicación, impurezas heredadas, cruce de medianoche, unidades mixtas y otros productos OK. Sin escrituras en base de datos.');
})().catch(e=>{console.error(e);process.exitCode=1});
