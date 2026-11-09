import '../load-env';
import sequelize from '../db/connection';
import {assertBaseDeUsuario} from '../utils/db-sync';
import {up, VERSION_CAMPOS_CONTROL} from '../migrations/20261106-produccion-campos-control';
(async()=>{assertBaseDeUsuario(sequelize.getDatabaseName());await sequelize.authenticate();await up();console.log(JSON.stringify({base:sequelize.getDatabaseName(),migracion:VERSION_CAMPOS_CONTROL,campos:['Secado: Proc.','Guardado: O']}));})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>sequelize.close());
