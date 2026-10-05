Es **TiDB Cloud** (MySQL), no el MySQL de XAMPP. El backend ya arranca contra `db=test`.

## Datos de conexión

Usa los mismos del `backend/.env`:

| Campo DBeaver | Valor |
|---|---|
| Driver | **MySQL** (MySQL 8 funciona) |
| Host | `gateway01.sa-east-1.prod.aws.tidbcloud.com` |
| Port | `4000` |
| Database / schema | `test` |
| Username | `6cHbgGpzfawKDrH.root` |
| Password | `9E8TWaBm4xfMOy4T` |
| CA (SSL) | `C:\xampp\htdocs\ingenio_arrozero\backend\certs\isrgrootx1.pem` |

Sin SSL no entra: el cluster exige TLS.

## Pasos en DBeaver

1. **Database → New Database Connection** (o el enchufe).
2. Elige **MySQL** → Next.
3. Pestaña **Main**: host, puerto `4000`, database `test`, user y password.
4. Pestaña **SSL**:
   - Marca **Use SSL**
   - **CA certificate**: el `.pem` de arriba
   - Deja vacío Client certificate y Client key
   - No marques skip validation si el CA carga bien
5. **Test Connection** → si pide descargar el driver MySQL, acepta → **Finish**.

Si el test falla por SSL, en **Driver properties** agrega:

- `useSSL` = `true`
- `requireSSL` = `true`
- `verifyServerCertificate` = `true`

## Qué vas a ver

El schema es **`test`**. Ahí están `clientes` (con `procedencia`), `ventas`, `cobranzas`, `empresa`, etc.

Cuando confirmes que DBeaver abre, seguimos con la Fase 2.