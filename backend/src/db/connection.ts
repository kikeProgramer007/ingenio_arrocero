import { Sequelize } from "sequelize";


const sequelize = new Sequelize('db_empresas', 'root', 'root', {
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
        connectTimeout: 10000
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 10000,
        idle: 10000
    }
});

export default sequelize;