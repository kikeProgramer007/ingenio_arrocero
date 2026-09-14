import { validate, ValidationError } from 'class-validator';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { Request, Response, NextFunction } from 'express';

interface ValidationResult<T> {
  isValid: boolean;
  instance: T;
  errors?: { propiedad: string; mensajes: string[] }[];
}

export class DtoValidator {
  public static async validate<T extends object>(
    dtoClass: ClassConstructor<T>,
    data: any
  ): Promise<ValidationResult<T>> {
    const dtoInstance = plainToInstance(dtoClass, data);
    const validationErrors = await validate(dtoInstance, {
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (validationErrors.length === 0) {
      return { isValid: true, instance: dtoInstance };
    }

    const formattedErrors = validationErrors.map(err => ({
      propiedad: err.property,
      mensajes: Object.values(err.constraints || {})
    }));

    return { isValid: false, instance: dtoInstance, errors: formattedErrors };
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