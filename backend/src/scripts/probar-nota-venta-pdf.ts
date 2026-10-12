import fs from 'fs';
import path from 'path';
import os from 'os';
import { bufferVoucherPdf, DatosVoucher, LineaVoucher, NOTA_FORMULARIO, notaDetalleAltoMm } from '../utils/pdf-voucher';

function linea(partial: Partial<LineaVoucher>): LineaVoucher {
    return {
        codigo: 'PR-00001',
        cantidad: 1,
        descripcion: 'Producto',
        precio: 10,
        importe: 10,
        ...partial
    };
}

function nota(lineas: LineaVoucher[], extra?: Partial<DatosVoucher>): DatosVoucher {
    const total = lineas.reduce((acc, l) => acc + Number(l.importe), 0);
    return {
        tipoDocumento: 'NOTA DE VENTA',
        numero: 600002,
        fecha: new Date('2026-10-12T11:16:01'),
        contraparteLabel: 'CLIENTE',
        contraparteNombre: 'Melania Guaipa',
        nitCi: '0',
        codigoContraparte: '330011',
        direccion: '-',
        vendedor: 'admin',
        tipoPago: 'Credito',
        plazoDias: 7,
        detalle: 'VENTA',
        lineas,
        total,
        cobrado: 0,
        pendiente: total,
        ...extra
    };
}

function inspeccionar(buf: Buffer): {
    pages: number;
    width: number;
    height: number;
    maxYmm: number;
} {
    const zlib = require('zlib') as typeof import('zlib');
    const text = buf.toString('latin1');
    const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)];
    const pages = (text.match(/\/Type\s*\/Page(?!s)/g) || []).length;
    const last = boxes[boxes.length - 1];
    const width = last ? Number(last[3]) : 0;
    const height = last ? Number(last[4]) : 0;
    let streams = '';
    const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        try {
            streams += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
        } catch {
            /* imagen u otro stream */
        }
    }
    const ys = [...streams.matchAll(/1 0 0 1 [0-9.]+ ([0-9.]+) Tm/g)].map((x) => Number(x[1]));
    const fromTop = ys.map((y) => height - y);
    const maxYmm = fromTop.length ? (Math.max(...fromTop) * 25.4) / 72 : 0;
    return { pages, width, height, maxYmm };
}

async function main(): Promise<void> {
    const dir = path.join(os.tmpdir(), 'notas-venta-pdf');
    fs.mkdirSync(dir, { recursive: true });
    const casos: { nombre: string; datos: DatosVoucher }[] = [
        {
            nombre: '1-producto',
            datos: nota([linea({ codigo: 'PR-390008', cantidad: 100, descripcion: '3/4 Premier', precio: 220, importe: 22000 })])
        },
        {
            nombre: '3-productos',
            datos: nota([
                linea({ codigo: 'PR-390008', cantidad: 100, descripcion: '3/4 Premier', precio: 220, importe: 22000 }),
                linea({ codigo: 'PR-390009', cantidad: 130, descripcion: 'Granillo', precio: 150, importe: 19500 }),
                linea({ codigo: 'PR-390007', cantidad: 400, descripcion: 'Khaja Premier MAC-18', precio: 460, importe: 184000 })
            ])
        },
        {
            nombre: '10-items',
            datos: nota(
                Array.from({ length: 10 }, (_, i) =>
                    linea({
                        codigo: `PR-${String(i + 1).padStart(5, '0')}`,
                        cantidad: 10 + i,
                        descripcion: `Producto de prueba ${i + 1}`,
                        precio: 100 + i,
                        importe: (10 + i) * (100 + i)
                    })
                )
            )
        },
        {
            nombre: 'detalle-lleno',
            datos: nota(
                Array.from({ length: 18 }, (_, i) =>
                    linea({
                        codigo: `PR-${String(i + 1).padStart(5, '0')}`,
                        cantidad: 10 + i,
                        descripcion: `Producto de prueba ${i + 1}`,
                        precio: 100 + i,
                        importe: (10 + i) * (100 + i)
                    })
                )
            )
        },
        {
            nombre: 'multipagina',
            datos: nota(
                Array.from({ length: 45 }, (_, i) =>
                    linea({
                        codigo: `PR-${String(i + 1).padStart(5, '0')}`,
                        cantidad: i + 1,
                        descripcion: `Ítem largo para forzar otra página ${i + 1} arroz pilado quintal`,
                        precio: 9999.99,
                        importe: 1234567.89
                    })
                )
            )
        },
        {
            nombre: 'textos-largos',
            datos: nota(
                [
                    linea({
                        codigo: 'PR-99999',
                        cantidad: 1234.5,
                        descripcion: 'Khaja Premier MAC-18 extra largo con presentación especial para mercado interno y exportación',
                        precio: 1234567.89,
                        importe: 9876543.21
                    }),
                    linea({
                        codigo: 'PR-00007',
                        cantidad: 1,
                        descripcion: 'Granillo',
                        precio: 150,
                        importe: 150
                    })
                ],
                { total: 9876693.21, pendiente: 9876693.21 }
            )
        }
    ];

    console.log(
        `Carta ${NOTA_FORMULARIO.anchoMm.toFixed(1)} x ${NOTA_FORMULARIO.altoMm.toFixed(1)} mm | contenidoMax=${NOTA_FORMULARIO.contenidoMaxMm} mm | detalle=${notaDetalleAltoMm().toFixed(1)} mm (${NOTA_FORMULARIO.filasDetalle} filas) | firmaEspacio=${NOTA_FORMULARIO.firmaEspacioMm} mm | gapDir=${NOTA_FORMULARIO.gapDirTablaMm} mm`
    );
    for (const caso of casos) {
        const buf = await bufferVoucherPdf(caso.datos);
        const dest = path.join(dir, `${caso.nombre}.pdf`);
        fs.writeFileSync(dest, buf);
        const info = inspeccionar(buf);
        const wIn = info.width / 72;
        const hIn = info.height / 72;
        const okY = info.maxYmm <= NOTA_FORMULARIO.contenidoMaxMm + 0.4;
        console.log(
            `${caso.nombre}: pages=${info.pages} ${wIn.toFixed(2)}x${hIn.toFixed(2)}in maxY=${info.maxYmm.toFixed(1)}mm ${okY ? 'OK' : 'EXCEDE'} ${dest}`
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
