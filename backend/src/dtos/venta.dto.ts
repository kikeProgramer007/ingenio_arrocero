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
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateIf,
    ValidateNested
} from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';

export class LineaVentaDTO {
    @ValidateIf((o) => !o.id_producto)
    @IsNotEmpty({ message: 'Indique un producto o una descripción' })
    @IsString()
    @MaxLength(200)
    descripcion?: string;

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

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El plazo debe ser un número entero de días' })
    @Min(1, { message: 'El plazo debe ser de al menos 1 día' })
    @Max(365, { message: 'El plazo no puede superar 365 días' })
    plazo_dias?: number;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de vencimiento debe ser AAAA-MM-DD' })
    fecha_vencimiento?: string;

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

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El monto en efectivo debe ser numérico' })
    @Min(0, { message: 'El monto en efectivo no puede ser negativo' })
    monto_efectivo?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El monto QR debe ser numérico' })
    @Min(0, { message: 'El monto QR no puede ser negativo' })
    monto_qr?: number;
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

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El monto en efectivo debe ser numérico' })
    @Min(0, { message: 'El monto en efectivo no puede ser negativo' })
    monto_efectivo?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'El monto QR debe ser numérico' })
    @Min(0, { message: 'El monto QR no puede ser negativo' })
    monto_qr?: number;
}
