import { DataTypes } from 'sequelize';
import sequelize from '../db/connection';
export const VERSION_CAMPOS_CONTROL='20261106-produccion-campos-control';
export async function up(){
 const qi=sequelize.getQueryInterface();
 for(const [table,column]of [['produccion_secados','proc'],['produccion_guardados','orden_guardado']]){
  const columns=await qi.describeTable(table);
  if(!columns[column])await qi.addColumn(table,column,{type:DataTypes.STRING(50),allowNull:true});
 }
 await sequelize.query('INSERT IGNORE INTO produccion_migraciones (version,aplicada_at) VALUES (:version,NOW())',{replacements:{version:VERSION_CAMPOS_CONTROL}});
}
