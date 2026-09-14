import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UserDto {
    id!: number;
    @IsNotEmpty({ message: 'El grupo es obligatorio' })
    username!: string;
    password!: string;
    id_perfil!: number;
    perfil!: PerfilDto | null;
}

export class PerfilDto {
    nombre: string;
    constructor(perfil: any) {
        this.nombre = perfil.nombre;
    }
}
