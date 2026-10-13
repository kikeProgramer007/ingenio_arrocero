const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");
require("reflect-metadata");
const {
  estadoEntrega,
  cantidadEntrega,
} = require("../dist/servicios/despachos.servicio");
const { hojaNotaEntrega } = require("../dist/controllers/despacho.controller");
const { enviarPdf } = require("../dist/utils/exportar");
const { DtoValidator } = require("../dist/utils/dto.validador");
const { CrearVentaDTO } = require("../dist/dtos/venta.dto");
async function main() {
  assert.equal(estadoEntrega([]), "NO_APLICA");
  assert.equal(
    estadoEntrega([{ vendido: 100, entregado: 0, pendiente: 100 }]),
    "PENDIENTE",
  );
  assert.equal(
    estadoEntrega([{ vendido: 100, entregado: 40, pendiente: 60 }]),
    "PARCIAL",
  );
  assert.equal(
    estadoEntrega([{ vendido: 100, entregado: 100, pendiente: 0 }]),
    "COMPLETO",
  );
  assert.equal(
    estadoEntrega([
      { vendido: 100, entregado: 100, pendiente: 0 },
      { vendido: 2.5, entregado: 0, pendiente: 2.5 },
    ]),
    "PARCIAL",
  );
  assert.equal(cantidadEntrega(0, 60), 0);
  assert.equal(cantidadEntrega(60, 60), 60);
  assert.equal(cantidadEntrega(1.125, 2.5), 1.125);
  for (const n of [-1, 61, NaN, Infinity, 0.0001])
    assert.throws(() => cantidadEntrega(n, 60));
  const datos = {
    id_cliente: 1,
    entrega: "PARCIAL",
    clave: "clave-prueba-123",
    persona_retira: "Retira prueba",
    lineas: [
      {
        id_producto: 1,
        cantidad: 2.125,
        precio_unitario: 10,
        entregar_ahora: 1,
      },
    ],
  };
  assert.equal(
    (await DtoValidator.validate(CrearVentaDTO, datos)).isValid,
    true,
  );
  assert.equal(
    (await DtoValidator.validate(CrearVentaDTO, { ...datos, entrega: "OTRA" }))
      .isValid,
    false,
  );
  assert.equal(
    (
      await DtoValidator.validate(CrearVentaDTO, {
        ...datos,
        lineas: [{ ...datos.lineas[0], cantidad: 1.0001 }],
      })
    ).isValid,
    false,
  );
  const hoja = hojaNotaEntrega({
    id: 1,
    id_venta: 12,
    fecha: "2026-10-13T14:30:00Z",
    persona_retira: "Persona de prueba",
    usuario: { nombre: "Usuario de prueba" },
    venta: { cliente: { nombre: "Cliente de prueba" } },
    chofer: "Chofer de prueba",
    placa: "PRB-123",
    observacion: "Retiro parcial de prueba",
    lineas: [
      {
        descripcion: "Arroz de prueba",
        unidad: "Quintal",
        cantidad: 40,
        pendiente: 60,
      },
      {
        descripcion: "Producto de prueba",
        unidad: "Kilo",
        cantidad: 1.125,
        pendiente: 1.375,
      },
    ],
  });
  assert.equal(hoja.titulo, "NOTA DE ENTREGA");
  assert.equal(hoja.tituloSecundario, "NE-000001");
  assert.equal(hoja.filas[0][3], "60");
  assert.ok(hoja.consulta.some((c) => c.label.includes("firma")));
  const response = new PassThrough();
  response.setHeader = () => {};
  const chunks = [];
  response.on("data", (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    response.on("end", resolve);
    response.on("error", reject);
  });
  enviarPdf(response, "nota-entrega", [hoja]);
  await finished;
  const pdf = Buffer.concat(chunks);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const dir = path.resolve(__dirname, "../tmp/despachos-verificacion");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "nota-entrega.pdf"), pdf);
  const responseLargo = new PassThrough();
  responseLargo.setHeader = () => {};
  const largos = [];
  responseLargo.on("data", (c) => largos.push(c));
  const finLargo = new Promise((resolve, reject) => {
    responseLargo.on("end", resolve);
    responseLargo.on("error", reject);
  });
  enviarPdf(responseLargo, "nota-entrega-larga", [
    {
      ...hoja,
      filas: Array.from({ length: 55 }, (_, i) => [
        `Producto ${i + 1} con descripcion extensa y variedad de arroz de prueba para verificar saltos de pagina`,
        i % 2 ? "Kilo" : "Quintal",
        "1.125",
        "60",
      ]),
    },
  ]);
  await finLargo;
  fs.writeFileSync(
    path.join(dir, "nota-entrega-larga.pdf"),
    Buffer.concat(largos),
  );
  console.log(
    "21 comprobaciones correctas: estados, cantidades, DTO y generacion PDF. Sin conexion a BD.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
