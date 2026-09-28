const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTI = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function grupo(n: number): string {
    if (n <= 0) {
        return '';
    }
    if (n === 100) {
        return 'CIEN';
    }
    const c = Math.floor(n / 100);
    const d = n % 100;
    const partes: string[] = [];
    if (c > 0) {
        partes.push(CENTENAS[c]);
    }
    if (d > 0) {
        partes.push(decena(d));
    }
    return partes.join(' ');
}

function decena(n: number): string {
    if (n < 10) {
        return UNIDADES[n];
    }
    if (n < 20) {
        return DIEZ_A_DIECINUEVE[n - 10];
    }
    if (n < 30) {
        return VEINTI[n - 20];
    }
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
}

function enteroALetras(valor: number): string {
    if (valor === 0) {
        return 'CERO';
    }
    const millones = Math.floor(valor / 1_000_000);
    const miles = Math.floor((valor % 1_000_000) / 1000);
    const resto = valor % 1000;
    const partes: string[] = [];
    if (millones > 0) {
        partes.push(millones === 1 ? 'UN MILLON' : `${grupo(millones)} MILLONES`);
    }
    if (miles > 0) {
        partes.push(miles === 1 ? 'MIL' : `${grupo(miles)} MIL`);
    }
    if (resto > 0) {
        partes.push(grupo(resto));
    }
    return partes.join(' ');
}

export function montoALetrasBs(monto: number): string {
    const seguro = Number.isFinite(monto) ? Math.round(monto * 100) / 100 : 0;
    const entero = Math.floor(seguro);
    const centavos = Math.round((seguro - entero) * 100);
    const cents = String(centavos).padStart(2, '0');
    return `Son: ${enteroALetras(entero)} ${cents}/100 Bolivianos`;
}
