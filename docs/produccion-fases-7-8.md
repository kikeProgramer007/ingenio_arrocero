# Fases 7 y 8: trazabilidad y reportes

## Consulta de lotes

`/produccion/lotes` permite filtrar recepción, productor, propiedad, modalidad, variedad, estado, ubicación, clasificación y etapa física. El buscador recorre los códigos y boletas de los antecesores, además del lote/producto actual. Ordenación y paginación se resuelven en el servidor. Hay acceso desde Inventario cuando el perfil tiene lectura de lotes.

El detalle `/produccion/lotes/:id` reconstruye antecesores y descendientes mediante una CTE recursiva con deduplicación. Incluye entradas y resultados múltiples, enlaces al documento original, propietario, responsable y fechas. En las uniones muestra las otras entradas como vínculos navegables. No presupone una relación de uno a uno.

Los saldos se consultan directamente en `produccion_lotes`, sin caché ni otra tabla de existencias. Se suman solamente lotes activos cuyo documento está confirmado, separados por unidad y propietario. No se suman fanegas con quintales. La clasificación del procesado se conserva en la consulta de sus presentaciones envasadas.

El período selecciona recepciones de origen: las etapas posteriores siguen apareciendo aunque se hayan realizado otro día. Las cantidades son **saldos actuales**, no un corte histórico. Una unión aparece si alguna de sus recepciones coincide con el período.

### Límite de las salidas comerciales

El registro existente de despachos no asigna el producto a un lote de producción. La consulta no inventa esa asignación ni modifica operaciones anteriores. Muestra los movimientos efectivamente registrados por lote y, para producto propio, contrasta la suma de lotes activos con el stock general del producto. Una diferencia requiere conciliación; no se presenta como una venta atribuida al lote.

Queda pendiente definir e implementar la asignación de lotes en las salidas comerciales y las entregas de productos de terceros. Mientras tanto los saldos por lote no sustituyen la disponibilidad comercial general después de un despacho. Esta limitación es visible en pantalla y en el reporte de existencias.

## Reportes

En el módulo existente **Reportes → Producción** se incorporaron:

- Control de descarguíos.
- Control de secados.
- Control de guardados.
- Control de procesados.
- Control de envasados.
- Existencias por productor.
- Rendimiento de producción.

Los primeros cinco reutilizan las consultas y generadores de cada etapa. Existencias agrupa los mismos lotes por propietario, productor, modalidad, variedad, clasificación, producto, ubicación, etapa y unidad. Rendimiento compara kilogramos medidos; no deduce equivalencias por fanega/quintal ni convierte humedad en pérdida de peso. El ponderado requiere mediciones completas de los procesos confirmados.

La pantalla y sus exportaciones usan un único adaptador. El resumen y las exportaciones incluyen todos los resultados filtrados, no únicamente la página. El servidor ordena y pagina la proyección documental; actualmente esta proyección se materializa completa en memoria antes de paginar. Para volúmenes muy altos convendrá trasladar esa proyección a consultas SQL específicas, conservando el contrato de respuesta.

Excel conserva las cantidades numéricas con hasta tres decimales. El PDF usa el generador compartido, papel LETTER, orientación vertical en rendimiento y horizontal en controles anchos, cabecera en blanco y negro con título a la derecha y filtros debajo, tablas con ajuste de texto, encabezados repetidos y numeración de páginas. La opción `cabeceraReporte` es optativa y no modifica los documentos anteriores.

La lectura de reportes exige permiso del módulo Reportes y permiso de lectura de la etapa correspondiente; existencias exige Lotes y rendimiento exige Procesados. Las opciones compartidas exigen lectura en al menos una sección de producción. No hay acciones de escritura en estos endpoints.

## Estructura y validación

Estas fases reutilizan la estructura de las fases 1–6: no necesitan nuevas tablas ni migraciones, no alteran stock, reservas, caja ni registros comerciales.

`backend/src/scripts/verificar-trazabilidad-reportes.ts` crea fixtures solamente dentro de una transacción que se revierte al finalizar. Comprueba recepción dividida, unión de entradas, deduplicación, propiedad, clasificación heredada, filtros por recepción, paginación y exportación completa de los siete reportes. Genera PDF con nombres extensos y uno de varias páginas para inspeccionar el ajuste y la continuidad. Requiere `NODE_ENV=development`.

La fase 9 no se ejecuta como parte de esta entrega.
