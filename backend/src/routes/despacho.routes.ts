import { Router } from "express";
import validateToken from "./validate-token";
import {
  DespachoController as C,
  permisoDespacho,
} from "../controllers/despacho.controller";
const router = Router();
router.use(validateToken);
router.get("/config", C.config);
router.use(permisoDespacho);
router.get("/", C.listar);
router.get("/exportar", C.exportar);
router.get("/productos/:id/reservas", C.reservas);
router.get("/ventas/:id", C.historial);
router.post("/ventas/:id", C.crear);
router.get("/:id/nota", C.nota);
export default router;
