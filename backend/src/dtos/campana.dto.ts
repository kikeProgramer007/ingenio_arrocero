import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';
import { ESTADO_CAMPANA } from '../models/campana.model';

export class CrearCampanaDTO {
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @IsString()
    @MaxLength(150)
    nombre!: string;

    @IsNotEmpty({ message: 'La fecha de inicio es obligatoria' })
    @IsDateString({}, { message: 'La fecha de inicio no es válida' })
    fecha_inicio!: string;

    @IsOptional()
    @IsDateString({}, { message: 'La fecha de fin no es válida' })
    fecha_fin?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    meta_cantidad?: number;

    @IsOptional()
    @IsString()
    observacion?: string;
}

export class CerrarCampanaDTO {
    @IsOptional()
    @IsIn(Object.values(ESTADO_CAMPANA))
    estado?: string;
}

export class CrearAcopioDTO {
    @Type(() => Number)
    @IsInt({ message: 'La campaña es obligatoria' })
    id_campana!: number;

    @Type(() => Number)
    @IsInt({ message: 'El proveedor es obligatorio' })
    id_proveedor!: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    id_producto?: number;

    @IsNotEmpty()
    @IsString()
    @MaxLength(200)
    descripcion!: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0.001)
    cantidad!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    precio_unitario!: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    pago?: number;

    @ValidateIf((o) => Number(o.pago || 0) > 0)
    @IsNotEmpty({ message: 'El método de pago es obligatorio si hay un pago' })
    @IsIn(METODOS_PAGO)
    metodo_pago?: string;

    @IsOptional()
    @IsString()
    observacion?: string;
}

export class CrearProduccionDTO {
    @Type(() => Number)
    @IsInt({ message: 'El producto de origen es obligatorio' })
    id_producto_origen!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0.001)
    cantidad_entrada!: number;

    @Type(() => Number)
    @IsInt({ message: 'El producto de destino es obligatorio' })
    id_producto_destino!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0.001)
    cantidad_salida!: number;

    @IsOptional()
    @IsString()
    observacion?: string;
}
