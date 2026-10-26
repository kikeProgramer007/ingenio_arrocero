import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';
import { CONDICION_GASTO, CONDICIONES_GASTO } from '../constants/gasto.constants';
import { TIPOS_GASTO } from '../models/gasto.model';

/** Un gasto a crédito no sale de caja: no se pide método de pago. */
function descuentaCaja(o: CrearGastoDTO): boolean {
    if (o.tipo === 'RETIRO_PERSONAL') {
        return false;
    }
    if (o.condicion === CONDICION_GASTO.CREDITO) {
        return false;
    }
    return true;
}

function toBoolean(value: unknown): boolean | undefined {
    if (value === false || value === 'false' || value === 0 || value === '0') {
        return false;
    }
    if (value === true || value === 'true' || value === 1 || value === '1') {
        return true;
    }
    return undefined;
}

export class CrearGastoDTO {
    @IsNotEmpty({ message: 'El tipo es obligatorio' })
    @IsIn(TIPOS_GASTO, { message: 'El tipo debe ser GASTO_EMPRESA o RETIRO_PERSONAL' })
    tipo!: string;

    @IsNotEmpty({ message: 'El concepto es obligatorio' })
    @IsString()
    @MaxLength(200)
    concepto!: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    categoria?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    id_beneficiario?: number;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    persona?: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'El monto debe ser numérico' })
    @Min(0.01, { message: 'El monto debe ser mayor a 0' })
    monto!: number;

    @IsOptional()
    @IsIn(CONDICIONES_GASTO, { message: 'La condición debe ser CONTADO o CREDITO' })
    condicion?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'El plazo debe ser un número de días' })
    @Min(1, { message: 'El plazo debe ser mayor a 0' })
    plazo_dias?: number;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de vencimiento debe ser AAAA-MM-DD' })
    fecha_vencimiento?: string;

    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean({ message: 'descontar_caja debe ser verdadero o falso' })
    descontar_caja?: boolean;

    @ValidateIf((o) => descuentaCaja(o))
    @IsNotEmpty({ message: 'El método de pago es obligatorio si se descuenta de caja' })
    @IsIn(METODOS_PAGO, { message: 'El método de pago no es válido' })
    metodo_pago?: string;

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

export class PagarGastoDTO {
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
