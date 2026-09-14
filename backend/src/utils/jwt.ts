export function getJwtSecret(): string {
    const secret = (process.env.SECRET_KEY || '').replace(/['"]/g, '').trim();
    if (secret) {
        return secret;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('SECRET_KEY no está definida. Configúrala en el entorno.');
    }

    console.warn('[auth] SECRET_KEY no definida. Usando clave de desarrollo. No uses esto en producción.');
    return 'ingenio-dev-secret';
}
