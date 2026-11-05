# Producción de arroz — Fase 1

La base del módulo incorpora Resumen, Descarguíos, Secados, Guardados, Procesados,
Envasados y Lotes y trazabilidad dentro de Operaciones → Producción. Esta fase
ofrece consultas; los registros y confirmaciones se implementan en las fases 2–6.
No incluye datos ilustrativos ni transforma operaciones anteriores en lotes.

## Preparación y comprobación

Desde `backend`, con el `.env` de la base de desarrollo seleccionada:

```sh
npm run migrate:produccion
node dist/scripts/verificar-produccion-base.js
```

La migración crea 13 tablas operativas y `produccion_migraciones`. Se puede
repetir sin recrear tablas ni permisos. No utiliza `sync({ alter: true })` para
estas tablas. MySQL confirma DDL automáticamente: si una ejecución se interrumpe,
la siguiente continúa sobre las tablas creadas. Si encuentra columnas faltantes
en una tabla preexistente, se detiene para revisión sin modificarla.

El comando compara huellas de los registros de todas las tablas anteriores,
excepto los programas y permisos que debe agregar. Ejecutarlo sin actividad
concurrente permite comprobar que el inventario y las operaciones anteriores
se conservan. La comprobación posterior solo consulta; no genera operaciones.

Los programas nuevos otorgan acceso inicial al perfil Administrador/Admin y
dejan los demás perfiles sin acceso. Respeta permisos previamente configurados.
Cerrar sesión y volver a entrar actualiza el menú almacenado en el navegador.
La API comprueba el permiso de lectura de cada sección, aunque se acceda por URL.

## Estructura

| Tabla | Uso |
|---|---|
| produccion_ubicaciones | Silos y almacenes; admite jerarquía |
| produccion_operaciones | Cabecera común: tipo, modalidad, propietario, fecha, estado, usuario y confirmación/anulación |
| produccion_lotes | Producto, variedad, unidad, cantidades, etapa, ubicación y propiedad |
| produccion_operacion_lotes | Entradas/salidas parciales; enlaza varios lotes con una operación |
| produccion_descarguios | Boleta externa, transporte, calidad y vínculo con línea de compra/entrada existente |
| produccion_secados | Equipo, operador, inicio/fin y mediciones |
| produccion_guardados | Ubicación de destino |
| produccion_procesados | Máquina y mediciones del pilado |
| produccion_procesado_detalles | Varios productos resultantes con sus unidades y lotes |
| produccion_envasados | Producto de empaque, presentación, cantidad y equivalencia documentada |
| produccion_movimientos | Libro por lote, vínculo opcional al movimiento propio y referencia de reversión |
| produccion_auditoria | Usuario, fecha, evento y valores anteriores/posteriores |
| produccion_secuencias | Correlativos por tipo y gestión |

Se reutilizan `productos`, `productores`, `compras`, `compra_detalles`, `campanas`,
`movimientos_inventario`, `user`, `programas` y `perfil_programas`. El esquema
declarativo está aislado del arranque que sincroniza modelos antiguos; cambiar
estas estructuras requiere una migración explícita.

`COMPRA` con propietario nulo representa al ingenio. `SERVICIO` debe conservar
el identificador real del productor propietario. La confirmación en las fases
siguientes deberá validar esa relación, cantidades disponibles, unidades,
mediciones y estados bajo transacción y bloqueo. La estructura incluye claves
únicas de confirmación/movimiento y versiones para ese control.

El descarguío borrador puede no tener lote: el lote y sus cantidades efectivas
se crean al confirmar. Valores no medidos se guardan como nulos; no se infieren
conversiones o mermas a partir de la humedad.

Los movimientos de terceros se consultan por lote sin aumentar `productos.stock`.
Una entrada propia ya realizada por Compras se vinculará al descarguío; no se
repetirá. Las etapas que solo cambien condición/ubicación conservarán la cantidad.
Si se divide un lote se registran las relaciones de entrada/salida y los saldos
restantes, sin sumar existencias dos veces.

## Consultas

La API nueva es `/api/produccion/{resumen,operaciones,lotes,catalogos}`. El
historial anterior mantiene `/api/producciones` y su exportación existente.
No hay endpoints nuevos de escritura en esta fase.

Los listados paginan en servidor (10/20/50), validan filtros y permiten ordenar
mediante una lista de columnas autorizadas. Buscar incluye todos los registros
filtrados, no únicamente la página visible. Los totales se calculan antes de
paginar. Período, modalidad y productor se mantienen al buscar y ordenar.

Los indicadores se calculan sobre operaciones/lotes nuevos. Las existencias de
chala son saldos actuales de lotes originados en el período elegido, agrupados
por modalidad y unidad; no se suman fanegas con quintales o kg. Los datos
antiguos no se convierten ni se incluyen artificialmente en los indicadores.

El resumen conserva las ayudas, filtros, tablas, paginador, skeleton y tarjetas
del diseño Sakai existente. Los reportes operativos y el historial cronológico
detallado corresponden a las fases 7–8.

## Archivos de esta fase

- `backend/package.json`: comando de migración.
- `backend/src/constants/app-rutas.ts`: incorporación al catálogo de programas.
- `backend/src/constants/produccion.constants.ts`: programas, versión y permisos iniciales.
- `backend/src/db/produccion-schema.ts`: definición de las 13 tablas operativas.
- `backend/src/migrations/20261105-produccion-base.ts`: migración y permisos.
- `backend/src/scripts/migrar-produccion.ts`: ejecución y comprobación de datos anteriores.
- `backend/src/scripts/verificar-produccion-base.ts`: comprobación de consultas y permisos sin escribir operaciones.
- `backend/src/servicios/produccion-consulta.servicio.ts`: filtros, indicadores y paginación.
- `backend/src/controllers/produccion-base.controller.ts`: consultas y permisos por sección.
- `backend/src/routes/produccion-base.routes.ts`: endpoints de lectura.
- `backend/src/models/server.ts`: registro de la API nueva.
- `backend/src/seed/programas-caja.seed.ts`: permisos y jerarquía del módulo.
- `frontend/src/app.routes.ts`: ruta principal.
- `frontend/src/app/layout/component/app.menu.ts`: submenú condicionado a permisos.
- `frontend/src/app/pages/produccion/produccion.routes.ts`: siete pantallas y redirección inicial.
- `frontend/src/app/pages/produccion/produccion-base.service.ts`: contrato y consultas HTTP.
- `frontend/src/app/pages/produccion/produccion-base.ts`: resumen y listados Sakai.
- `docs/produccion-fase-1.md`: alcance, migración y decisiones.

## Revisión manual

1. Volver a iniciar sesión con Administrador para actualizar los permisos del menú.
2. Abrir las siete opciones de Operaciones → Producción; `/produccion` debe abrir Resumen.
3. Cambiar período y modalidad, consultar y verificar el mensaje vacío sin errores.
4. Revisar que Ventas, Compras, Inventario y Bolsas y empaques conserven sus registros.

La comprobación de esta fase no usa navegador automatizado ni registra operaciones
simuladas. La revisión visual manual queda a cargo del usuario.
