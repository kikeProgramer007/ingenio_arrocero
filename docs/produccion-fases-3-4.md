# Fases 3 y 4: Secados y Guardados

Implementadas en `empresa_rojas`, usando la base configurada `db_empresa_rojas`.

## Funcionalidad entregada

- Listados y formularios reales para Secados y Guardados con componentes PrimeNG/Sakai existentes.
- Borradores editables; confirmación y anulación con motivo e historial por usuario.
- Secados con uno o varios lotes compatibles (hasta 20), cantidades parciales, secadora y operador manuales, inicio/fin con fecha completa, duración, humedades y mediciones opcionales.
- Guardados parciales, ubicación existente o nueva, ubicación específica, condición y responsable. El listado distingue cantidad registrada y disponible actual.
- Filtros por fechas, productor, variedad, estado, secadora o silo/almacén; búsqueda, ordenamiento y paginación de servidor 10/25/50/100.
- Resumen sobre toda la consulta filtrada, separado por modalidad, estado y unidad. Excel y PDF/impresión usan los mismos filtros y todas las filas.
- Carga con skeleton y errores visibles. Los formularios no dependen de catálogos de secadoras u operadores para permitir escribir esos datos.

## Decisiones de integridad

Cada avance consume únicamente la cantidad indicada del lote de origen y genera un lote derivado en la siguiente etapa. El sobrante permanece en su etapa anterior. La suma de cantidades de control se conserva; no se suma inventario comercial nuevamente.

Los resultados conservan producto, unidad, variedad, productor, propietario y modalidad. No se permite combinar lotes de diferente propiedad, producto, variedad o unidad. Cada origen mantiene un resultado independiente, incluso dentro de un mismo ciclo.

Las cantidades reales de salida y mermas medidas son evidencias físicas separadas, con su unidad y justificación. No convierten fanegas a kilos ni ajustan automáticamente el saldo comercial. No se infiere una merma a partir del descenso de humedad. Esta distinción se explica en el formulario.

La confirmación bloquea operación y orígenes en una transacción, comprueba disponibilidad y usa claves únicas e idempotencia. Para arroz propio se valida además el respaldo del stock comercial descontando reservas; no se crean compras, ventas, pagos ni movimientos de caja por estas etapas.

La anulación conserva la historia y crea reversos. Se bloquea si existen borradores o procesos dependientes activos o consumo del resultado. Se debe revertir desde el final de la cadena. Se adaptó la anulación del descarguío para reconocer las referencias nuevas y permitir revertir después de anular sus etapas dependientes.

No hay estado operativo EN_CURSO nuevo en estas fases: se conservan ciclos incompletos como borradores y se confirma el secado cuando están registrados inicio, fin y humedad final. No se adelantan funcionalidades de Procesados ni Envasados.

## Estructura y archivos

- `backend/src/migrations/20261105-produccion-secados-guardados.ts`: migración incremental repetible, nueva tabla de orígenes, datos de destino y condición; destino nullable para borradores incompletos.
- `backend/src/scripts/migrar-secados-guardados.ts`: ejecución explícita con comprobación de huellas de tablas comerciales. Comando: `npm run migrate:secados-guardados` desde backend.
- `backend/src/dtos/produccion-etapa.dto.ts`: validación de campos, fechas, medidas y orígenes.
- `backend/src/servicios/produccion-etapas.servicio.ts`: borradores, confirmación, balances, lotes derivados, reversos y auditoría.
- `backend/src/servicios/produccion-etapas-consulta.servicio.ts`: consultas, opciones y exportaciones.
- `backend/src/controllers/produccion-etapas.controller.ts` y `routes/produccion-base.routes.ts`: endpoints protegidos para ambas etapas.
- `backend/src/controllers/produccion-base.controller.ts`: permisos propios de cada etapa y comprobación de su migración.
- `backend/src/servicios/produccion-consulta.servicio.ts`: límite configurable de filas, manteniendo 50 por defecto para las consultas anteriores.
- `backend/src/servicios/descarguios.servicio.ts`: control de dependencias y reversión en cadena.
- `backend/src/utils/exportar.ts`: proporciones de columnas optativas por reporte; el diseño de los demás documentos conserva sus valores por defecto.
- `backend/src/scripts/verificar-secados-guardados.ts`: comprobación integrada con rollback y huellas de todas las tablas.
- `frontend/src/app/pages/produccion/produccion-etapas.service.ts`: acceso HTTP para ambas etapas.
- `frontend/src/app/pages/produccion/produccion-etapas.ts` y `.html`: listados.
- `frontend/src/app/pages/produccion/produccion-etapa-form.ts` y `.html`: formularios.
- `frontend/src/app/pages/produccion/produccion.routes.ts` y `produccion-permisos.ts`: rutas y permisos por etapa.
- `frontend/src/app/shared/services/exportar.service.ts`: exportación de ambas etapas mediante el visor existente.
- `backend/package.json`: comando de migración.

## Validación

- Migración aplicada en desarrollo: 33 tablas comerciales verificadas sin cambios en sus registros.
- Compilación de backend y frontend satisfactoria. Angular conserva advertencias previas de tamaño de bundles/estilos.
- Pruebas dentro de una única transacción revertida: varios orígenes, secado parcial, guardado parcial, saldos, propiedad de terceros, arroz propio, reservas, ausencia de doble descuento, idempotencia y versión obsoleta.
- Bloqueo de cantidades excesivas y de mezcla entre propietarios; validación de porcentajes, decimales, mediciones sin unidad y fin anterior al inicio.
- Borrador sin cantidad conserva NULL; impide anular el descarguío referenciado.
- Anulación segura de guardado, luego secado y finalmente descarguío; reversos sin eliminar movimientos.
- Filtros combinados, ordenamiento, paginación y exportación de toda la consulta. Verificación de formato numérico de cantidades en Excel.
- PDF de Secados y Guardados generado y revisado; revisión adicional con nombres extensos y varias páginas.
- Al finalizar las pruebas: cero registros ficticios persistidos y huellas de todas las tablas sin cambios. Los contadores autoincrementales pueden avanzar pese al rollback.
- Backend local reiniciado y rutas nuevas comprobadas mediante HTTP autenticado. Frontend en puerto 4200, backend en 3001.
- No se utilizaron navegador, Playwright ni herramientas nuevas.

## Revisión manual sugerida

1. En Producción / Secados, elegir un descarguío confirmado, secar solo una parte y verificar el saldo pendiente del descarguío.
2. Guardar un borrador con mediciones pendientes, volver a abrirlo, completar secadora, inicio, fin y humedad final y confirmar.
3. En Guardados, elegir el lote secado, guardar solo una parte en una ubicación escrita manualmente y revisar disponible y propietario.
4. Cambiar filtros, ordenar, paginar y exportar la consulta a Excel y PDF.
5. Intentar anular el secado con un guardado activo: debe bloquearse. Anular primero el guardado y luego el secado: deben restaurarse los saldos.

Pendiente la revisión visual y operativa del usuario en su navegador. La siguiente fase de implementación es Procesados/Pilado (fase 5); no se implementó en esta entrega.
