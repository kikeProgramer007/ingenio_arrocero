import { NextFunction, Request, Response } from "express";
import { Op, UniqueConstraintError } from "sequelize";
import {
  Despacho,
  PerfilProgramas,
  Programas,
  ReservaProducto,
  ReservaVenta,
  sequelize,
  User,
  Venta,
  VentaEntrega,
  Cliente,
} from "../models";
import { includesVenta, mapVenta } from "./venta.controller";
import {
  despachosHabilitados,
  ErrorDespacho,
  registrarDespacho,
} from "../servicios/despachos.servicio";
import { getAuthUser, nombreVisible } from "../utils/auth-user";
import { enviarExcel, enviarPdf, HojaExport } from "../utils/exportar";
import { aplicarFiltroFecha } from "../utils/fecha";
import { handleError } from "../utils/error.handler";
import { COLUMNAS_DOCUMENTOS } from "../utils/columnas-documentos";

export async function permisoDespacho(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await User.findByPk(getAuthUser(req)?.id);
    const programa = await Programas.findOne({
      where: { url: "/despachos", eliminado: false },
    });
    const permiso =
      programa && user
        ? await PerfilProgramas.findOne({
            where: {
              id_perfil: user.get("id_perfil"),
              id_programa: programa.get("id"),
            },
          })
        : null;
    const campo =
      req.method === "GET" ? "permiso_lectura" : "permiso_escritura";
    if (!user?.get("activo") || user.get("eliminado") || !permiso?.get(campo)) {
      res.status(403).json({ mensaje: "No tiene permiso para despachos" });
      return;
    }
    next();
  } catch (error) {
    handleError(res, error, "Error al validar permiso de despachos");
  }
}

