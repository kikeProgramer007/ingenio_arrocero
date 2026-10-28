import { Transaction } from "sequelize";
import {
  Despacho,
  Productos,
  ReservaProducto,
  ReservaVenta,
  Venta,
  VentaDetalle,
  VentaEntrega,
} from "../models";
import { aplicarStock, TIPO_INVENTARIO, toQty } from "../utils/inventario";

export const despachosHabilitados = () =>
  process.env.DESPACHOS_HABILITADOS === "true";
export class ErrorDespacho extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export function estadoEntrega(
  lineas: { vendido: number; entregado: number; pendiente: number }[],
): string {
  if (!lineas.length) return "NO_APLICA";
  if (lineas.every((l) => toQty(l.pendiente) === 0)) return "COMPLETO";
  return lineas.some((l) => toQty(l.entregado) > 0) ? "PARCIAL" : "PENDIENTE";
}
export function cantidadEntrega(valor: unknown, pendiente: number): number {
  const n = Number(valor);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    Math.abs(n - toQty(n)) > 0.0000001 ||
    n > pendiente
  ) {
    throw new ErrorDespacho(
      "Cantidad de entrega invalida o superior a lo pendiente",
      400,
    );
  }
  return toQty(n);
}
export async function contadorReserva(
  idProducto: number,
  transaction: Transaction,
) {
  // El producto debe estar bloqueado antes de crear/leer su contador.
  let contador = await ReservaProducto.findByPk(idProducto, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!contador)
    contador = await ReservaProducto.create(
      { id_producto: idProducto, cantidad: 0 },
      { transaction },
    );
  return contador;
}
export async function reservarLinea(
  detalle: any,
  transaction: Transaction,
): Promise<void> {
  const idProducto = Number(detalle.get("id_producto"));
  const producto = await Productos.findOne({
    where: { id: idProducto, eliminado: false },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!producto)
    throw new ErrorDespacho("Producto inexistente o inactivo", 400);
  const contador = await contadorReserva(idProducto, transaction);
  const cantidad = toQty(detalle.get("cantidad"));
  const reservado = toQty(contador.get("cantidad"));
  if (cantidad > toQty(Number(producto.get("stock")) - reservado))
    throw new ErrorDespacho(
      `Disponible insuficiente de ${producto.get("nombre")}`,
    );
  await contador.update(
    { cantidad: toQty(reservado + cantidad) },
    { transaction },
  );
  await ReservaVenta.create(
    {
      id_detalle: detalle.get("id"),
      id_venta: detalle.get("id_venta"),
      id_producto: idProducto,
      unidad: producto.get("unidad_medida"),
      vendido: cantidad,
      entregado: 0,
      pendiente: cantidad,
    },
    { transaction },
  );
}

export interface SolicitudDespacho {
  clave: string;
  persona_retira: string;
  fecha?: string;
  chofer?: string;
  placa?: string;
  ci?: string;
  marca?: string;
  color?: string;
  destino?: string;
  observacion?: string;
  lineas: { id_detalle: number; cantidad: number }[];
}
export async function registrarDespacho(
  idVenta: number,
  datos: SolicitudDespacho,
  idUsuario: number,
  transaction: Transaction,
) {
  if (
    !Number.isInteger(idVenta) ||
    idVenta <= 0 ||
    !datos ||
    typeof datos.clave !== "string" ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(datos.clave) ||
    (datos.persona_retira != null &&
      (typeof datos.persona_retira !== "string" || datos.persona_retira.length > 150)) ||
    !Array.isArray(datos.lineas) ||
    datos.lineas.some((l) => !l || typeof l !== "object") ||
    (datos.fecha !== undefined && typeof datos.fecha !== "string") ||
    (datos.chofer !== undefined &&
      (typeof datos.chofer !== "string" || datos.chofer.length > 150)) ||
    (datos.placa !== undefined &&
      (typeof datos.placa !== "string" || datos.placa.length > 30)) ||
    (datos.observacion !== undefined &&
      (typeof datos.observacion !== "string" ||
        datos.observacion.length > 4000))
  ) {
    throw new ErrorDespacho(
      "Indique clave, persona que retira y lineas validas",
      400,
    );
  }
  const venta = await Venta.findByPk(idVenta, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!venta) throw new ErrorDespacho("Venta inexistente", 404);
  const solicitud = JSON.stringify({
    idVenta,
    idUsuario,
    persona_retira: (datos.persona_retira || "").trim() || "Cliente",
    fecha: datos.fecha || null,
    chofer: datos.chofer || null,
    placa: datos.placa || null,
    observacion: datos.observacion || null,
    lineas: [...datos.lineas].sort((a, b) => a.id_detalle - b.id_detalle),
  });
  const previo = await Despacho.findOne({
    where: { clave: datos.clave },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (previo) {
    if (previo.get("solicitud") !== solicitud)
      throw new ErrorDespacho("La clave ya corresponde a otro despacho");
    return previo;
  }
  if (venta.get("estado") === "ANULADA")
    throw new ErrorDespacho("La venta esta anulada");
  const entrega = await VentaEntrega.findByPk(idVenta, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!entrega)
    throw new ErrorDespacho(
      "Venta anterior: requiere revision separada; no se puede volver a descontar stock",
    );
  const fecha = datos.fecha ? new Date(datos.fecha) : new Date();
  const fechaVenta = new Date(venta.get("fecha") as string | Date);
  const maximo = new Date();
  maximo.setDate(maximo.getDate() + 365);
  maximo.setHours(23, 59, 59, 999);
  if (
    !Number.isFinite(fecha.getTime()) ||
    !Number.isFinite(fechaVenta.getTime()) ||
    fecha < fechaVenta ||
    fecha > maximo
  )
    throw new ErrorDespacho("Fecha de despacho invalida", 400);
  const reservas = await ReservaVenta.findAll({
    where: { id_venta: idVenta },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [
      ["id_producto", "ASC"],
      ["id_detalle", "ASC"],
    ],
  });
  const cantidades = new Map<number, number>();
  for (const l of datos.lineas) {
    if (!Number.isInteger(l.id_detalle) || cantidades.has(l.id_detalle))
      throw new ErrorDespacho("Linea duplicada o invalida", 400);
    const reserva = reservas.find((r) => r.get("id_detalle") === l.id_detalle);
    if (!reserva)
      throw new ErrorDespacho(
        "La linea no pertenece a los productos de la venta",
        400,
      );
    cantidades.set(
      l.id_detalle,
      cantidadEntrega(l.cantidad, toQty(reserva.get("pendiente"))),
    );
  }
  if (![...cantidades.values()].some((n) => n > 0))
    throw new ErrorDespacho(
      "Debe entregar al menos una cantidad positiva",
      400,
    );
  const despacho = await Despacho.create(
    {
      id_venta: idVenta,
      clave: datos.clave,
      fecha,
      persona_retira: (datos.persona_retira || '').trim() || 'Cliente',
      id_usuario: idUsuario,
      chofer: datos.chofer?.trim() || null,
      placa: datos.placa?.trim() || null,
      ci: datos.ci?.trim() || null,
      marca: datos.marca?.trim() || null,
      color: datos.color?.trim() || null,
      destino: datos.destino?.trim() || null,
      observacion: datos.observacion?.trim() || null,
      solicitud,
      lineas: [],
    },
    { transaction },
  );
  const snapshot: any[] = [];
  for (const r of reservas) {
    const cantidad = cantidades.get(Number(r.get("id_detalle"))) || 0;
    if (!cantidad) continue;
    const idProducto = Number(r.get("id_producto"));
    await Productos.findByPk(idProducto, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const contador = await contadorReserva(idProducto, transaction);
    if (toQty(contador.get("cantidad")) < cantidad)
      throw new ErrorDespacho("Reserva inconsistente; revise inventario");
    await contador.update(
      { cantidad: toQty(Number(contador.get("cantidad")) - cantidad) },
      { transaction },
    );
    const pendiente = toQty(Number(r.get("pendiente")) - cantidad);
    await r.update(
      { pendiente, entregado: toQty(Number(r.get("entregado")) + cantidad) },
      { transaction },
    );
    const stock = await aplicarStock({
      transaction,
      idProducto,
      delta: -cantidad,
      tipo: TIPO_INVENTARIO.SALIDA,
      origen: "DESPACHO",
      origenId: Number(despacho.get("id")),
      idUsuario,
      observacion: `Despacho #${despacho.get("id")} - venta #${idVenta}`,
    });
    if (!stock.ok) throw new ErrorDespacho(stock.mensaje);
    const detalle = await VentaDetalle.findByPk(Number(r.get("id_detalle")), {
      transaction,
    });
    snapshot.push({
      id_detalle: r.get("id_detalle"),
      id_producto: idProducto,
      descripcion: detalle?.get("descripcion"),
      unidad: r.get("unidad"),
      cantidad,
      pendiente,
    });
  }
  await despacho.update({ lineas: snapshot }, { transaction });
  await entrega.update(
    {
      estado: estadoEntrega(
        reservas.map((r) => ({
          vendido: Number(r.get("vendido")),
          entregado: Number(r.get("entregado")),
          pendiente: Number(r.get("pendiente")),
        })),
      ),
    },
    { transaction },
  );
  return despacho;
}
export async function liberarReservas(
  idVenta: number,
  transaction: Transaction,
): Promise<void> {
  const reservas = await ReservaVenta.findAll({
    where: { id_venta: idVenta },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["id_producto", "ASC"]],
  });
  if (reservas.some((r) => Number(r.get("entregado")) > 0))
    throw new ErrorDespacho(
      "La venta tiene entregas. Registre una devolucion fisica antes de anular; ese flujo aun no esta disponible.",
    );
  for (const r of reservas) {
    const idProducto = Number(r.get("id_producto"));
    await Productos.findByPk(idProducto, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const contador = await contadorReserva(idProducto, transaction);
    const cantidad = toQty(
      Number(contador.get("cantidad")) - Number(r.get("pendiente")),
    );
    if (cantidad < 0) throw new ErrorDespacho("Reserva inconsistente");
    await contador.update({ cantidad }, { transaction });
    await r.update({ pendiente: 0 }, { transaction });
  }
  await VentaEntrega.update(
    { estado: "ANULADA" },
    { where: { id_venta: idVenta }, transaction },
  );
}
