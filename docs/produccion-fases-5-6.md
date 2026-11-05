# Fases 5 y 6: Procesados / Pilado y Envasados

Rama: `empresa_rojas`. Base de desarrollo configurada: `db_empresa_rojas`.

## Entrega

Procesados permite seleccionar uno o varios lotes guardados compatibles, indicar la cantidad parcial de chala consumida y registrar hasta 30 productos obtenidos. Cada resultado identifica un producto real del catálogo, clasificación editable, cantidad, unidad, observación y peso medido opcional. Máquina, responsable, destino y observaciones admiten entrada manual.

Envasados parte de un lote procesado, conserva su propietario y clasificación, y registra producto terminado, presentación personalizada, número de envases, contenido explícito en kg y tipo de bolsa del catálogo existente. Permite destino por Unidad, Kilo o las otras unidades admitidas cuando se informa una equivalencia explícita.

Ambas pantallas tienen borradores, confirmación, anulación motivada, historial, filtros de servidor, búsqueda, ordenamiento, skeletons, paginación 10/25/50/100 y exportación de toda la consulta a Excel y PDF/impresión. Se conserva el diseño PrimeNG/Sakai y se reutilizan los servicios de avisos, confirmación, exportación y controles numéricos.

## Stock y propiedad

- Procesado propio: resta chala de los lotes y del stock comercial; suma únicamente las cantidades reales de cada producto obtenido. No agrega otra compra ni afecta caja, proveedores o cuentas por pagar.
- Procesado de tercero: consume sus lotes de custodia y genera resultados a nombre del mismo productor; no suma arroz al inventario propio.
- Envasado propio: consume arroz a granel, descuenta bolsas y suma el producto envasado correspondiente.
- Envasado de tercero: conserva la custodia del arroz y descuenta únicamente las bolsas utilizadas del inventario de empaques del ingenio. No se supone que las bolsas sean aportadas por el productor.
- Cada resultado tiene lote propio y vínculo con la operación y sus orígenes. El saldo sin procesar permanece en el origen.
- No se mezclan propietarios, productos de origen, variedades ni unidades incompatibles.
- El producto de salida se diferencia de la materia prima y, en Envasados, también de la bolsa vacía.

Las confirmaciones usan transacción, bloqueos de operación/lotes/productos, versión optimista y claves idempotentes. Se validan disponibles y reservas. Los movimientos comerciales se vinculan mediante `produccion_inventario_vinculos`; sus orígenes son `PILADO_ARROZ` y `ENVASADO_ARROZ`, evitando confundirlos con identificadores del módulo histórico.

La anulación comprueba dependencias, cantidades remanentes y respaldo comercial del resultado antes de revertir. Conserva movimientos originales y agrega sus reversos. No permite volver a ingresar bolsas ni arroz por repetir una anulación. Debe revertirse desde el final de la cadena.

## Medidas y cálculos

- No existe equivalencia fija de fanega o quintal en estas fases.
- En Procesados los resultados se registran en la unidad configurada de cada producto. No se suman unidades diferentes.
- El rendimiento se calcula con kilos comparables: peso medido de entrada y peso de todos los resultados, o cantidades que ya estén expresadas en Kilo. Si falta una medición, se muestra que no es calculable.
- El rendimiento ponderado del listado solo aparece si todos los procesados confirmados de la consulta tienen pesos completos.
- Se conserva la diferencia de pesos separada de la merma declarada. No se registra automáticamente una pérdida porque exista una diferencia o disminución de humedad.
- En Envasados, número de envases × contenido en kg determina el peso total. Si el origen está en Quintal/Fanega/Unidad, se exige informar kg por unidad y su referencia. El consumo debe coincidir con esa medición.
- Si el destino se mide por Unidad, cada envase es una unidad. Si está en Kilo, se ingresan los kilos. Para otra unidad, se exige su propia equivalencia explícita.
- Se rechazan cantidades cuya conversión no puede representarse de forma consistente con los tres decimales del inventario.
- Las equivalencias y el origen de la medición quedan guardados en el documento. El servidor recalcula los valores derivados y no confía en totales enviados por el frontend.

