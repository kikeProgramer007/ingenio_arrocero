# Fase 9: integración y validación final

Rama: `empresa_rojas`. Base de desarrollo comprobada: `db_empresa_rojas`.

## Funcionalidades e integración

El módulo permite recepción/descarguío, secado parcial, guardado parcial, procesado con varios resultados, envasado con consumo de empaques, lotes y trazabilidad y siete reportes. Conserva arroz propio separado de arroz de terceros. Los borradores no afectan stock; las confirmaciones y anulaciones registran movimientos e historial.

La prueba integral conecta los servicios reales de las cinco etapas con consultas de lotes y reportes, para ambas modalidades. No sustituye el generador de documentos ni la lógica comercial existente.

### Corrección de esta fase

Se quitó la opción «EN_CURSO» del filtro de reportes: los servicios actuales admiten Borrador, Confirmado y Anulado. La opción producía un filtro no admitido en Secados. No se modificó el enum histórico de la base ni se transformaron estados de registros existentes.

## Archivos de esta fase

- `backend/src/scripts/verificar-produccion-integral.ts`: recorrido completo, reversión, invariancia financiera, concurrencia y comprobación de huellas.
- `backend/package.json`: comando `test:produccion:integral`.
- `frontend/src/app/pages/produccion/produccion-consultas.ts`: estados de filtros compatibles con los servicios actuales.
- `docs/produccion-fase-9.md`: resultados, límites y despliegue.

El detalle de la implementación previa se encuentra en `produccion-fase-1.md`, `produccion-fase-2.md`, `produccion-fases-3-4.md`, `produccion-fases-5-6.md` y `produccion-fases-7-8.md`.

## Tablas y migraciones

Esta fase no crea ni altera tablas ni requiere otra migración. El módulo completo utiliza:

- `produccion_ubicaciones`, `produccion_operaciones`, `produccion_lotes`.
- `produccion_operacion_lotes`, `produccion_etapa_origenes`.
- `produccion_descarguios`, `produccion_secados`, `produccion_guardados`.
- `produccion_procesados`, `produccion_procesado_detalles`, `produccion_envasados`.
- `produccion_movimientos`, `produccion_inventario_vinculos`, `produccion_auditoria`.
- `produccion_secuencias`, `produccion_migraciones`.

Las migraciones incrementales amplían las mediciones, referencias, borradores y vínculos de inventario. Los permisos se integran con `programas` y `perfil_programas`. Se reutilizan productos, productores, compras, recepciones y movimientos de inventario existentes; no se crea otra contabilidad ni otra caja.

## Endpoints y rutas

Prefijo backend: `/api/produccion`.

| Recurso | Acciones |
| --- | --- |
| `/resumen`, `/operaciones`, `/catalogos` | Consulta general |
| `/descarguios` | GET/POST; opciones, recepciones, productor rápido, exportar, GET/PUT por ID, confirmar y anular |
| `/secados`, `/guardados`, `/procesados`, `/envasados` | GET/POST; opciones, exportar, GET/PUT por ID, POST confirmar y anular |
| `/lotes`, `/lotes/opciones`, `/lotes/:id`, `/lotes/exportar` | Consulta, historial y exportación |
| `/reportes/:tipo`, `/reportes/:tipo/exportar` | Siete reportes y documentos |

Tipos de reporte: `descarguios`, `secados`, `guardados`, `procesados`, `envasados`, `existencias`, `rendimiento`.

Frontend:

- `/produccion/resumen`.
- `/produccion/descarguios`, `/produccion/descarguios/nuevo`, `/produccion/descarguios/:id`.
- Mismo patrón para `secados`, `guardados`, `procesados`, `envasados`.
- `/produccion/lotes`, `/produccion/lotes/:id`.
- `/reportes` → Producción.
- Acceso a existencias por lote desde Inventario, según permisos.

## Pruebas y resultados

### Validación nueva de integración

Ejecutada con `NODE_ENV=development` y restringida explícitamente a `db_empresa_rojas`:

1. Compra simulada ya recibida → descarguío → secado de una parte → guardado de una parte → procesado de una parte → envasado de una parte.
2. Mismo recorrido para arroz propiedad del productor.
3. Comprobación en cada recorrido de los cinco documentos dentro de la trazabilidad y los cinco reportes de control.
4. Confirmación de que secado y guardado no duplican existencias; procesado y envasado descuentan e ingresan exactamente las cantidades correspondientes.
5. El servicio a terceros conserva al propietario y solo consume los empaques propios, sin aumentar el arroz comercial del ingenio.
6. No se crean ni alteran compras adicionales, ventas, cobranzas, pagos o movimientos de caja durante la producción.
7. Anulación bloqueada si existe proceso dependiente. Reversión completa desde envasado hasta recepción restaura arroz, empaques y productos exactamente.
8. Dos conexiones reales compiten por secar 80 de un lote aislado de 100: **una confirmación exitosa, un conflicto 409, un único movimiento de salida por 80 y saldo de 20**.
9. Huellas SHA-256 de las filas de **todas las tablas** iguales antes y después. Cero fixtures persistidos.