function consulta(req: Request) {
  const where: any = { estado: { [Op.ne]: "ANULADA" } };
  for (const campo of ["id_cliente", "numero"]) {
    if (
      req.query[campo] &&
      (!Number.isInteger(Number(req.query[campo])) ||
        Number(req.query[campo]) <= 0)
    )
      throw new ErrorDespacho("Cliente o numero de venta invalido", 400);
  }
  if (req.query.id_cliente) where.id_cliente = Number(req.query.id_cliente);
  if (req.query.numero) where.id = Number(req.query.numero);
  aplicarFiltroFecha(where, req.query);
  const estado = String(req.query.estado_despacho || "ABIERTOS");
  if (
    ![
      "ABIERTOS",
      "TODOS",
      "PENDIENTE",
      "PARCIAL",
      "COMPLETO",
      "NO_APLICA",
    ].includes(estado)
  )
    throw new ErrorDespacho("Estado de despacho invalido", 400);
  const campoOrden = String(req.query.sortField || "fecha");
  const direccion = String(req.query.sortOrder) === "1" ? "ASC" : "DESC";
  const ordenes: Record<string, any[]> = {
    id: [["id", direccion]],
    fecha: [["fecha", direccion]],
    cliente: [[{ model: Cliente, as: "cliente" }, "nombre", direccion]],
    estado: [["estado", direccion]],
    estado_despacho: [[{ model: VentaEntrega, as: "entrega" }, "estado", direccion]],
  };
  if (!ordenes[campoOrden])
    throw new ErrorDespacho("Columna de ordenamiento invalida", 400);
  return {
    where,
    include: includesVenta.map((i) =>
      i.as === "entrega"
        ? {
            ...i,
            required: true,
            ...(estado !== "TODOS"
              ? {
                  where: {
                    estado:
                      estado === "ABIERTOS"
                        ? { [Op.in]: ["PENDIENTE", "PARCIAL"] }
                        : estado,
                  },
                }
              : {}),
          }
        : i,
    ),
    order: [...ordenes[campoOrden], ["id", "DESC"]] as any,
  };
}
function errorRespuesta(res: Response, error: unknown) {
  if (error instanceof ErrorDespacho)
    res.status(error.status).json({ mensaje: error.message });
  else if (error instanceof UniqueConstraintError)
    res.status(409).json({ mensaje: "La clave de solicitud ya fue utilizada" });
  else handleError(res, error, "Error al procesar despacho");
}
function hojaListado(ventas: any[], req: Request): HojaExport {
  return {
    nombre: "Despachos",
    titulo: "DESPACHOS DE VENTAS",
    plantilla: "formal",
    consulta: Object.entries(req.query)
      .filter(([k]) => !["pagina", "limite", "formato", "sortField", "sortOrder"].includes(k))
      .map(([label, valor]) => ({ label, valor: String(valor) })),
    columnas: COLUMNAS_DOCUMENTOS.despachos,
    filas: ventas.flatMap((v) =>
      (v.detalles || [])
        .filter((l: any) => l.id_producto)
        .map((l: any) => [
          String(v.id),
          new Date(v.fecha).toLocaleDateString("es-BO"),
          v.cliente?.nombre || "",
          v.estado,
          v.estado_despacho,
          l.descripcion,
          l.unidad || "",
          String(l.cantidad),
          String(l.entregado),
          String(l.pendiente),
        ]),
    ),
  };
}
export class DespachoController {
  static async config(_req: Request, res: Response) {
    res.json({ habilitado: despachosHabilitados() });
  }
  static async listar(req: Request, res: Response) {
    try {
      const pagina = Math.max(1, Math.floor(Number(req.query.pagina) || 1));
      const limite = Math.min(
        100,
        Math.max(1, Math.floor(Number(req.query.limite) || 10)),
      );
      const opciones = consulta(req);
      const resultado = await Venta.findAndCountAll({
        ...opciones,
        // Las colecciones se cargan aparte para no multiplicar ventas al paginar.
        include: opciones.include.map((i) =>
          ["reservas", "detalles", "cobranzas"].includes(i.as)
            ? { ...i, separate: true }
            : i,
        ),
        subQuery: false,
        distinct: true,
        limit: limite,
        offset: (pagina - 1) * limite,
      });
      res.json({
        data: resultado.rows.map(mapVenta),
        total: resultado.count,
        pagina,
        limite,
      });
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
  static async crear(req: Request, res: Response) {
    if (!despachosHabilitados()) {
      res.status(409).json({ mensaje: "Despachos aun no habilitados" });
      return;
    }
    try {
      const despacho = await sequelize.transaction((t) =>
        registrarDespacho(
          Number(req.params.id),
          req.body,
          getAuthUser(req)!.id,
          t,
        ),
      );
      res.json({ mensaje: "Despacho confirmado", data: despacho });
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
  static async historial(req: Request, res: Response) {
    try {
      res.json(
        await Despacho.findAll({
          where: { id_venta: Number(req.params.id) },
          include: [
            {
              model: User,
              as: "usuario",
              attributes: ["id", "nombre", "username"],
            },
          ],
          order: [["id", "DESC"]],
        }),
      );
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
  static async reservas(req: Request, res: Response) {
    try {
      const filas = await ReservaVenta.findAll({
        where: {
          id_producto: Number(req.params.id),
          pendiente: { [Op.gt]: 0 },
        },
        include: [
          {
            model: Venta,
            as: "venta",
            include: [
              { model: Cliente, as: "cliente", attributes: ["id", "nombre"] },
            ],
          },
        ],
      });
      res.json(filas);
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
  static async exportar(req: Request, res: Response) {
    try {
      const ventas = (await Venta.findAll(consulta(req))).map(mapVenta);
      const hoja = hojaListado(ventas, req);
      if (req.query.formato === "xlsx")
        await enviarExcel(res, "despachos", [hoja]);
      else enviarPdf(res, "despachos", [hoja]);
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
  static async nota(req: Request, res: Response) {
    try {
      const despacho: any = await Despacho.findByPk(req.params.id, {
        include: [
          {
            model: Venta,
            as: "venta",
            include: [{ model: Cliente, as: "cliente" }],
          },
          { model: User, as: "usuario" },
        ],
      });
      if (!despacho) {
        res.status(404).json({ mensaje: "Despacho inexistente" });
        return;
      }
      enviarPdf(res, `nota-entrega-${despacho.id}`, [
        hojaNotaEntrega(despacho),
      ]);
    } catch (error) {
      errorRespuesta(res, error);
    }
  }
}
export function hojaNotaEntrega(d: any): HojaExport {
  return {
    nombre: "Nota de entrega",
    titulo: "NOTA DE ENTREGA",
    tituloSecundario: `NE-${String(d.id).padStart(6, "0")}`,
    plantilla: "formal",
    mostrarFirma: true,
    textoCompleto: true,
    usuario: nombreVisible(d.usuario),
    consulta: [
      { label: "Venta", valor: `#${d.id_venta}` },
      { label: "Cliente", valor: d.venta?.cliente?.nombre || "" },
      { label: "Fecha/hora", valor: new Date(d.fecha).toLocaleString("es-BO") },
      { label: "Chofer", valor: d.chofer || "" },
      { label: "CI", valor: d.ci || "" },
      { label: "Placa", valor: d.placa || "" },
      { label: "Marca", valor: d.marca || "" },
      { label: "Color", valor: d.color || "" },
      { label: "Destino", valor: d.destino || "" },
      { label: "Usuario que entrega", valor: nombreVisible(d.usuario) },
      { label: "Observacion", valor: d.observacion || "" },
      {
        label: "Firma del chofer",
        valor: "________________________________",
      },
    ],
    columnas: COLUMNAS_DOCUMENTOS.nota_entrega,
    filas: d.lineas.map((l: any) => [
      l.descripcion,
      l.unidad,
      String(l.cantidad),
      String(l.pendiente),
    ]),
  };
}