## Migración y archivos principales

`npm run migrate:transformaciones` desde backend aplica la migración incremental `20261105-produccion-transformaciones`. Añade destino y medidas de Envasados, permite borradores incompletos y crea el vínculo con movimientos de inventario. La migración se ejecutó verificando que las 33 tablas comerciales conservaran sus registros.

Backend:

- `src/migrations/20261105-produccion-transformaciones.ts`
- `src/scripts/migrar-transformaciones.ts`
- `src/dtos/produccion-transformacion.dto.ts`
- `src/servicios/produccion-transformaciones.servicio.ts`
- `src/servicios/produccion-transformaciones-consulta.servicio.ts`
- `src/controllers/produccion-transformaciones.controller.ts`
- `src/routes/produccion-base.routes.ts` y `src/controllers/produccion-base.controller.ts`: rutas, permisos y versión de migración por etapa.
- `src/scripts/verificar-transformaciones.ts` y `src/scripts/verificar-transformaciones-consultas.ts`.
- `package.json`: comando de migración.

Frontend:

- `src/app/pages/produccion/produccion-transformaciones.ts` y `.html`: listados.
- `src/app/pages/produccion/produccion-transformacion-form.ts` y `.html`: formularios.
- `src/app/pages/produccion/produccion-etapas.service.ts`: acceso a las nuevas rutas.
- `src/app/pages/produccion/produccion-etapa-form.ts`: puntos protegidos para reutilizar el ciclo de guardado, confirmación e historial sin duplicarlo.
- `src/app/pages/produccion/produccion-etapas.ts`: tipos de títulos reutilizables.
- `src/app/pages/produccion/produccion.routes.ts`: rutas de listado, nuevo y detalle.
- `src/app/shared/services/exportar.service.ts`: exportación por las nuevas rutas con el visor existente.

## Validación

Compilación de backend y frontend. El frontend mantiene las advertencias previas de tamaño de bundles/estilos.

Pruebas integradas en desarrollo y con rollback:

- Pilado parcial propio: consumo exacto de chala y entradas exactas de tres productos diferentes.
- Custodia de terceros: se conserva productor/propietario sin aumentar stock comercial de arroz.
- Envasado parcial: consumo exacto, bolsas, peso total y producto terminado.
- Equivalencias ausentes, unidades de resultado incorrectas y presentaciones personalizadas.
- Prevención de mezcla de arroz propio con terceros, cantidades excesivas y versiones obsoletas.
- Idempotencia de creación, confirmación y anulación; registros confirmados inmutables.
- Falta de bolsas después de iniciar los movimientos: la operación completa se revierte, incluyendo arroz y vínculos de inventario.
- Reservas del resultado impiden anular. Tras liberarlas se restauran stock, bolsas y saldos mediante reversos.
- Filtros, resúmenes, paginación y exportación de todas las filas.
- Sin nuevas compras, ventas, pagos o movimientos de caja por estas operaciones.
- Huellas de todas las tablas iguales antes y después de las pruebas: cero registros ficticios persistidos. Los contadores autoincrementales pueden avanzar pese al rollback.
- Comprobación puntual adicional de rendimiento ponderado, clasificación heredada, catálogo de bolsas y filtros legibles en PDF.
- Revisión de PDF con nombres extensos, varios productos y varias páginas, usando el generador existente. Los pesos se muestran como kg y no como importes.

No se utilizó navegador ni Playwright, ni se instalaron herramientas o servicios.

## Continuación

La revisión manual del usuario se realizará al culminar las fases, según su indicación. Para entonces conviene revisar un pilado y envasado parcial propios, repetir el mismo recorrido para un tercero, probar falta de bolsas, revisar exportaciones y anular desde Envasados hacia el origen.

Esta entrega termina en la fase 6. Continúan pendientes las fases 7 (Lotes y trazabilidad), 8 (Reportes) y 9 (validación integral), según el prompt maestro.
