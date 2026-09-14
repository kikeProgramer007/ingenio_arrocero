// src/mapper/user/user.mapper.ts
import { AbstractMapper } from '../abstract.mapper';
import { UserDto, PerfilDto, ProgramaDto, PermisosDto } from '../../dtos/auth.response.dto';

export class AuthResponseMapper extends AbstractMapper<any, UserDto> {
  map(source: any): UserDto {
    const perfilRaw = source.perfil;

    if (!perfilRaw) {
      return {
        id: source.id,
        username: source.username,
        perfil: { id: 0, nombre: 'Sin perfil' },
        programas: []
      };
    }

    const perfil: PerfilDto = {
      id: perfilRaw.id,
      nombre: perfilRaw.nombre,
    };

    const programas: ProgramaDto[] = (perfilRaw.programas || [])
      .filter((p: any) => !p.eliminado)
      .map((p: any) => {
      const permsRaw = p.permisos || p.perfil_programas || {};
      const permisos: PermisosDto = {
        lectura: Boolean(permsRaw.permiso_lectura),
        escritura: Boolean(permsRaw.permiso_escritura),
        modificacion: Boolean(permsRaw.permiso_modificacion)
      };

      return {
        id: p.id,
        nombre: p.nombre_programa,
        url: p.url,
        classIcon: p.class_icon,
        esExpandible: p.es_expandible,
        nroPosicion: p.nro_posicion,
        permisos
      };
    });

    return {
      id: source.id,
      username: source.username,
      perfil,
      programas
    };
  }

  mapArray(sources: any[]): UserDto[] {
    return sources.map(src => this.map(src));
  }
}
