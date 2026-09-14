import { Response } from 'express';

interface ExtendedError extends Error {
  code?: string | number;
  sqlMessage?: string;
  sqlState?: string;
}

export const handleError = (
  res: Response, 
  error: unknown, 
  mensaje: string, 
  statusCode = 500
): void => {
  const err = error as ExtendedError;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[ERROR] ${mensaje}:`, {
    message: err.message,
    stack: err.stack,
    code: err.code,
    sqlMessage: err.sqlMessage,
    sqlState: err.sqlState
  });

  const errores = isProduction
    ? ['Ha ocurrido un error en el servidor']
    : [
        err.message,
        ...(err.code ? [`Código: ${err.code}`] : []),
        ...(err.sqlMessage ? [`SQL: ${err.sqlMessage}`] : [])
      ];

  res.status(statusCode).json({ mensaje, errores });
};

export const handleValidationError = (
  res: Response,
  errores: any[],
  mensaje = 'Error de validación'
): void => {
  const mensajesError = errores.flatMap(err => 
    Object.values(err.constraints || {})
  );
  
  res.status(400).json({ mensaje, errores: mensajesError });
};