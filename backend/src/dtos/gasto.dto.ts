import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { METODOS_PAGO } from '../constants/caja.constants';
import { CATEGORIAS_GASTO_EMPRESA } from '../constants/gasto.constants';
import { TIPOS_GASTO } from '../models/gasto.model';

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
