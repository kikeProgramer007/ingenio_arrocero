import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from '../db/connection';
import { VERSION_ETAPAS } from './20261105-produccion-secados-guardados';
export const VERSION_TRANSFORMACIONES = '20261105-produccion-transformaciones';
export async function up() {
    const qi=sequelize.getQueryInterface();
    if (!(await sequelize.query('SELECT version FROM produccion_migraciones WHERE version = :v',{replacements:{v:VERSION_ETAPAS},type:QueryTypes.SELECT})).length) throw new Error('Ejecute primero migrate:secados-guardados.');
    const ref=(model:string):any=>({type:DataTypes.INTEGER,allowNull:true,references:{model,key:'id'},onDelete:'RESTRICT',onUpdate:'CASCADE'});
    const additions:Record<string,Record<string,any>>={
        produccion_procesados:{id_ubicacion:ref('produccion_ubicaciones'),destino_nombre:{type:DataTypes.STRING(150),allowNull:true},ubicacion_detalle:{type:DataTypes.STRING(200),allowNull:true}},
        produccion_envasados:{destino_nombre:{type:DataTypes.STRING(150),allowNull:true},ubicacion_detalle:{type:DataTypes.STRING(200),allowNull:true},cantidad_destino:{type:DataTypes.DECIMAL(18,3).UNSIGNED,allowNull:true},unidad_destino:{type:DataTypes.STRING(30),allowNull:true},equivalencia_kg_destino:{type:DataTypes.DECIMAL(18,6).UNSIGNED,allowNull:true}}
    };
    for(const [table,columns] of Object.entries(additions)) {const existing=await qi.describeTable(table);for(const [name,definition] of Object.entries(columns)) if(!existing[name])await qi.addColumn(table,name,definition);}
    const nullable:Record<string,Record<string,any>>={
        produccion_procesado_detalles:{id_producto:{type:DataTypes.INTEGER,allowNull:true},unidad:{type:DataTypes.STRING(30),allowNull:true}},
        produccion_envasados:{id_producto_empaque:{type:DataTypes.INTEGER,allowNull:true},id_producto_destino:{type:DataTypes.INTEGER,allowNull:true},presentacion:{type:DataTypes.STRING(150),allowNull:true},numero_bolsas:{type:DataTypes.INTEGER.UNSIGNED,allowNull:true},contenido_bolsa_kg:{type:DataTypes.DECIMAL(18,3).UNSIGNED,allowNull:true},peso_total_kg:{type:DataTypes.DECIMAL(18,3).UNSIGNED,allowNull:true}}
    };
    for(const [table,columns] of Object.entries(nullable)){const existing=await qi.describeTable(table);for(const [name,definition] of Object.entries(columns))if(!existing[name].allowNull)await qi.changeColumn(table,name,definition);}
    const tables=(await qi.showAllTables()).map(String);
    if(!tables.includes('produccion_inventario_vinculos'))await qi.createTable('produccion_inventario_vinculos',{
        id:{type:DataTypes.INTEGER,primaryKey:true,autoIncrement:true,allowNull:false},id_operacion:{...ref('produccion_operaciones'),allowNull:false},
        id_movimiento:{...ref('movimientos_inventario'),allowNull:false,unique:true},id_movimiento_reverso:{...ref('movimientos_inventario'),unique:true}
    });
    await sequelize.query('INSERT IGNORE INTO produccion_migraciones (version,aplicada_at) VALUES (:v,NOW())',{replacements:{v:VERSION_TRANSFORMACIONES}});
}
