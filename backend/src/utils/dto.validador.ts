import { validate, ValidationError } from 'class-validator';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { Request, Response, NextFunction } from 'express';

interface ValidationResult<T> {
  isValid: boolean;
  instance: T;
  errors?: { propiedad: string; mensajes: string[] }[];
}

function traducirConstraint(propiedad: string, mensaje: string): string {
  if (/should not exist/i.test(mensaje)) {
    return `El campo "${propiedad}" no está permitido`;
  }
  if (/must be a number/i.test(mensaje) || /numeric string/i.test(mensaje)) {
    return `El campo "${propiedad}" debe ser numérico`;
  }
  if (/must be an integer/i.test(mensaje)) {
    return `El campo "${propiedad}" debe ser un entero`;
  }
  return mensaje;
}

function aplanarErrores(errors: ValidationError[], padre = ''): { propiedad: string; mensajes: string[] }[] {
  const out: { propiedad: string; mensajes: string[] }[] = [];
  for (const err of errors) {
    const propiedad = padre ? `${padre}.${err.property}` : err.property;
    const mensajes = Object.values(err.constraints || {}).map((m) => traducirConstraint(propiedad, m));
    if (mensajes.length) {
      out.push({ propiedad, mensajes });
    }
    if (err.children?.length) {
      out.push(...aplanarErrores(err.children, propiedad));
    }
  }
  return out;
}

export class DtoValidator {
  public static async validate<T extends object>(
    dtoClass: ClassConstructor<T>,
    data: any
  ): Promise<ValidationResult<T>> {
    const dtoInstance = plainToInstance(dtoClass, data, { enableImplicitConversion: true });
    const validationErrors = await validate(dtoInstance, {
      whitelist: true,
      forbidNonWhitelisted: false
    });

    if (validationErrors.length === 0) {
      return { isValid: true, instance: dtoInstance };
    }

    return { isValid: false, instance: dtoInstance, errors: aplanarErrores(validationErrors) };
  }

  public static validateMiddleware<T extends object>(
    dtoClass: ClassConstructor<T>,
    source: 'body' | 'query' | 'params' = 'body'
  ) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await this.validate(dtoClass, req[source]);

        if (!result.isValid && result.errors) {
          const mensajesError = result.errors.flatMap(e => e.mensajes);
          res.status(400).json({ mensaje: 'Error de validación', errores: mensajesError });
          return;
        }

        req[source] = result.instance;
        next();
      } catch (error) {
        const mensajeError = process.env.NODE_ENV === 'production'
          ? 'Error interno del servidor'
          : (error as Error).message;

        res.status(500).json({ mensaje: 'Error en la validación', errores: [mensajeError] });
      }
    };
  }

  public static async validateAndRespond<T extends object>(
    dtoClass: ClassConstructor<T>,
    data: any,
    res: Response
  ): Promise<T | null> {
    const result = await this.validate(dtoClass, data);

    if (!result.isValid && result.errors) {
      const mensajesError = result.errors.flatMap(e => e.mensajes);
      res.status(400).json({ mensaje: 'Error de validación', errores: mensajesError });
      return null;
    }

    return result.instance;
  }
}
