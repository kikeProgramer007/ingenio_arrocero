import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
    CATEGORIAS_MOVIMIENTO,
    CATEGORIAS_POR_TIPO,
    ESTADOS_CAJA,
    METODOS_PAGO,
    TIPOS_MOVIMIENTO
} from '../constants/caja.constants';

export class AbrirCajaDTO {
    @Type(() => Number)
    @IsNumber({}, { message: 'El saldo inicial debe ser numérico' })
    @Min(0, { message: 'El saldo inicial no puede ser negativo' })
    saldo_inicial!: number;

    @IsOptional()
    @IsString({ message: 'La observación debe ser texto' })
    @MaxLength(500, { message: 'La observación no puede superar 500 caracteres' })
    observacion?: string;
}

export class CerrarCajaDTO {
    @Type(() => Number)
    @IsNumber({}, { message: 'El saldo contado debe ser numérico' })
    @Min(0, { message: 'El saldo contado no puede ser negativo' })
    saldo_contado!: number;

    @IsOptional()
    @IsString({ message: 'La observación debe ser texto' })
    @MaxLength(500, { message: 'La observación no puede superar 500 caracteres' })
    observacion?: string;
}

export class CrearMovimientoCajaDTO {
    @IsNotEmpty({ message: 'El tipo es obligatorio' })
    @IsIn(TIPOS_MOVIMIENTO, { message: 'El tipo debe ser INGRESO o EGRESO' })
    tipo!: string;

    @IsNotEmpty({ message: 'La categoría es obligatoria' })
    @IsIn(CATEGORIAS_MOVIMIENTO, { message: 'La categoría no es válida' })
    categoria!: string;

    @IsNotEmpty({ message: 'El concepto es obligatorio' })
    @IsString({ message: 'El concepto debe ser texto' })
    @MaxLength(200, { message: 'El concepto no puede superar 200 caracteres' })
    concepto!: string;

    @Type(() => Number)
    @IsNumber({}, { message: 'El monto debe ser numérico' })
    @Min(0.01, { message: 'El monto debe ser mayor a 0' })
    monto!: number;

    @IsNotEmpty({ message: 'El método de pago es obligatorio' })
    @IsIn(METODOS_PAGO, { message: 'El método de pago no es válido' })
    metodo_pago!: string;

    @IsOptional()
    @IsString({ message: 'La referencia debe ser texto' })
    @MaxLength(100, { message: 'La referencia no puede superar 100 caracteres' })
    referencia?: string;

    @IsOptional()
    @IsString({ message: 'La observación debe ser texto' })
    @MaxLength(500, { message: 'La observación no puede superar 500 caracteres' })
    observacion?: string;
}

export class FiltroHistorialCajaDTO {
    @IsOptional()
    @IsString()
    fecha_desde?: string;

    @IsOptional()
    @IsString()
    fecha_hasta?: string;

    @IsOptional()
    @IsIn(ESTADOS_CAJA, { message: 'El estado debe ser ABIERTA o CERRADA' })
    estado?: string;
}

export function categoriaCorrespondeAlTipo(tipo: string, categoria: string): boolean {
    const categorias = CATEGORIAS_POR_TIPO[tipo as keyof typeof CATEGORIAS_POR_TIPO] || [];
    return (categorias as readonly string[]).includes(categoria);
}
