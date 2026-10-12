import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearUsuarioDTO {
    @IsNotEmpty({ message: 'El usuario de acceso es obligatorio' })
    @IsString({ message: 'El usuario de acceso debe ser texto' })
    @MaxLength(50, { message: 'El usuario de acceso no puede superar 50 caracteres' })
    username!: string;

    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @MaxLength(80, { message: 'La contraseña no puede superar 80 caracteres' })
    password!: string;

    @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
    @IsString()
    @MaxLength(120, { message: 'El nombre completo no puede superar 120 caracteres' })
    nombre!: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    ci?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    telefono?: string;

    @IsOptional()
    @ValidateIf((_, value) => !!value)
    @IsEmail({}, { message: 'El correo no es válido' })
    @MaxLength(120)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    cargo?: string;

    @Type(() => Number)
    @IsInt({ message: 'El perfil es obligatorio' })
    id_perfil!: number;

    @IsOptional()
    @IsBoolean({ message: 'Activo debe ser verdadero o falso' })
    activo?: boolean;
}

export class ActualizarUsuarioDTO {
    @IsNotEmpty({ message: 'El usuario de acceso es obligatorio' })
    @IsString()
    @MaxLength(50, { message: 'El usuario de acceso no puede superar 50 caracteres' })
    username!: string;

    @IsOptional()
    @ValidateIf((_, value) => !!value)
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @MaxLength(80)
    password?: string;

    @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
    @IsString()
    @MaxLength(120)
    nombre!: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    ci?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    telefono?: string;

    @IsOptional()
    @ValidateIf((_, value) => !!value)
    @IsEmail({}, { message: 'El correo no es válido' })
    @MaxLength(120)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    cargo?: string;

    @Type(() => Number)
    @IsInt({ message: 'El perfil es obligatorio' })
    id_perfil!: number;

    @IsOptional()
    @IsBoolean({ message: 'Activo debe ser verdadero o falso' })
    activo?: boolean;
}
