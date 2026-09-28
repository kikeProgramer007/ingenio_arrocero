import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';
import { CATEGORIAS_GASTO_EMPRESA } from '../constants/gasto.constants';
import { TIPOS_GASTO } from '../models/gasto.model';

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
    @IsIn([...CATEGORIAS_GASTO_EMPRESA], { message: 'La categoría de gasto no es válida' })
    categoria?: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'El monto debe ser numérico' })
    @Min(0.01, { message: 'El monto debe ser mayor a 0' })
    monto!: number;

    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean({ message: 'descontar_caja debe ser verdadero o falso' })
    descontar_caja?: boolean;

    @ValidateIf((o) => o.tipo === 'GASTO_EMPRESA' || o.descontar_caja !== false)
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
}
