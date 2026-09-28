export interface ErrorResponse {
    mensaje: string;
    errores: string[];
}

export interface ErrorApiMapeado {
    mensaje: string;
    resumen: string;
    errores: string[];
    estado: number | null;
    cuerpoTexto: string;
}
