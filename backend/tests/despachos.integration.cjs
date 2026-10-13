// Ejecutar contra una instancia LOCAL aislada. Nunca usa la conexion de .env.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = process.env.TEST_DB_PORT || "33317";
process.env.DB_NAME = `test_despachos_${Date.now()}`;
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "";
process.env.DB_SSL = "false";
process.env.DB_CA = "";
process.env.SECRET_KEY = "despachos-isolated-test-secret";
process.env.DESPACHOS_HABILITADOS = "true";
require("reflect-metadata");
const mysql = require("mysql2/promise");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const m = require("../dist/models");
let server;
let checks = 0;
let base;
let token;
async function request(
  url,
  body,
  method = body ? "POST" : "GET",
  auth = token,
) {
  const r = await fetch(base + url, {
    method,
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  return { status: r.status, data };
}
function ok(condition, label) {
  assert.ok(condition, label);
  console.log("OK:", label);
  checks++;
}
async function main() {
  const admin = await mysql.createConnection({
    host: "127.0.0.1",
    port: Number(process.env.DB_PORT),
    user: "root",
    password: "",
  });
  await admin.query("CREATE DATABASE ??", [process.env.DB_NAME]);
  await admin.end();
  await m.sequelize.sync({ force: false });
  const perfil = await m.Perfil.create({ nombre: "Pruebas despachos" });
  const user = await m.User.create({
    username: "prueba-despachos",
    nombre: "Usuario de prueba",
    password: await bcrypt.hash("prueba-local", 4),
    id_perfil: perfil.get("id"),
  });
  const idUsuario = Number(user.get("id"));
  await require("../dist/seed/programas-caja.seed").seedProgramasCaja();
  const cliente = await m.Cliente.create({
    nombre: "Cliente de prueba",
    activo: true,
  });
  const idCliente = Number(cliente.get("id"));
  const producto = await m.Productos.create({
    nombre: "Arroz prueba",
    stock: 500,
    precio_venta: 10,
    unidad_medida: "Quintal",
  });
  const otro = await m.Productos.create({
    nombre: "Producto prueba kilo",
    stock: 100,
    precio_venta: 5,
    unidad_medida: "Kilo",
  });
  const idProducto = Number(producto.get("id"));
  const caja = await m.Caja.create({
    fecha_apertura: new Date(),
    id_usuario_apertura: idUsuario,
    estado: "ABIERTA",
    saldo_inicial: 0,
  });
  const app = express();
  app.use(cors({ exposedHeaders: ["Content-Disposition"] }));
  app.use(express.json());
  app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
  app.use("/api/ventas", require("../dist/routes/venta.routes").default);
  app.use("/api/despachos", require("../dist/routes/despacho.routes").default);
  app.use(
    "/api/cobranzas",
    require("../dist/routes/venta.routes").cobranzaRouter,
  );
  app.use("/api/productos", require("../dist/routes/producto.routes").default);
  app.use("/api/clientes", require("../dist/routes/cliente.routes").default);
  app.use("/api/empresa", require("../dist/routes/empresa.routes").default);
  app.use("/api/reportes", require("../dist/routes/reporte.routes").default);
  server = app.listen(
    process.argv.includes("--serve")
      ? Number(process.env.TEST_API_PORT || 3001)
      : 0,
    "127.0.0.1",
  );
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  token = jwt.sign(
    { id: idUsuario, username: "prueba-despachos" },
    process.env.SECRET_KEY,
  );
  const ventaPayload = (cantidad, entrega = "POSTERIOR", extras = {}) => ({
    id_cliente: idCliente,
    entrega,
    clave: crypto.randomUUID(),
    lineas: [{ id_producto: idProducto, cantidad, precio_unitario: 10 }],
    ...extras,
  });
  const stock = async () =>
    Number((await m.Productos.findByPk(idProducto)).get("stock"));
  const reserva = async () =>
    Number(
      (await m.ReservaProducto.findByPk(idProducto))?.get("cantidad") || 0,
    );
  const venta = async (payload) => {
    const r = await request("/api/ventas", payload);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.data;
  };
  const pagada = await venta(
    ventaPayload(100, "POSTERIOR", {
      pago_inicial: 1000,
      metodo_pago: "EFECTIVO",
    }),
  );
  ok(
    pagada.estado === "PAGADA" &&
      pagada.estado_despacho === "PENDIENTE" &&
      (await stock()) === 500 &&
      (await reserva()) === 100,
    "Venta pagada sin entrega reserva 100: fisico 500, disponible 400",
  );
  const cajaMovs = await m.MovimientoCaja.count();
  await caja.update({ estado: "CERRADA", fecha_cierre: new Date() });
  const despachoPayload = (v, cantidad) => ({
    clave: crypto.randomUUID(),
    persona_retira: "Persona prueba",
    lineas: [{ id_detalle: v.detalles[0].id, cantidad }],
  });
  const parcialPayload = despachoPayload(pagada, 40);
  const simultaneos = await Promise.all([
    request(`/api/despachos/ventas/${pagada.id}`, parcialPayload),
    request(`/api/despachos/ventas/${pagada.id}`, parcialPayload),
  ]);
  ok(
    simultaneos.every((r) => r.status === 200) &&
      simultaneos[0].data.data.id === simultaneos[1].data.data.id &&
      (await m.Despacho.count()) === 1,
    "Doble clic concurrente confirma un solo despacho",
  );
  ok(
    (await stock()) === 460 &&
      (await reserva()) === 60 &&
      (await m.MovimientoCaja.count()) === cajaMovs,
    "Despacho con caja cerrada: fisico 460, reservado 60, sin cobro",
  );
  ok(
    (
      await request("/api/cobranzas", {
        id_venta: pagada.id,
        monto: 1,
        metodo_pago: "EFECTIVO",
      })
    ).status === 409,
    "Cobranza bloqueada sin caja abierta",
  );
  ok(
    (
      await request(`/api/despachos/ventas/${pagada.id}`, {
        ...parcialPayload,
        persona_retira: "Otra persona",
      })
    ).status === 409,
    "Reintento con clave y contenido diferentes rechazado",
  );
  ok(
    (
      await request(
        `/api/despachos/ventas/${pagada.id}`,
        despachoPayload(pagada, 61),
      )
    ).status === 400,
    "Entrega mayor a pendiente rechazada",
  );
  ok(
    (
      await request(
        `/api/despachos/ventas/${pagada.id}`,
        despachoPayload(pagada, 0),
      )
    ).status === 400,
    "Entrega vacia rechazada",
  );
  const continuacion = await request(
    `/api/despachos/ventas/${pagada.id}`,
    despachoPayload(pagada, 60),
  );
  const completada = (await request(`/api/ventas/${pagada.id}`)).data;
  ok(
    continuacion.status === 200 &&
      completada.estado_despacho === "COMPLETO" &&
      (await stock()) === 400 &&
      (await reserva()) === 0,
    "Varios retiros completan venta sin cambiar disponible",
  );
  ok(
    (await request(`/api/ventas/${pagada.id}/anular`, {}, "PUT")).status ===
      409 && (await stock()) === 400,
    "Anulacion entregada bloqueada sin devolucion fisica",
  );
  const credito = await venta(
    ventaPayload(5, "COMPLETA", { persona_retira: "Retira credito" }),
  );
  ok(
    credito.estado === "PENDIENTE" &&
      credito.estado_despacho === "COMPLETO" &&
      (await stock()) === 395,
    "Venta a credito con entrega completa, sin caja",
  );
  const sinEntrega = await venta(ventaPayload(10));
  ok((await reserva()) === 10, "Reserva de venta sin entrega");
  const antesAnular = await stock();
  ok(
    (await request(`/api/ventas/${sinEntrega.id}/anular`, {}, "PUT")).status ===
      200 &&
      (await reserva()) === 0 &&
      (await stock()) === antesAnular,
    "Anulacion sin entrega libera reserva sin aumentar fisico",
  );
  const mixta = await venta({
    ...ventaPayload(2, "PARCIAL", { persona_retira: "Retiro mixto" }),
    lineas: [
      {
        id_producto: idProducto,
        cantidad: 2,
        entregar_ahora: 1,
        precio_unitario: 10,
      },
      {
        id_producto: Number(otro.get("id")),
        cantidad: 3.5,
        entregar_ahora: 1.25,
        precio_unitario: 5,
      },
      { descripcion: "Flete", cantidad: 1, precio_unitario: 5 },
    ],
  });
  ok(
    mixta.estado_despacho === "PARCIAL" &&
      mixta.detalles.some((l) => l.unidad === "Quintal") &&
      mixta.detalles.some((l) => l.unidad === "Kilo") &&
      (await m.ReservaVenta.count({ where: { id_venta: mixta.id } })) === 2,
    "Entrega parcial inicial, distintas unidades y servicio sin reserva",
  );
  const servicio = await venta({
    ...ventaPayload(1),
    lineas: [{ descripcion: "Servicio", cantidad: 1, precio_unitario: 10 }],
  });
  ok(
    servicio.estado_despacho === "NO_APLICA",
    "Venta solo de servicios: no aplica despacho",
  );
  const cuentaAntes = await m.Venta.count();
  const falla = await request("/api/ventas", ventaPayload(10000));
  ok(
    falla.status === 409 && (await m.Venta.count()) === cuentaAntes,
    "Sobreventa rechazada y transaccion revertida",
  );
  const rollback = await request("/api/ventas", {
    ...ventaPayload(1, "PARCIAL", { persona_retira: "" }),
    lineas: [
      {
        id_producto: idProducto,
        cantidad: 1,
        entregar_ahora: 1,
        precio_unitario: 10,
      },
    ],
  });
  ok(
    rollback.status === 400 && (await m.Venta.count()) === cuentaAntes,
    "Fallo en despacho inicial revierte venta y reserva",
  );
  const libre = (await stock()) - (await reserva());
  const carreras = await Promise.all([
    request("/api/ventas", ventaPayload(libre)),
    request("/api/ventas", ventaPayload(libre)),
  ]);
  ok(
    carreras.filter((r) => r.status === 201).length === 1 &&
      carreras.filter((r) => r.status === 409).length === 1,
    "Ventas concurrentes no sobrevendan disponibilidad",
  );
  const ajuste = await request(`/api/productos/${idProducto}/ajuste`, {
    cantidad: -1,
    observacion: "Prueba de reservas",
  });
  ok(ajuste.status === 409, "Ajuste negativo no consume reservas");
  const carreraGanadora = carreras.find((r) => r.status === 201).data.data;
  await request(`/api/ventas/${carreraGanadora.id}/anular`, {}, "PUT");
  const duplicada = ventaPayload(1);
  const duplicadas = await Promise.all([
    request("/api/ventas", duplicada),
    request("/api/ventas", duplicada),
  ]);
  ok(
    duplicadas.every((r) => [200, 201].includes(r.status)) &&
      duplicadas[0].data.data.id === duplicadas[1].data.data.id,
    "Venta duplicada por reintento no repite reserva ni venta",
  );
  ok(
    (
      await request("/api/ventas", {
        ...duplicada,
        observacion: "Otra solicitud",
      })
    ).status === 409,
    "Clave de venta con datos distintos rechazada",
  );
  const salidas = await m.MovimientoInventario.findAll({
    where: { origen: "DESPACHO" },
  });
  ok(
    salidas.length >= 4 &&
      salidas.every(
        (l) => l.get("origen_id") && /venta #/.test(l.get("observacion")),
      ),
    "Kardex referencia despacho y venta",
  );
  const listado = await request(
    "/api/despachos?estado_despacho=ABIERTOS&limite=1",
  );
  ok(
    listado.status === 200 &&
      listado.data.data.length === 1 &&
      listado.data.total > 1,
    "Paginacion backend y filtro de pendientes",
  );
  const productoApi = (await request("/api/productos")).data.find(
    (p) => p.id === idProducto,
  );
  ok(
    productoApi.disponible === productoApi.stock - productoApi.reservado,
    "Inventario devuelve fisico, reservado y disponible",
  );
  ok(
    (await request(`/api/despachos/productos/${idProducto}/reservas`)).data
      .length > 0,
    "Consulta de ventas con reservas",
  );
  const nuevoPerfil = await m.Perfil.create({ nombre: "Sin permisos" });
  const sinPermiso = await m.User.create({
    username: "sin-permiso",
    password: "x",
    id_perfil: nuevoPerfil.get("id"),
  });
  const tokenSinPermiso = jwt.sign(
    { id: sinPermiso.get("id"), username: "sin-permiso" },
    process.env.SECRET_KEY,
  );
  ok(
    (await request("/api/despachos", null, "GET", tokenSinPermiso)).status ===
      403,
    "API verifica permiso del perfil",
  );
  const legacy = await m.Venta.create({
    id_cliente: idCliente,
    id_usuario: idUsuario,
    fecha: new Date(),
    total: 10,
    saldo_pendiente: 10,
    estado: "PENDIENTE",
  });
  const legacyLinea = await m.VentaDetalle.create({
    id_venta: legacy.get("id"),
    id_producto: idProducto,
    descripcion: "Anterior prueba",
    cantidad: 1,
    precio_unitario: 10,
    subtotal: 10,
  });
  ok(
    (await request(`/api/ventas/${legacy.get("id")}`)).data.estado_despacho ===
      "ANTERIOR" &&
      (
        await request(`/api/despachos/ventas/${legacy.get("id")}`, {
          clave: crypto.randomUUID(),
          persona_retira: "Prueba",
          lineas: [{ id_detalle: legacyLinea.get("id"), cantidad: 1 }],
        })
      ).status === 409,
    "Ventas anteriores sin presuncion de entrega ni doble salida",
  );
  ok(
    (await request(`/api/ventas/${legacy.get("id")}/anular`, {}, "PUT"))
      .status === 409,
    "Anulacion anterior requiere revision separada",
  );
  const nota = await request(
    `/api/despachos/${simultaneos[0].data.data.id}/nota`,
  );
  ok(
    nota.status === 200 && nota.data.subarray(0, 4).toString() === "%PDF",
    "Nota de entrega PDF y reimpresion",
  );
  const dir = path.resolve(__dirname, "../tmp/despachos-verificacion");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "nota-entrega.pdf"), nota.data);
  const excel = await request(
    `/api/despachos/exportar?estado_despacho=TODOS&numero=${mixta.id}&formato=xlsx`,
  );
  const book = new (require("exceljs").Workbook)();
  await book.xlsx.load(excel.data);
  const texto = JSON.stringify(book.worksheets[0].getSheetValues());
  ok(
    excel.status === 200 &&
      texto.includes(String(mixta.id)) &&
      texto.includes("Kilo"),
    "Excel respeta filtros y unidades reales",
  );
  const pdfListado = await request(
    `/api/despachos/exportar?estado_despacho=TODOS&numero=${mixta.id}&formato=pdf`,
  );
  ok(
    pdfListado.status === 200 &&
      pdfListado.data.subarray(0, 4).toString() === "%PDF",
    "Exportacion PDF con filtros",
  );
  fs.writeFileSync(path.join(dir, "despachos.pdf"), pdfListado.data);
  console.log(
    `${checks} comprobaciones correctas. BD aislada: ${process.env.DB_NAME}`,
  );
  if (process.argv.includes("--serve")) {
    fs.writeFileSync(
      path.join(dir, "sesion.json"),
      JSON.stringify({
        token,
        user: {
          id: idUsuario,
          username: "prueba-despachos",
          nombre: "Usuario de prueba",
        },
        userMenu: require("../dist/constants/app-rutas").PROGRAMAS_SEED.map(
          (p, i) => ({
            id: i + 1,
            nombre: p.nombre_programa,
            url: p.url,
            classIcon: p.class_icon,
          }),
        ),
      }),
    );
    console.log(`API DE PRUEBA AISLADA: ${base}. Ctrl+C para detener.`);
    return;
  }
  await new Promise((resolve) => server.close(resolve));
  await m.sequelize.close();
}
main().catch(async (e) => {
  console.error(e);
  if (server) await new Promise((resolve) => server.close(resolve));
  await m.sequelize.close();
  process.exitCode = 1;
});
