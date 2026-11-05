# Producción — Fase 2: Control de descarguíos

## Alcance

Se incorpora el listado completo de descarguíos y el formulario de recepción,
manteniendo Angular 19, PrimeNG 19 y Sakai. Permite crear y consultar registros,
editar borradores, confirmar y anular con motivo y auditoría. Las siguientes
etapas de producción se mantienen en el alcance de sus propias fases.

El listado filtra por desde/hasta, productor, modalidad, variedad y estado. La
búsqueda abarca boleta, productor y código D. Paginación 10/20/50 y ordenación
se ejecutan en servidor. Conteos y cantidades corresponden a todos los resultados
filtrados; las cantidades se separan por modalidad, estado y unidad. Los borradores
y anulados no se presentan como existencia confirmada.

## Registro y propiedad

- Los códigos `D-año-correlativo` se asignan bajo bloqueo de una secuencia. El
  código se conserva al editar. El formulario no reserva ni muestra un número ficticio.
- Un borrador puede guardar datos pendientes y no crea lote ni movimientos.
- Confirmar exige productor real, producto de arroz, boleta, variedad, cantidad
  positiva y unidad reconocida. Humedad/impurezas aceptan 0–100; los valores no
  informados permanecen nulos. No se calcula peso ni merma por humedad.
- Los nombres de chofer, procedencia, localidad, responsable y observaciones son
  texto libre. La variedad admite texto y sugerencias de registros existentes.
- El productor se selecciona del catálogo existente o se crea desde el formulario
  sin crear un proveedor ni una compra. Los empaques no se admiten como arroz.
- Una ubicación escrita se reutiliza o se incorpora al catálogo al confirmar. No
  se crean catálogos paralelos de productos, productores o variedades.
- Cada lote conserva su operación, producto, modalidad, propietario, unidad,
  cantidad, ubicación e historial. La boleta externa no se considera globalmente
  única: las solicitudes técnicas tienen claves propias y el código D es único.

## Compra y servicio

**Compra:** debe vincular una línea de compra de chala ya recibida. Puede vincular
una parte de lo recibido y, opcionalmente, una recepción específica de una compra
anticipada. Se recuperan producto, unidad, productor, boleta, chofer y placa cuando
existen en Compras.

Antes de confirmar se bloquean y comprueban compra, detalle y producto. La cantidad
no puede superar lo recibido sin vincular, la recepción seleccionada ni las entradas
de inventario que respaldan esa compra/producto. Se comprueba también el stock
propio disponible frente a reservas y lotes propios activos. Las unidades de compra,
producto y lote deben coincidir; no hay conversiones implícitas.

El descarguío no vuelve a incrementar `productos.stock`, no cambia la cantidad
recibida de la compra y no genera otro movimiento en el libro de inventario propio.
Su entrada en `produccion_movimientos` documenta la trazabilidad del lote. Los lotes
propios representan existencias ya registradas, no una segunda entrada ni una nueva
reserva comercial. Las siguientes etapas deberán volver a comprobar el stock al
consumirlo, porque ventas y reservas pueden cambiar después de la recepción.

Si la compra aún no fue recibida, la confirmación se detiene con un mensaje para
registrar la recepción desde Compras. Esta fase no registra una recepción financiera
o física adicional por su cuenta ni modifica cuentas por pagar o caja.

**Servicio:** no admite compra asociada. El propietario es el productor seleccionado.
Se crea el lote de tercero y su movimiento de custodia; el stock propio, las compras,
ventas, pagos y caja permanecen fuera de esa operación.

## Confirmación, concurrencia y anulación

Las escrituras usan transacción. Las operaciones y lotes se bloquean al cambiar
de estado; la compra y su detalle serializan la asignación de cantidades recibidas.
Una versión evita sobrescribir borradores modificados por otra persona. Claves
únicas identifican creación, confirmación y movimientos. Reintentar la misma creación
con igual contenido o la misma confirmación no crea otro documento, lote o entrada.

Un confirmado no puede editarse. La anulación exige motivo y permiso de modificación.
Si existe lote, solo procede mientras permanezca íntegro en Descarguío y no tenga
referencias de otras operaciones, aunque esas referencias sean borradores. La entrada
se conserva y se registra un reverso; el lote queda anulado con saldo cero. Una compra
vinculada y su stock recibido se conservan. No se borran operaciones ni movimientos.

La API comprueba lectura para consultas, escritura para crear/confirmar y modificación
para editar/anular. La interfaz adapta los botones a los mismos permisos.

## PDF, impresión y Excel

Se reutiliza el generador de reportes actual. El control de descarguíos se imprime
en carta horizontal con encabezados completos y celdas de altura variable. El visor
PDF existente permite descargar e imprimir. Las exportaciones incluyen todos los
resultados filtrados y respetan la ordenación, no solo la página visible. Excel conserva
las cantidades como números con hasta tres decimales. No se suman unidades o modalidades
distintas ni se incluyen borradores en los totales confirmados.

