import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearClienteDTO {
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @IsString({ message: 'El nombre debe ser texto' })
    @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
    nombre!: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    nit_ci?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    telefono?: string;

    @IsOptional()
    @IsString()
    @MaxLength(250)
    direccion?: string;

    @IsOptional()
    @IsString()
    observacion?: string;

    @IsOptional()
    @IsBoolean({ message: 'Activo debe ser verdadero o falso' })
    activo?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    path_imagen?: string;
}

export class ActualizarClienteDTO extends CrearClienteDTO {}
