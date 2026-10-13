import { APP_RUTAS, PROGRAMAS_SEED } from '../constants/app-rutas';
import { Despacho, Perfil, PerfilProgramas, Programas, ReservaProducto, ReservaVenta, VentaEntrega } from '../models';

export async function up(): Promise<void> {
    for (const modelo of [VentaEntrega, ReservaProducto, ReservaVenta, Despacho]) {
        await modelo.sync({ force: false, alter: false });
    }
    const programa = PROGRAMAS_SEED.find(p => p.url === APP_RUTAS.DESPACHOS)!;
    const [registro] = await Programas.findOrCreate({ where: { url: programa.url }, defaults: programa });
    for (const perfil of await Perfil.findAll()) {
        await PerfilProgramas.findOrCreate({
            where: { id_perfil: perfil.get('id'), id_programa: registro.get('id') },
            defaults: { id_perfil: perfil.get('id'), id_programa: registro.get('id'), permiso_lectura: true, permiso_escritura: true, permiso_modificacion: false }
        });
    }
}
