import { Op } from 'sequelize';
import { PROGRAMAS_SEED } from '../constants/app-rutas';
import Perfil from '../models/perfil.model';
import PerfilProgramas from '../models/perfil_programas.model';
import Programas from '../models/programas.model';

const URLS_VALIDAS: string[] = PROGRAMAS_SEED.map((item) => item.url);

export async function seedProgramasCaja(): Promise<void> {
    const programasCreados = [];

    for (const programa of PROGRAMAS_SEED) {
        const [registro] = await Programas.findOrCreate({
            where: { url: programa.url },
            defaults: programa
        });

        await registro.update({
            nombre_programa: programa.nombre_programa,
            class_icon: programa.class_icon,
            es_expandible: programa.es_expandible,
            nro_posicion: programa.nro_posicion,
            eliminado: false
        });

        programasCreados.push(registro);
    }

    const perfiles = await Perfil.findAll();
    for (const perfil of perfiles) {
        const idPerfil = perfil.get('id') as number;
        for (const programa of programasCreados) {
            const idPrograma = programa.get('id') as number;
            await PerfilProgramas.findOrCreate({
                where: {
                    id_perfil: idPerfil,
                    id_programa: idPrograma
                },
                defaults: {
                    id_perfil: idPerfil,
                    id_programa: idPrograma,
                    permiso_lectura: true,
                    permiso_escritura: true,
                    permiso_modificacion: true
                }
            });
        }
    }

    const programasObsoletos = await Programas.findAll({
        where: {
            [Op.or]: [
                { url: { [Op.notIn]: URLS_VALIDAS } },
                { url: { [Op.is]: null } }
            ]
        }
    });

    for (const programa of programasObsoletos) {
        const url = programa.get('url') as string | null;
        if (url && URLS_VALIDAS.includes(url)) {
            continue;
        }
        await PerfilProgramas.destroy({ where: { id_programa: programa.get('id') } });
        await programa.destroy();
    }
}
