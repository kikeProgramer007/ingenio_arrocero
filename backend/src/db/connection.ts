import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Dialect, Sequelize } from 'sequelize';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

function resolverRuta(relativa: string): string {
    if (path.isAbsolute(relativa)) {
        return relativa;
    }
    const desdeCwd = path.resolve(process.cwd(), relativa);
    if (fs.existsSync(desdeCwd)) {
        return desdeCwd;
    }
    return path.resolve(__dirname, '../../', relativa);
}

const host = (process.env.DB_HOST || 'localhost').trim();
const port = Number(process.env.DB_PORT || 3306);
const database = (process.env.DB_NAME || 'db_empresas').trim();
const username = (process.env.DB_USER || 'root').trim();
const password = process.env.DB_PASSWORD || '';
const caPath = process.env.DB_CA?.trim();

const dialectOptions: Record<string, unknown> = {
    connectTimeout: 20000
};

if (caPath) {
    const rutaCa = resolverRuta(caPath);
    dialectOptions.ssl = {
        minVersion: 'TLSv1.2',
        ca: fs.readFileSync(rutaCa)
    };
} else if ((process.env.DB_SSL || '').toLowerCase() === 'true') {
    dialectOptions.ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    };
}

const sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql' as Dialect,
    logging: false,
    dialectOptions,
    timezone: '-04:00',
    pool: {
        max: 5,
        min: 0,
        acquire: 20000,
        idle: 10000
    }
});

export default sequelize;