Las opciones nuevas de orientación, precisión y totales del exportador son optativas;
los documentos anteriores mantienen sus opciones predeterminadas.

## Migración y comprobación

Desde `backend`, después de la migración de Fase 1:

```sh
npm run migrate:descarguios
node dist/scripts/verificar-descarguios.js
```

La migración agrega campos nulos para los datos de borrador y las claves de solicitud;
no migra ni reinterpreta operaciones comerciales existentes. Registra su versión y
puede repetirse. El ejecutor compara huellas de los datos comerciales antes y después.

La comprobación de negocio solo se habilita con `NODE_ENV=development`. Crea los datos
ficticios en una transacción y revierte todo al terminar, incluso si hay un error. No
deja productores, compras, descarguíos, lotes ni movimientos de prueba persistidos.
Los contadores autoincrementales de MySQL pueden avanzar aunque se revierta la transacción.
Compara también la huella de todos los registros persistentes antes y después. Genera
un PDF temporal de datos ficticios para revisar la composición; no lo agrega al repositorio.

## Archivos de esta fase

- `backend/package.json`: comando de migración de descarguíos.
- `backend/src/db/descarguio-schema.ts`: campos adicionales y versión.
- `backend/src/migrations/20261105-produccion-descarguios.ts`: migración incremental.
- `backend/src/scripts/migrar-descarguios.ts`: aplicación y control de datos anteriores.
- `backend/src/dtos/descarguio.dto.ts`: normalización y validaciones.
- `backend/src/servicios/descarguios.servicio.ts`: creación, edición, confirmación, propiedad, inventario y anulación.
- `backend/src/servicios/descarguios-consulta.servicio.ts`: listado, filtros y opciones de catálogos/recepciones.
- `backend/src/servicios/descarguios-reporte.servicio.ts`: datos del control exportado.
- `backend/src/controllers/descarguio.controller.ts`: acciones y creación rápida de productor.
- `backend/src/controllers/produccion-base.controller.ts`: permisos de acción y errores de validación.
- `backend/src/routes/produccion-base.routes.ts`: endpoints de descarguíos.
- `backend/src/utils/exportar.ts`: opciones puntuales de orientación, precisión y totales.
- `backend/src/scripts/verificar-descarguios.ts`: comprobaciones de negocio y exportación con reversión.
- `frontend/src/app/pages/produccion/produccion.routes.ts`: listado, nuevo y detalle.
- `frontend/src/app/pages/produccion/descarguios.service.ts`: contrato HTTP.
- `frontend/src/app/pages/produccion/produccion-permisos.ts`: visibilidad de acciones por permiso.
- `frontend/src/app/pages/produccion/descarguios.ts`: listado, filtros, resumen y exportaciones.
- `frontend/src/app/pages/produccion/descarguio-form.ts` y `.html`: formulario, consulta e historial.
- `frontend/src/app/shared/services/exportar.service.ts`: uso del endpoint y visor existentes.
- `frontend/src/app/shared/components/botones-exportar.ts`: filtros y ordenación del control.
- `docs/produccion-fase-2.md`: decisiones, alcance y revisión.

## Revisión manual

Validación ejecutada en `db_empresa_rojas`: compilación de backend y frontend,
migración con 33 tablas comerciales verificadas sin cambios, pruebas transaccionales
de las reglas anteriores y consultas de catálogos/filtros/permisos. La huella final
de los registros persistentes coincidió con la inicial; quedaron cero registros
de prueba. El PDF de 12 filas con nombres extensos ocupó cuatro páginas horizontales:
se revisaron las cuatro imágenes y se confirmó continuidad, textos completos y ausencia
de páginas vacías. Excel conservó las 12 cantidades como números de tres decimales.
Angular conserva las advertencias de presupuesto de tamaño del proyecto. No se utilizó
automatización del navegador; queda la revisión manual de la interacción del formulario.

Para repetir únicamente las consultas sin volver a ejecutar las pruebas de negocio:

```sh
node dist/scripts/verificar-descarguios.js --solo-consultas
```

1. Entrar en Operaciones → Producción → Descarguíos y abrir Nuevo descarguío.
2. Guardar un borrador, volver al listado y abrirlo para editar.
3. Confirmar un servicio y verificar el productor propietario y el lote; revisar
   que no aparece una entrada en el stock propio.
4. Vincular una compra recibida y confirmar una cantidad disponible; comprobar
   que el stock propio conserva el valor que tenía antes de vincularla.
5. Filtrar el listado y abrir PDF/Imprimir o Excel; revisar nombres largos y decimales.
6. Anular un registro sin procesos posteriores, indicando el motivo, y revisar su historial.
