import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
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
import { TIPOS_COMPRA, TIPO_COMPRA } from '../constants/compra.constants';
import { MENSAJE_UNIDAD_MEDIDA } from '../utils/unidad-medida';

export class LineaCompraDTO {
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

    @IsOptional()
    @ValidateIf((_, value) => value != null && String(value).trim() !== '')
    @IsString()
    @MaxLength(20)
    @Matches(/^(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]+$/, { message: MENSAJE_UNIDAD_MEDIDA })
    unidad?: string;
}

export class CrearCompraDTO {
    @Type(() => Number)
    @IsInt({ message: 'El proveedor es obligatorio' })
    id_proveedor!: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El productor no es válido' })
    id_productor?: number;

    @IsOptional()
    @IsString()
    observacion?: string;

    @IsOptional()
    @IsString()
    @MaxLength(40)
    concepto?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe ser AAAA-MM-DD' })
    fecha?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    chofer?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    placa?: string;

    @IsOptional()
    @IsIn(TIPOS_COMPRA, { message: 'El tipo de compra no es válido' })
    tipo_compra?: string;

    @ValidateIf((o) => o.tipo_compra === TIPO_COMPRA.CHALA)
    @IsNotEmpty({ message: 'Indique el nro. de boleta de balanza' })
    @IsString()
    @MaxLength(40)
    boleta?: string;

    @ValidateIf((o) => o.tipo_compra === TIPO_COMPRA.CHALA)
    @Type(() => Number)
    @IsNumber({}, { message: 'Las fanegas deben ser numéricas' })
    @Min(0.001, { message: 'Indique las fanegas' })
    fanegas?: number;

    @ValidateIf((o) => o.tipo_compra === TIPO_COMPRA.CHALA)
    @Type(() => Number)
    @IsNumber({}, { message: 'El precio por fanega debe ser numérico' })
    @Min(0.01, { message: 'Indique el precio por fanega en USD' })
    precio_usd?: number;

    @ValidateIf((o) => o.tipo_compra === TIPO_COMPRA.CHALA || o.tipo_cambio != null)
    @Type(() => Number)
    @IsNumber({}, { message: 'El tipo de cambio debe ser numérico' })
    @Min(0.0001, { message: 'El tipo de cambio debe ser mayor a 0' })
    tipo_cambio?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    guardar_tipo_cambio_empresa?: boolean;

    @IsArray({ message: 'Debe enviar al menos una línea' })
    @ArrayMinSize(1, { message: 'Debe agregar al menos una línea' })
    @ValidateNested({ each: true })
    @Type(() => LineaCompraDTO)
    lineas!: LineaCompraDTO[];

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El plazo debe ser un número entero de días' })
    @Min(1, { message: 'El plazo debe ser de al menos 1 día' })
    @Max(365, { message: 'El plazo no puede superar 365 días' })
    plazo_dias?: number;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de vencimiento debe ser AAAA-MM-DD' })
    fecha_vencimiento?: string;

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

export class CrearPagoProveedorDTO {
    @Type(() => Number)
    @IsInt({ message: 'La compra es obligatoria' })
    id_compra!: number;

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
