// src/dtos/user.dto.ts

export class PermisosDto {
    lectura!: boolean;
    escritura!: boolean;
    modificacion!: boolean;
  }
  
  export class ProgramaDto {
    id!: number;
    nombre!: string;
    url!: string | null;
    classIcon!: string | null;
    esExpandible!: boolean;
    nroPosicion!: number;
    permisos!: PermisosDto;
  }
  
  export class PerfilDto {
    id!: number;
    nombre!: string;
  }
  
  export class UserDto {
    id!: number;
    username!: string;
    perfil!: PerfilDto;
    programas!: ProgramaDto[];
  }
  