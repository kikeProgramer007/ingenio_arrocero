// Columnas compartidas por los documentos reales y sus previsualizaciones.
export const COLUMNAS_DOCUMENTOS = {
    resumen: ['Indicador', 'Valor'],
    movimientos: ['Fecha', 'Tipo', 'Origen', 'Categoría', 'Concepto', 'Método', 'Ingreso (Bs)', 'Egreso (Bs)', 'Usuario'],
    ventas: ['Nro', 'Fecha', 'Cliente', 'Vendido (Bs)', 'Cobrado efectivo (Bs)', 'Cobrado QR (Bs)', 'Cobrado (Bs)', 'Saldo (Bs)', 'Vencimiento', 'Estado'],
    egresos: ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Persona', 'Monto (Bs)', 'Método', 'Usuario'],
    caja: ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Método', 'Usuario', 'Monto (Bs)'],
    compras: ['Nro', 'Fecha', 'Proveedor', 'Clase', 'Total (Bs)', 'Pagado (Bs)', 'Pendiente (Bs)', 'Estado'],
    cobranzas: ['Fecha', 'Venta', 'Cliente', 'Monto (Bs)', 'Método', 'Referencia', 'Usuario'],
    pagos: ['Fecha', 'Compra', 'Proveedor', 'Monto (Bs)', 'Método', 'Referencia', 'Usuario'],
    cuenta_proveedor: ['Fecha', 'Ordenante', 'Tipo de operación', 'Concepto/Producto', 'Boleta', 'Chofer', 'Placa', 'Fanegas', 'Precio (Bs)', 'Precio (USD)', 'Compra (Bs)', 'Compra (USD)', 'Pago (Bs)', 'Pago (USD)', 'Saldo (Bs)', 'Saldo (USD)'],
    cuentas_por_pagar: ['Proveedor', 'Teléfono', 'Notas', 'Fanegas', 'Compras (Bs)', 'Pagos (Bs)', 'Saldo (Bs)', 'Saldo (USD)'],
    entregas_proveedor: ['Producto', 'Unidad', 'Compras', 'Entregado'],
    inventario: ['Producto', 'Categoría', 'Unidad', 'Existencia física', 'Reservado', 'Disponible', 'Mínimo', 'P. venta (Bs)', 'P. compra (Bs)', 'Estado'],
    clientes: ['Nombre', 'NIT / CI', 'Teléfono', 'Procedencia', 'Dirección', 'Estado'],
    proveedores: ['Nombre', 'NIT / CI', 'Teléfono', 'Dirección', 'Estado'],
    empaques: ['Tipo de bolsa', 'Unidad', 'Existencia', 'Mínimo', 'Estado'],
    produccion: ['Fecha', 'Origen', 'Entrada', 'Destino', 'Salida', 'Merma', 'Usuario'],
    campanas: ['Nombre', 'Inicio', 'Fin', 'Meta', 'Estado', 'Usuario'],
    cajas: ['Apertura', 'Usuario', 'Saldo inicial (Bs)', 'Ingresos (Bs)', 'Egresos (Bs)', 'Esperado (Bs)', 'Contado (Bs)', 'Diferencia (Bs)', 'Estado'],
    cuentas_por_cobrar: ['N°', 'Fecha', 'N° Venta', 'Cliente', 'Total (Bs)', 'Cobrado (Bs)', 'Saldo (Bs)', 'Vencimiento', 'Días atraso', 'Estado'],
    despachos: ['Venta', 'Fecha', 'Cliente', 'Pago', 'Despacho', 'Producto', 'Unidad', 'Vendido', 'Despachado', 'Pendiente'],
    nota_entrega: ['Producto', 'Unidad', 'Cantidad entregada', 'Cantidad pendiente posterior']
};
