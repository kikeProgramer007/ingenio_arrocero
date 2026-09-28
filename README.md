# Royal Alimentos — Ingenio arrocero

Manual de usuario del sistema de gestión. Sirve para operar ventas, compras, caja, inventario y acopio de arroz **sin confundir una venta con dinero en caja**.

---

## 1. Idea central (léelo antes de operar)

| Concepto | Qué es | ¿Mueve caja? |
|---|---|---|
| **Venta** | Documento: se vendió producto | Solo si hay cobro |
| **Cobranza** | Dinero que entra del cliente | Sí (ingreso) |
| **Compra** | Documento: se compró (chala u otro) | Solo si hay pago |
| **Pago a proveedor** | Dinero que sale al proveedor | Sí (egreso) |
| **Gasto / retiro** | Salida de caja de la empresa o del titular | Sí (egreso) |
| **Anulación de venta** | Se cancela el documento, vuelve el stock | Sí, si ya se había cobrado (devolución) |

**Reglas que no cambian**

- Una **venta no es un ingreso**. El ingreso es el cobro.
- En esta versión hay **una sola caja abierta**. Para cobrar, pagar o gastar hay que abrir caja.
- La fecha de la venta la pone el servidor (hoy). No se registra una venta “de ayer”.
- **Cobrado** (en dashboard y reportes) es **neto**: cobros menos devoluciones por anulación.
- El cobro original **no se borra** del libro de caja: la anulación queda como **egreso de devolución**.

---

## 2. Cómo entrar

1. Abrí el sistema en el navegador.
2. Ingresá **usuario** y **contraseña** que te asigne el administrador.
3. En la barra superior: logo, modo claro/oscuro, y el menú de usuario (**Cerrar sesión**).
4. Al cerrar sesión aparece un diálogo de confirmación (no el aviso nativo del navegador).

Si un ícono no dice nada, pasá el mouse: hay **tooltip** (Ver detalle, Ver PDF, Anular, Exportar a Excel, etc.).

| Color del botón | Uso |
|---|---|
| Azul | Ver detalle |
| Rojo (PDF) | Ver o exportar PDF |
| Verde | Excel |
| Rojo (X) | Anular |
| Naranja | Editar / cerrar caja |

---

## 3. Orden de trabajo típico del día

1. **Abrir caja** (Caja actual) con el efectivo del cajón.
2. Registrar **clientes / proveedores** si faltan.
3. **Compras** o **campañas de acopio** (entra chala al inventario).
4. **Producción** (chala → arroz pilado).
5. **Ventas** (sale pilado; cobrás al contado o a crédito).
6. **Cobranzas** y **pagos a proveedores** de lo que quedó pendiente.
7. **Gastos** y **retiros** si corresponde.
8. Revisar **Dashboard** e **Ingresos y egresos**.
9. **Cerrar caja** (arqueo: contás el dinero y lo comparás con el saldo esperado).

---

## 4. Módulos

### 4.1 Dashboard (`/dashboard`)

Resumen del **día**.

| Indicador | Significado |
|---|---|
| Ventas | Total vendido hoy, **sin** documentos anulados |
| Cobrado | Cobros de clientes **menos** anulaciones |
| Por cobrar | Saldos de ventas vigentes (pendiente o parcial) |
| Efectivo en caja | Cajón: inicial + efectivo − egresos en efectivo |
| QR / banco | Saldo de la sesión por cobros y pagos QR |
| Saldo neto | Ingresos − egresos |

También ves el gráfico ingresos vs egresos, últimos movimientos y cuentas pendientes. Enlace rápido a **Ingresos y egresos** y a **Caja actual**.

Si la caja está cerrada, el dashboard avisa: se puede consultar, pero no cobrar ni gastar hasta abrir caja.

---

### 4.2 Caja actual (`/caja`)

Libro del cajón. **Solo una caja abierta**.

**Abrir**

- Indica el **saldo inicial** (efectivo con el que arrancás). No es un ingreso del día.
- Opcional: observación del turno.

**Mientras está abierta**

- Ves saldo inicial, ingresos, egresos, **efectivo en caja**, **QR / banco** y el total.
- El **cuadre** desglosa:
  - Cobros de clientes (brutos)
  - Otros ingresos
  - Pagos a proveedores, gastos, retiros
  - **Devoluciones por anulación** (restan el mismo canal: efectivo y/o QR)
  - Otros egresos
  - **Efectivo en caja** = inicial + ingresos efectivo − egresos efectivo
  - **QR / banco** = ingresos QR − egresos QR (la sesión de QR arranca en 0)
  - **Cobrado neto** = cobros − devoluciones (indicador; no se suma dos veces)
