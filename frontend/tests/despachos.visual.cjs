// Fixture visual: todas las respuestas API se simulan; no conecta a ninguna BD.
async (page) => {
    const venta = {
        id: 12,
        id_cliente: 1,
        fecha: new Date().toISOString(),
        total: 1000,
        saldo_pendiente: 0,
        pagado: 1000,
        estado: 'PAGADA',
        estado_despacho: 'PARCIAL',
        cliente: { id: 1, nombre: 'Cliente de prueba' },
        detalles: [{ id: 1, id_producto: 1, descripcion: 'Arroz de prueba', unidad: 'Quintal', cantidad: 100, entregado: 40, pendiente: 60, precio_unitario: 10, subtotal: 1000 }]
    };
    const productos = [{ id: 1, nombre: 'Arroz de prueba', stock: 460, reservado: 60, disponible: 400, stock_minimo: 20, precio_venta: 10, unidad_medida: 'Quintal', path_imagen: 'http://127.0.0.1:4201/images/logotipo.jpeg' }];
    await page.route('http://127.0.0.1:3001/**', async (route) => {
        const u = new URL(route.request().url());
        let body = [];
        if (u.pathname === '/api/empresa') body = { nombre: 'Royal Alimentos', nombre_corto: 'Royal Alimentos' };
        else if (u.pathname === '/api/despachos/config') body = { habilitado: true };
        else if (u.pathname === '/api/despachos') body = { data: [venta], total: 1 };
        else if (u.pathname === '/api/clientes') body = [{ id: 1, nombre: 'Cliente de prueba', activo: true }];
        else if (u.pathname === '/api/ventas') body = [venta];
        else if (u.pathname === '/api/ventas/12') body = venta;
        else if (u.pathname === '/api/productos') body = productos;
        else if (u.pathname === '/api/productos/categorias') body = [{ id: 1, nombre: 'Arroz pilado' }];
        else if (u.pathname.includes('/reservas')) body = [{ id_venta: 12, pendiente: 60, unidad: 'Quintal', venta }];
        else if (u.pathname.includes('/unidades-invalidas')) body = { data: [] };
        await route.fulfill({ json: body });
    });
    await page.evaluate(() => {
        localStorage.setItem('token', 'fixture-visual-sin-acceso-real');
        localStorage.setItem('user', JSON.stringify({ id: 1, nombre: 'Usuario de prueba', username: 'prueba' }));
        localStorage.setItem('userMenu', JSON.stringify([{ id: 1, nombre: 'Despachos', url: '/despachos', classIcon: 'pi pi-truck' }]));
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4201/despachos');
    await page.getByRole('button', { name: 'Registrar despacho', exact: true }).waitFor();
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/despachos-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Registrar despacho', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar despacho', exact: true }).waitFor();
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/form-despacho-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/form-despacho-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.goto('http://127.0.0.1:4201/ventas');
    await page.getByRole('button', { name: 'Nueva venta', exact: true }).click();
    await page.getByRole('button', { name: 'Entrega parcial ahora', exact: true }).click();
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/venta-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/venta-desktop.png', fullPage: true });
    await page.goto('http://127.0.0.1:4201/inventario');
    await page.getByRole('button', { name: '60', exact: true }).click();
    await page.screenshot({ path: 'backend/tmp/despachos-verificacion/inventario-reservas-desktop.png', fullPage: true });
    return { resultado: 'Pantallas y formulario revisados con fixtures locales, sin API real.' };
};
