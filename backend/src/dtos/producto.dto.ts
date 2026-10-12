import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { MENSAJE_UNIDAD_MEDIDA } from '../utils/unidad-medida';

export class CrearProductoDTO {
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @IsString()
    @MaxLength(150)
    nombre!: string;

    @IsOptional()
    @IsString()
    descripcion?: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de venta debe ser numérico' })
    @Min(0)
    precio_venta!: number;

    @Type(() => Number)
    @IsNumber({}, { message: 'El precio de compra debe ser numérico' })
    @Min(0)
    precio_compra!: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    stock?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    stock_minimo?: number;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    @ValidateIf((_, value) => value != null && String(value).trim() !== '')
    @Matches(/^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/, { message: MENSAJE_UNIDAD_MEDIDA })
    unidad_medida?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    path_imagen?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    id_categoria?: number;
}

export class AjusteStockDTO {
    @Type(() => Number)
    @IsNumber({}, { message: 'La cantidad debe ser numérica' })
    cantidad!: number;

    @IsOptional()
    @IsString()
    observacion?: string;
}