- **Por cobrar / por pagar** son referencia: no están en el cajón.
- **Nuevo movimiento**: solo ingresos/egresos **manuales** (otro ingreso, gasto, etc.). Las ventas y compras **no** se cargan aquí.
- Las anulaciones de venta se generan solas; no aparecen como categoría manual.

**Cerrar / arqueo**

- Contás el **efectivo del cajón** (el QR no se cuenta: está en el banco).
- El sistema compara con el **efectivo esperado**: cuadre, faltante o sobrante.
- Al cerrar se genera el **PDF de arqueo** en una ventana.

Botones **PDF** (rojo) y **Excel** (verde) exportan esta caja.

---

### 4.3 Historial de cajas (`/caja/historial`)

Cajas anteriores (abiertas o cerradas). Filtro por fechas y estado. Podés ver el detalle, el PDF del arqueo y el Excel.

---

### 4.4 Ventas (`/ventas`)

Registro de lo **vendido**. Baja inventario si la línea tiene producto (arroz pelado, etc.).

**Nueva venta**

1. Elegí **cliente** (o creá uno rápido).
2. Agregá líneas: producto del inventario o un concepto escrito.
3. **Contado**: el pago inicial cubre el total → entra a caja y queda **PAGADA**.
4. **Crédito**: pago 0 o un abono → queda **PENDIENTE** o **PARCIAL**.
5. Método de pago: tarjetas **QR / Efectivo / Mixto**. Mixto pide cuánto va a QR (banco) y cuánto a efectivo (cajón).
6. Al guardar se abre la **nota de venta en PDF**.

**Estados**

- Pendiente: no se cobró nada.
- Parcial: hay abono y saldo.
- Pagada: saldo 0.
- Anulada: no suma en totales; el stock vuelve.

**Acciones de la fila**

- Ojo: ver detalle y cobranzas de esa venta.
- PDF: reimprimir la nota.
- X: **anular**. Devuelve stock. Si había cobro, sale un egreso de caja (hace falta caja abierta).

No se edita una venta ya registrada: se anula y se carga de nuevo si hace falta.

---

### 4.5 Cobranzas (`/cobranzas`)

Pagos de clientes **después** de una venta a crédito o parcial.

- Elegí la venta con saldo, el monto, el método y registrá.
- El dinero entra a caja y baja el saldo de la venta.
- Tras cobrar se puede abrir el PDF de la **nota de venta** actualizada.

---

### 4.6 Clientes (`/clientes`)

Agenda de compradores.

- Alta / edición: nombre, NIT/CI, teléfono, dirección, foto opcional, activo/inactivo.
- **Cuenta del cliente** (ícono de libro): extracto de ventas (incluidas anuladas) y cobranzas, con total, cobrado y pendiente de las vigentes.

Desde **Nueva venta** también se puede crear un cliente al vuelo.

---

### 4.7 Compras (`/compras`)

Compra a proveedor. Si la línea tiene producto (chala), **entra al inventario**.

- Igual lógica que ventas: pago al registrar o queda por pagar.
- PDF: **nota de compra**.
- Una compra pendiente **no** es un egreso hasta el pago.

En esta versión **no** hay anulación de compra.

---

### 4.8 Pagos a proveedores (`/pagos`)

Egreso de caja contra una compra con saldo. Baja el pendiente de la compra.

---

### 4.9 Proveedores (`/proveedores`)

Quiénes venden chala, insumos o servicios. Alta, edición y estado activo/inactivo.

---

### 4.10 Gastos de empresa (`/gastos`)

Salidas de caja de la operación (combustible, energía, mantenimiento, etc.).

- Categoría, monto, método, si afecta caja.
- Requiere caja abierta.
- No uses este módulo para “cargar una venta”.

---

### 4.11 Retiros personales (`/retiros`)

Dinero que sale de caja para el titular u otro retiro personal. Misma mecánica que gastos, con tipo **retiro**.

---

### 4.12 Ingresos y egresos (`/ingresos-egresos`)

Libro de **todos** los movimientos de caja del período (no solo “hoy”).

