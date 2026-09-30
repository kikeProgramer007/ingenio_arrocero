import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarEmpresaDTO {
    @IsNotEmpty({ message: 'El nombre comercial es obligatorio' })
    @IsString({ message: 'El nombre debe ser texto' })
    @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
    nombre!: string;

    @IsOptional()
    @IsString()
    @MaxLength(80, { message: 'El nombre corto no puede superar 80 caracteres' })
    nombre_corto?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150, { message: 'El slogan no puede superar 150 caracteres' })
    slogan?: string;

    @IsOptional()
    @IsString()
    @MaxLength(150, { message: 'El titular no puede superar 150 caracteres' })
    titular?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30, { message: 'El NIT no puede superar 30 caracteres' })
    nit?: string;

    @IsOptional()
    @IsString()
    @MaxLength(250, { message: 'La dirección no puede superar 250 caracteres' })
    direccion?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80, { message: 'El teléfono no puede superar 80 caracteres' })
    telefono?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80, { message: 'La ciudad no puede superar 80 caracteres' })
    ciudad?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120, { message: 'El correo no puede superar 120 caracteres' })
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    path_logo?: string;
}