El recorrido se ejecuta dentro de una transacción con rollback. La prueba de concurrencia necesita fixtures visibles entre conexiones: crea únicamente un productor, producto, lote y documentos aislados de prueba, y los elimina en `finally` por sus IDs exactos. No altera secuencias comerciales ni usa operaciones financieras. Los contadores autoincrementales pueden avanzar aunque las filas se reviertan o eliminen. Ejecutar sin usuarios escribiendo simultáneamente para que la comparación global sea válida. Si el proceso se interrumpe abruptamente antes de `finally`, revisar los fixtures con prefijo `CC-` y «CONCURRENCIA DE PRUEBA» antes de repetir; no ejecutar limpiezas generales.

### Regresión por lectura

HTTP 200 JSON autenticado en compras, ventas, cobranzas, pagos, productos, caja abierta, historial de caja, resumen operativo y cuentas por cobrar/pagar. También responden resumen, descarguíos, secados, guardados, procesados, envasados, lotes y reporte de secados confirmado. Esta comprobación valida disponibilidad de las consultas; no equivale a registrar nuevamente todas las operaciones comerciales.

Las ocho rutas principales de frontend consultadas devolvieron HTTP 200 HTML. Esto verifica que el servidor entrega la aplicación, no el renderizado ni la interacción de Angular.

Compilaciones de backend y frontend aprobadas. Frontend conserva las advertencias anteriores de presupuesto de bundle y estilos.

No se repitieron las pruebas aisladas ya aprobadas de ceros, negativos, sobreconsumo, idempotencia, versiones obsoletas, reservas, falta de bolsas, equivalencias, texto largo y exportación completa: la lógica correspondiente no cambió. Los PDF de los siete reportes y el documento de seis páginas revisados en fase 8 conservan su layout; esta fase no cambia el generador.

## Limitaciones y validación del cliente

- **Salidas comerciales por lote:** por decisión del usuario, la integración con Despachos se deja para una etapa posterior. Por ahora un despacho no identifica ni descuenta un lote de producción; no se impone FIFO ni se reasignan ventas antiguas. Los saldos por lote pueden requerir conciliación con stock general; se advierte en pantalla y reporte. También falta definir la entrega final del arroz de terceros.
- No se considera terminada la trazabilidad hasta la entrega comercial mientras esa vinculación no exista.
- Fanega y quintal no tienen una equivalencia automática. El cliente debe validar unidades, mediciones y referencias de conversión en envasado.
- El rendimiento requiere pesos comparables; no se calcula merma por humedad.
- Los reportes de existencias muestran saldos actuales de recepciones filtradas, no un cierre histórico.
- La proyección documental de reportes se materializa en memoria antes de paginar; para volúmenes muy altos requerirá optimización específica.
- No se ejecutó navegador ni Playwright, respetando la restricción del usuario. Quedan para su revisión visual alineaciones, tamaños estrechos, interacción, ordenación y navegación, comparados con Sakai. No se certifica una revisión visual interactiva mediante las respuestas HTTP.
- Envejecido, laboratorio de rendimiento y costeo detallado no se agregaron a este alcance.

Verificaciones manuales breves:

1. Confirmar que nombres de productores, variedad, ubicación y unidades corresponden a la operación real.
2. Registrar un recorrido parcial propio y otro de terceros, comprobar sus saldos y navegar por el historial.
3. Verificar legibilidad de formularios y tablas a los tamaños de pantalla usados en planta, incluidos pies de formulario y menús desplegables.
4. Filtrar los siete reportes, cambiar página/orden y comparar pantalla, PDF e impresión.
5. Probar perfiles de consulta y operadores, y anular desde la última etapa hacia el origen.

## Despliegue

No se desplegó un servicio remoto en esta fase. Para instalar los cambios en otra base autorizada:

1. Respaldar la base y verificar el destino de `DB_NAME`; no reutilizar sin revisión la conexión de desarrollo. Coordinar una ventana sin escrituras.
2. Instalar las dependencias del proyecto según los lockfiles existentes, si el destino aún no las tiene. No se requieren servicios nuevos.
3. Desde `backend`, compilar y aplicar, en orden, `npm run migrate:produccion`, `npm run migrate:descarguios`, `npm run migrate:secados-guardados`, `npm run migrate:transformaciones`. Son migraciones de estructura, no scripts de limpieza ni de carga de pruebas.
4. Verificar las cuatro versiones en `produccion_migraciones`. Conservar `DB_SYNC_ALTER=false` al desplegar sobre una base existente; la estructura de producción se administra mediante sus migraciones.
5. Revisar permisos de Producción y Reportes por perfil. Volver a iniciar sesión para refrescar el menú del usuario.
6. Compilar frontend con la URL de API correcta y reiniciar el backend para que cargue el `dist` actualizado. Los puertos locales son 3001 y 4200; no crear otra instancia en 4201.
7. Validar las rutas anteriores y un recorrido en desarrollo antes de habilitar trabajo real. No ejecutar los scripts de verificación contra una base de operación.

Para repetir únicamente esta prueba integral en la base de desarrollo autorizada: `npm run test:produccion:integral` desde `backend`. No se necesita ejecutarla como parte del arranque ni de cada despliegue.
