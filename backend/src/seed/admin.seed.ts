import bcrypt from 'bcrypt';
import { sequelize, User, Perfil } from '../models';

/** Inicializa el acceso solo cuando no existe ningun usuario. */
export async function seedAdmin(): Promise<void> {
    if (await User.count()) {
        return;
    }

    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!username || username.length > 255) {
        throw new Error('ADMIN_USERNAME debe tener entre 1 y 255 caracteres.');
    }
    if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Configura ADMIN_PASSWORD con al menos 12 caracteres y un maximo de 72 bytes.');
    }

    const hash = await bcrypt.hash(password, 10);
    const creado = await sequelize.transaction(async (transaction) => {
        if (await User.count({ transaction })) {
            return false;
        }
        const [perfil] = await Perfil.findOrCreate({
            where: { nombre: 'Administrador', eliminado: false },
            defaults: { nombre: 'Administrador', eliminado: false },
            transaction
        });
        await User.create({
            username,
            password: hash,
            nombre: 'Administrador',
            cargo: 'Administrador',
            id_perfil: perfil.get('id'),
            activo: true,
            eliminado: false
        }, { transaction });
        return true;
    });

    if (creado) {
        console.log(`[seed] Administrador creado: ${username}`);
    }
}
