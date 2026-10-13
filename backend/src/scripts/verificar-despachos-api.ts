import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { sequelize, User } from '../models';
import { getJwtSecret } from '../utils/jwt';

async function main() {
    const usuario = await User.findOne({ where: { activo: true, eliminado: false }, attributes: ['id', 'username', 'nombre'] });
    if (!usuario) throw new Error('No hay usuario activo para verificar el API de desarrollo');
    const token = jwt.sign({ id: usuario.get('id'), username: usuario.get('username') }, getJwtSecret(), { expiresIn: process.argv.includes('--browser-state') ? '15m' : '5m' });
    if (process.argv.includes('--browser-state')) {
        const dir = path.resolve(__dirname, '../../tmp/despachos-verificacion');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'browser-state.state'), JSON.stringify({ cookies: [], origins: [{
            origin: 'http://127.0.0.1:4201', localStorage: [
                { name: 'token', value: token },
                { name: 'user', value: JSON.stringify({ id: usuario.get('id'), username: usuario.get('username'), nombre: usuario.get('nombre') }) },
                { name: 'userMenu', value: JSON.stringify([{ id: 1, nombre: 'Despachos', url: '/despachos', classIcon: 'pi pi-truck' }]) }
            ]
        }] }));
        console.log('Sesion de verificacion local creada con vencimiento de 15 minutos.');
    }
    const base = process.env.TEST_API_URL || 'http://127.0.0.1:3001';
    for (const ruta of ['/api/despachos/config', '/api/despachos?estado_despacho=ABIERTOS&limite=10', '/api/ventas', '/api/productos', '/api/despachos/exportar?estado_despacho=TODOS&formato=pdf', '/api/despachos/exportar?estado_despacho=TODOS&formato=xlsx']) {
        const respuesta = await (globalThis as any).fetch(base + ruta, { headers: { Authorization: 'Bearer ' + token } });
        if (!respuesta.ok) throw new Error(ruta + ': HTTP ' + respuesta.status);
        const tipo = respuesta.headers.get('content-type') || '';
        if (tipo.includes('json')) {
            const body = await respuesta.json();
            console.log(JSON.stringify({ ruta, status: respuesta.status, ...(ruta.includes('/config') ? body : { registros: Array.isArray(body) ? body.length : body.total }) }));
        } else {
            const bytes = Buffer.from(await respuesta.arrayBuffer());
            console.log(JSON.stringify({ ruta, status: respuesta.status, tipo, bytes: bytes.length }));
        }
    }
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; }).finally(() => sequelize.close());
