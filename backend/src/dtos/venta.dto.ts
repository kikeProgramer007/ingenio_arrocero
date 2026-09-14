import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested
} from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';

export class LineaVentaDTO {
    @IsNotEmpty({ message: 'La descripción es obligatoria' })
    @IsString()
    @MaxLength(200)
    descripcion!: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'La cantidad debe ser numérica' })
    @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
    cantidad!: number;

    @Type(() => Number)
    @IsNumber({}, { message: 'El precio unitario debe ser numérico' })
    @Min(0, { message: 'El precio unitario no puede ser negativo' })
    precio_unitario!: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    id_producto?: number;
}

export class CrearVentaDTO {
    @Type(() => Number)
    @IsInt({ message: 'El cliente es obligatorio' })
    id_cliente!: number;

    @IsOptional()
    @IsString()
    observacion?: string;

    @IsArray({ message: 'Debe enviar al menos una línea' })
    @ArrayMinSize(1, { message: 'Debe agregar al menos una línea' })
    @ValidateNested({ each: true })
    @Type(() => LineaVentaDTO)
    lineas!: LineaVentaDTO[];

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El pago inicial debe ser numérico' })
    @Min(0, { message: 'El pago inicial no puede ser negativo' })
    pago_inicial?: number;

    @ValidateIf((o) => Number(o.pago_inicial || 0) > 0)
    @IsNotEmpty({ message: 'El método de pago es obligatorio si hay un pago inicial' })
    @IsIn(METODOS_PAGO, { message: 'El método de pago no es válido' })
    metodo_pago?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    referencia?: string;
}

export class CrearCobranzaDTO {
    @Type(() => Number)
    @IsInt({ message: 'La venta es obligatoria' })
    id_venta!: number;

    @Type(() => Number)
    @IsNumber({}, { message: 'El monto debe ser numérico' })
    @Min(0.01, { message: 'El monto debe ser mayor a 0' })
    monto!: number;

    @IsNotEmpty({ message: 'El método de pago es obligatorio' })
    @IsIn(METODOS_PAGO, { message: 'El método de pago no es válido' })
    metodo_pago!: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    referencia?: string;

    @IsOptional()
    @IsString()
    observacion?: string;
}
