// src/mapper/usuario/user.mapper.ts
import { AbstractMapper } from '../abstract.mapper';
import { PerfilDto, UserDto } from '../../dtos/user.dto';


export class UserMapper extends AbstractMapper<any, UserDto> {
  map(source: any): UserDto {
    return {
      id: source.id,
      username: source.username,
      password: source.password,
      id_perfil: source.id_perfil,
      perfil: source.perfil ? new PerfilDto(source.perfil) : null,
    };
  }

  mapArray(sources: any[]): UserDto[] {
    return sources.map((source) => this.map(source));
  }
}