- Filtros: tipo (ingreso/egreso), origen (venta, cobranza, gasto…), método.
- KPIs: ingresos, egresos, saldo neto, **cobrado neto**, por cobrar, por pagar.
- El concepto suele enlazar al documento de origen (por ejemplo la venta).

---

### 4.13 Inventario (`/inventario`)

Productos, stock, mínimo y precios de referencia.

- **Nuevo / editar** producto (nombre, categoría, unidad, precios, stock inicial solo al crear, imagen).
- **Ajustar stock**: corrección con observación (queda en kardex).
- **Kardex**: historial de entradas y salidas (venta, compra, producción, anulación, ajuste).
- Si el stock está bajo el mínimo, se marca en rojo.

La venta **descuenta** stock; la compra o el acopio **suman**; anular una venta **devuelve**.

---

### 4.14 Campañas de acopio (`/campanas`)

Compra de **arroz en chala** agrupada por campaña (zafra).

1. Creá la campaña (nombre, fecha inicio, meta en kg opcional).
2. **Acopio**: proveedor, cantidad, precio, pago ahora (0 = queda por pagar). Si elegís producto, entra al inventario.
3. **Cerrar** la campaña cuando termina el acopio.

No inventa reglas de humedad ni rendimiento: solo registra lo que cargás.

---

### 4.15 Producción (`/produccion`)

Convierte materia prima en producto terminado.

- Origen (ej. chala): baja del stock.
- Destino (ej. pilado): entra al stock.
- La diferencia queda como **merma** informativa.

Tiene que haber stock suficiente del origen.

---

### 4.16 Reportes (`/reportes`)

Resumen operativo de un rango de fechas (ventas vigentes, cobrado neto, anulaciones, compras, gastos, retiros, acopios, caja).

**PDF** (rojo) y **Excel** (verde) del resumen y de cada listado (ventas, movimientos, inventario, etc.).

Los PDF de listados: columnas con ancho según el texto, filas que crecen si el concepto es largo, encabezado con logo y pie con número de página.

---

## 5. Documentos PDF

| Cuándo | Qué se genera |
|---|---|
| Guardar venta / cobrar | Nota de venta (ventana emergente) |
| Guardar compra | Nota de compra |
| Cerrar caja | Arqueo de caja |
| Botón PDF de una fila | Reimpresión de ese documento |
| PDF / Excel de listados | Reporte del módulo |

Si el navegador bloquea la ventana, permití ventanas emergentes para el sitio.

Una venta **anulada** en la nota muestra cobrado 0 y tipo de pago ANULADA.

---

## 6. Iconos 🛈 en los formularios

Al lado de varias etiquetas hay un ícono de información. Al pasar el mouse muestra un **ejemplo** (cómo llenar el campo). Usalo la primera vez que operás cada pantalla.

---

## 7. Qué no hace (aún) este sistema

Para no operar mal:

- No emite factura fiscal SIN / dosificación.
- No edita ventas ni compras ya guardadas (la venta se anula).
- No anula compras.
- No administra usuarios ni cambia contraseñas desde la pantalla (lo hace el administrador).
- No maneja plazos de crédito ni descuentos automáticos.
- No es un contable completo (plan de cuentas, asientos de diario). El libro de caja está pensado para crecer hacia eso.

---

## 8. Problemas frecuentes

| Situación | Qué hacer |
|---|---|
| “Debe haber una caja abierta” | Ir a **Caja actual** y abrir caja |
| No baja el stock | La línea de venta/compra debe tener **producto**, no solo un texto |
| Cobrado no bajó al anular | El cobrado **neto** sí baja; ingresos brutos siguen y aparece un **egreso** de anulación |
| El PDF sale en pestaña o no abre | Permitir ventanas emergentes; recargar si el backend es reciente |
| Tooltip no aparece | Pasar el mouse y esperar un segundo |

---

## 9. Para quien instala el sistema (desarrollo)

Stack: Angular 19 + PrimeNG (Sakai) en `frontend/`, API Express + Sequelize + MySQL/TiDB en `backend/`.

```bash
# API
cd backend
npm install
npx tsc
npm run dev

# Interfaz
cd frontend
npm install
ng serve --o
```

Compilar frontend para producción:

```bash
cd frontend
ng build --configuration production
```

El menú de la aplicación se arma con los **programas** asignados al usuario al iniciar sesión.
