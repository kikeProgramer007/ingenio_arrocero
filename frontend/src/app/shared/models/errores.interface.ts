export interface ErrorResponse {
    mensaje: string;
    errores: string[];
}

export interface ErrorHandlerOptions {
    showToast?: boolean;
    redirectTo?: string;
    customErrorMessage?: string;
}