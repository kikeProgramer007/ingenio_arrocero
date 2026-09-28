/**
 * Carga un set operativo coherente vía API (idempotente por marca [DEMO]).
 * Uso: node scripts/cargar-datos-demo.js
 */
const BASE = process.env.API_URL || 'http://localhost:3001';
const MARK = '[DEMO]';

async function main() {
    const loginRes = await fetch(`${BASE}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: process.env.DEMO_USER || 'admin',
            password: process.env.DEMO_PASS || 'admin123'
        })
    });
    const login = await loginRes.json();
    if (!login.token) {
        throw new Error(`Login falló: ${JSON.stringify(login)}`);
    }
    const token = login.token;

    const api = async (method, path, body) => {
        const res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
        if (!res.ok) {
            throw new Error(`${method} ${path} ${res.status}: ${JSON.stringify(data)}`);
        }
        return data;
    };

    const ventas = await api('GET', '/api/ventas');
    if (Array.isArray(ventas) && ventas.some((v) => String(v.observacion || '').includes(MARK))) {
        console.log('Ya hay datos de demostración. No se duplican.');
        return;
    }

    const wrap = (res) => (res && res.data !== undefined ? res.data : res);

    const findOrCreate = async (list, nombre, createPath, payload) => {
        const existente = (list || []).find((item) => item.nombre === nombre);
        if (existente) {
            return existente;
        }
        return wrap(await api('POST', createPath, payload));
    };

    const clientes = await api('GET', '/api/clientes');
    const proveedores = await api('GET', '/api/proveedores');
    const productos = await api('GET', '/api/productos');
    const categorias = await api('GET', '/api/productos/categorias');

    const catEmpaque = (categorias || []).find((c) => c.nombre === 'Empaque');

    const minimarket = await findOrCreate(clientes, 'Minimarket Los Andes', '/api/clientes', {
        nombre: 'Minimarket Los Andes',
        nit_ci: '4589123',
        telefono: '70011223',
        direccion: 'Av. Blanco Galindo km 4',
        observacion: `${MARK} Cliente local de mostrador`
    });
    const hotel = await findOrCreate(clientes, 'Hotel El Granero', '/api/clientes', {
        nombre: 'Hotel El Granero',
        nit_ci: '10293847',
        telefono: '4442211',
        direccion: 'Zona central',
        observacion: `${MARK} Compra semanal a crédito`
    });
    const distribuidora = await findOrCreate(clientes, 'Distribuidora Rojas', '/api/clientes', {
        nombre: 'Distribuidora Rojas',
        nit_ci: '3344556',
        telefono: '76543210',
        direccion: 'Mercado de abasto',
        observacion: `${MARK} Mayorista`
    });

    const cooperativa = await findOrCreate(proveedores, 'Cooperativa Arrocera San Juan', '/api/proveedores', {
        nombre: 'Cooperativa Arrocera San Juan',
        nit_ci: '1987456',
        telefono: '71122334',
        direccion: 'Ivirgarzama',
        observacion: `${MARK} Proveedor de chala`
    });
    const productor = await findOrCreate(proveedores, 'Productor Mario Quispe', '/api/proveedores', {
        nombre: 'Productor Mario Quispe',
        nit_ci: '5678123',
        telefono: '72233445',
        direccion: 'Chimoré',
        observacion: `${MARK} Productor independiente`
    });

    const chala = productos.find((p) => p.nombre === 'Arroz en chala');
    const pilado = productos.find((p) => p.nombre === 'Arroz pilado');
    if (!chala || !pilado) {
        throw new Error('Faltan productos base (Arroz en chala / Arroz pilado). Reinicia el backend para el seed de inventario.');
    }

    await api('PUT', `/api/productos/${chala.id}`, {
        nombre: chala.nombre,
        descripcion: 'Materia prima',
        precio_venta: 0,
        precio_compra: 2.8,
        stock_minimo: 200,
        unidad_medida: 'kg',
        path_imagen: chala.path_imagen,
        id_categoria: chala.id_categoria
    });
    await api('PUT', `/api/productos/${pilado.id}`, {
        nombre: pilado.nombre,
        descripcion: 'Producto terminado',
        precio_venta: 8.5,
        precio_compra: 0,
        stock_minimo: 80,
        unidad_medida: 'kg',
        path_imagen: pilado.path_imagen,
        id_categoria: pilado.id_categoria
    });

    let bolsas = productos.find((p) => p.nombre === 'Bolsa de 50 kg');
    if (!bolsas) {
        bolsas = wrap(await api('POST', '/api/productos', {
            nombre: 'Bolsa de 50 kg',
            descripcion: 'Empaque para despacho',
            precio_venta: 0,
            precio_compra: 3.5,
            stock: 0,
            stock_minimo: 20,
            unidad_medida: 'unid',
            id_categoria: catEmpaque ? catEmpaque.id : null
        }));
    }

    if (Number(pilado.stock) < 500) {
        await api('POST', `/api/productos/${pilado.id}/ajuste`, {
            cantidad: 800,
            observacion: `${MARK} Saldo de producto terminado listo para venta`
        });
    }

    let caja = await api('GET', '/api/cajas/abierta');
    if (!caja) {
        caja = wrap(await api('POST', '/api/cajas', {
            saldo_inicial: 2500,
            observacion: `${MARK} Fondo de operación`
        }));
    } else {
        const movimientos = caja.movimientos || [];
        const yaFondo = movimientos.some((m) => String(m.concepto || m.observacion || '').includes(`${MARK} Fondo`));
        if (!yaFondo && Number(caja.saldo_esperado || 0) < 2000) {
            await api('POST', `/api/cajas/${caja.id}/movimientos`, {
                tipo: 'INGRESO',
                categoria: 'OTRO_INGRESO',
                concepto: `${MARK} Fondo de operación`,
                monto: 2500,
                metodo_pago: 'EFECTIVO',
                observacion: 'Efectivo para compras, gastos y retiros de demostración'
            });
        }
    }

    const compraChala = wrap(await api('POST', '/api/compras', {
        id_proveedor: cooperativa.id,
        observacion: `${MARK} Lote de chala cooperativa`,
        lineas: [{ id_producto: chala.id, descripcion: 'Arroz en chala', cantidad: 800, precio_unitario: 2.8 }],
        pago_inicial: 1000,
        metodo_pago: 'EFECTIVO'
    }));
    await api('POST', '/api/compras', {
        id_proveedor: productor.id,
        observacion: `${MARK} Compra a crédito al productor`,
        lineas: [{ id_producto: chala.id, descripcion: 'Arroz en chala', cantidad: 500, precio_unitario: 2.9 }]
    });
    await api('POST', '/api/compras', {
        id_proveedor: cooperativa.id,
        observacion: `${MARK} Empaque`,
        lineas: [{ id_producto: bolsas.id, descripcion: 'Bolsa de 50 kg', cantidad: 40, precio_unitario: 3.5 }],
        pago_inicial: 140,
        metodo_pago: 'EFECTIVO'
    });
    await api('POST', '/api/pagos', {
        id_compra: compraChala.id,
        monto: 800,
        metodo_pago: 'TRANSFERENCIA',
        referencia: 'TRX-4412',
        observacion: `${MARK} Abono a cooperativa`
    });

    const hoy = new Date();
    const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const campana = wrap(await api('POST', '/api/campanas', {
        nombre: 'Campaña zafra demostración',
        fecha_inicio: inicioMes,
        meta_cantidad: 3000,
        observacion: `${MARK} Acopio de chala`
    }));
    await api('POST', '/api/campanas/acopios', {
        id_campana: campana.id,
        id_proveedor: productor.id,
        id_producto: chala.id,
        descripcion: 'Arroz en chala',
        cantidad: 200,
        precio_unitario: 2.7,
        pago: 400,
        metodo_pago: 'EFECTIVO',
        observacion: `${MARK} Acopio con pago parcial`
    });

    await api('POST', '/api/ventas', {
        id_cliente: minimarket.id,
        observacion: `${MARK} Contado mostrador`,
        lineas: [{ id_producto: pilado.id, descripcion: 'Arroz pilado', cantidad: 150, precio_unitario: 8.5 }],
        pago_inicial: 1275,
        metodo_pago: 'EFECTIVO'
    });
    const ventaHotel = wrap(await api('POST', '/api/ventas', {
        id_cliente: hotel.id,
        observacion: `${MARK} Crédito hotel — a cuenta`,
        lineas: [{ id_producto: pilado.id, descripcion: 'Arroz pilado', cantidad: 80, precio_unitario: 8.5 }],
        pago_inicial: 300,
        metodo_pago: 'QR',
        referencia: 'QR-8801'
    }));
    await api('POST', '/api/ventas', {
        id_cliente: distribuidora.id,
        observacion: `${MARK} Crédito mayorista`,
        lineas: [{ id_producto: pilado.id, descripcion: 'Arroz pilado', cantidad: 200, precio_unitario: 8.2 }]
    });
    await api('POST', '/api/ventas', {
        id_cliente: minimarket.id,
        observacion: `${MARK} Contado transferencia`,
        lineas: [{ id_producto: pilado.id, descripcion: 'Arroz pilado', cantidad: 50, precio_unitario: 8.5 }],
        pago_inicial: 425,
        metodo_pago: 'TRANSFERENCIA',
        referencia: 'TRX-2290'
    });
    await api('POST', '/api/cobranzas', {
        id_venta: ventaHotel.id,
        monto: 200,
        metodo_pago: 'EFECTIVO',
        observacion: `${MARK} Abono hotel`
    });

    await api('POST', '/api/gastos', {
        tipo: 'GASTO_EMPRESA',
        concepto: 'Diesel para secadora y transporte interno',
        categoria: 'Combustible',
        monto: 180,
        metodo_pago: 'EFECTIVO',
        observacion: MARK
    });
    await api('POST', '/api/gastos', {
        tipo: 'GASTO_EMPRESA',
        concepto: 'Factura de energía del ingenio',
        categoria: 'Energía',
        monto: 320,
        metodo_pago: 'TRANSFERENCIA',
        referencia: 'DEL-0918',
        observacion: MARK
    });
    await api('POST', '/api/gastos', {
        tipo: 'GASTO_EMPRESA',
        concepto: 'Flete de chala hasta planta',
        categoria: 'Transporte',
        monto: 150,
        metodo_pago: 'EFECTIVO',
        observacion: MARK
    });
    await api('POST', '/api/gastos', {
        tipo: 'RETIRO_PERSONAL',
        concepto: 'Retiro del titular',
        monto: 200,
        metodo_pago: 'EFECTIVO',
        descontar_caja: true,
        observacion: MARK
    });
    await api('POST', '/api/gastos', {
        tipo: 'RETIRO_PERSONAL',
        concepto: 'Retiro personal pagado por fuera de caja',
        monto: 80,
        descontar_caja: false,
        observacion: `${MARK} No descuenta caja`
    });

    const resumen = await api('GET', '/api/reportes/resumen');
    console.log('Datos de demostración cargados.');
    console.log(JSON.stringify({
        ventas: resumen.ventas,
        compras: resumen.compras,
        gastos: resumen.gastos,
        retiros: resumen.retiros,
        acopios: resumen.acopios,
        caja: resumen.caja
    }, null, 2));
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
