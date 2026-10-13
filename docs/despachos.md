# Despachos de ventas

## Auditoria previa

| Requerimiento | Existia | Cambio |
|---|---|---|
| Venta / cobranza / despacho | Venta descontaba stock; cobranza separada | Venta reserva; despacho produce salida fisica |
| Disponibilidad | Solo stock fisico | Stock menos contador de reservas; validacion bajo bloqueo de producto |
| Parciales | Sin historial | Reservas por linea y despachos inmutables con cantidades y pendientes historicos |
| Caja | Obligatoria para cobros | Despacho independiente de caja; cobranza conserva sus reglas |
| Permisos | Programas y perfil_programas | Programa /despachos y comprobacion backend de lectura/escritura |
| PDF | Exportador formal y logo de empresa | Nota de entrega NE con folio independiente y reimpresion |
| Anulacion | Reponia toda la venta | Nueva venta sin entrega libera reserva; entregada bloqueada sin devolucion fisica |
| Historicos | Stock ya descontado | Sin reclasificacion, nuevas reservas ni movimientos |

## Transicion acordada

El usuario eligio aplicar el flujo exclusivamente a ventas nuevas y resolver las antiguas por separado. Las ventas sin registro en `ventas_entrega` se muestran como **Anterior: por revisar**, no entran al listado de despachos y no admiten otro descuento. Cuando el flujo esta habilitado, se bloquea anular ventas anteriores con productos hasta resolverlas por separado. No se reconstruye stock ni se modifican saldos financieros anteriores.

## Preparacion y activacion

El usuario confirmo que la base de `.env` es desarrollo y autorizo usarla. Se aplico la migracion `backend/src/migrations/20261013-despachos.ts` sobre esa base, llamada `test`. Creo las cuatro tablas nuevas y el programa del menu con permisos por perfil. La comparacion de huellas anterior/posterior confirmo que las ventas y el stock existentes no cambiaron.

Se configuro `DESPACHOS_HABILITADOS=true` en `backend/.env`. El API existente del puerto 3001 informa que esta habilitado. Las 6 ventas anteriores se conservan para resolver sus retiros por separado.

Para repetir la migracion idempotente, desde `backend` ejecutar `npm run migrate:despachos`. Solo crea estructura faltante mediante `force: false, alter: false`; no reconstruye inventario. Iniciar sesion otra vez para actualizar los programas del menu.

El arranque habitual tambien registra las tablas nuevas mediante su `sequelize.sync`. El resto de rutinas de esquema del proyecto permanece igual; la migracion especifica no depende de `DB_SYNC_ALTER`.

## Tablas

- `ventas_entrega`: identifica ventas nuevas, estado de despacho, clave unica y huella de solicitud.
- `reservas_producto`: contador reservado por producto. Se actualiza bajo el mismo bloqueo del producto que protege las salidas.
- `reservas_venta`: cantidades vendidas, entregadas y pendientes por detalle, con unidad original.
- `despachos`: folio independiente, usuario, fecha, persona, transporte y fotografia JSON de las lineas y pendientes posteriores. No hay endpoints de modificacion ni borrado.

Venta, reserva, despacho inicial, cobranza y movimientos se guardan en una transaccion. Los productos se bloquean en orden de ID. Para un despacho posterior se bloquea primero la venta; el contador se consulta con bloqueo, evitando lecturas antiguas bajo REPEATABLE READ. Las claves unicas impiden duplicar venta/despacho por reintento; reutilizarlas con otro contenido se rechaza.

Las salidas por ajustes, produccion, compras anuladas y ventas con logica anterior pasan por `aplicarStock`, que impide consumir reservas. No se permiten cambios de unidad con reservas pendientes. Las cantidades mantienen tres decimales y la unidad existente del producto; no se mezclan unidades en totales.

## Pantallas y documentos

El drawer de venta conserva catalogo y datos financieros. Permite entrega completa, parcial o posterior; el formulario de despacho se reutiliza desde Ventas y Despachos. El inventario muestra fisico, reservado, disponible y ventas con reserva. El kardex referencia el despacho y la venta.

Despachos pagina en backend, filtra cliente, numero, fechas de venta y estado. Excel/PDF usan los filtros de la ultima consulta aplicada, sin limitarse a la pagina visible. Las notas NE incluyen cantidades de esa entrega y pendiente posterior, no el pendiente actual de otra entrega.

## Validacion

Comandos desde `backend`:

```powershell
npm run test:despachos:rules
npm run test:despachos:env
npm run test:despachos:api
npm run test:despachos
```

`test:despachos:env` usa la base configurada en `.env`: revierte los escenarios simples y elimina por UUID los fixtures de concurrencia. `test:despachos:api` prueba el backend existente, usa ventas/productos temporales identificados por UUID y los limpia al terminar. No modifica cajas ni cobranzas anteriores. Las bajas de fixtures son exclusivas de pruebas; no existen endpoints para borrar despachos reales.

Se verificaron 18 escenarios de reservas/despachos en la base actual, 13 comprobaciones HTTP y 21 comprobaciones de reglas/DTO/PDF sin conexion. Compilan backend y frontend en desarrollo. El API devuelve configuracion habilitada, ventas, disponibilidad y exportaciones PDF/Excel. Se revisaron visualmente notas PDF corta/larga.

`test:despachos` ejecuta reglas, integracion de BD y pruebas HTTP sobre la base actual de `.env`; el backend debe estar corriendo para la parte HTTP.

La prueba opcional `test:despachos:isolated` usa una instancia MariaDB local aislada, ignora `.env` y crea una base `test_despachos_<fecha>`. No es necesaria para verificar la base actual. No borra bases existentes ni usa `force: true`.

Cubre venta pagada sin entrega, credito completo, entregas parciales y sucesivas, varias unidades, servicios, sobreventa, rollback, anulacion, doble clic, concurrencia, caja cerrada, permisos, kardex, consultas y exportaciones. Las reglas puras y generacion PDF se ejecutan sin BD.

## Limites deliberados

La verificacion HTTP no registra cobros reales sobre cajas existentes. El dinero conserva el flujo previo de cobranza, mientras que estas pruebas verifican que despachar no modifica la deuda. El script de fixtures visuales opcional esta en `frontend/tests/despachos.visual.cjs`. Se revisaron la pantalla real de Despachos y el drawer de Venta en escritorio/movil contra el API de desarrollo; se acoto el catalogo movil y se agrego respaldo para fotos de producto no disponibles.

No hay flujo de devolucion fisica en el proyecto: por eso se bloquea anular una venta nueva con cualquier entrega. La devolucion monetaria sigue las reglas existentes de caja para una venta anulable; no produce entradas fisicas. Una correccion de despacho confirmado necesita un futuro flujo de devolucion con motivo y usuario, no editar/borrar el despacho.

El listado excluye historicos sin clasificar. Su resolucion requiere un procedimiento independiente que concilie stock ya descontado y retiros reales. Esta implementacion no inventa despachos antiguos.
