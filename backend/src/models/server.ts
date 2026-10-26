import express, { Application } from 'express';
import cors from 'cors';

import routeUser from '../routes/user';
import routeCaja from '../routes/caja.routes';
import routeCajaChica from '../routes/caja-chica.routes';
import routeDashboard from '../routes/dashboard.routes';
import routeClientes from '../routes/cliente.routes';
import routeVentas, { cobranzaRouter } from '../routes/venta.routes';
import routeProveedores from '../routes/proveedor.routes';
import routeProductores from '../routes/productor.routes';
import routeCompras, { pagoProveedorRouter } from '../routes/compra.routes';
import routeGastos from '../routes/gasto.routes';
import routeProductos from '../routes/producto.routes';
import routeCampanas from '../routes/campana.routes';
import routeProduccion from '../routes/produccion.routes';
import routeReportes from '../routes/reporte.routes';
import routeUploads from '../routes/upload.routes';
import routeEmpresa from '../routes/empresa.routes';
import { seedProgramasCaja } from '../seed/programas-caja.seed';
import { seedAdmin } from '../seed/admin.seed';
import { seedInventarioBase } from '../seed/inventario.seed';
import { seedCatalogoFotos } from '../seed/catalogo-fotos.seed';
import { sequelize } from '../models';
import { assertBaseDeUsuario, shouldAlterSchema } from '../utils/db-sync';
import { asegurarEsquemaClientes, asegurarEsquemaCompras, asegurarEsquemaEmpresa, asegurarEsquemaGastos, asegurarEsquemaOperacion, asegurarEsquemaPagoMixto, asegurarEsquemaPagosGasto, asegurarEsquemaProductores, asegurarEsquemaUsuarios, asegurarEsquemaVentas } from '../utils/ensure-schema';
import { asegurarDirectoriosImagen, uploadsRoot } from '../utils/imagen';
import { asegurarEmpresa } from '../utils/empresa';
import routeDespachos from '../routes/despacho.routes';
import routePlantillasDocumentos from '../routes/plantillas-documentos.routes';

class Server {
    private app: Application;
    private port: string;

    constructor() {
        this.app = express();
        this.port = (process.env.PORT || '3001').replace(/['"]/g, '').trim();
        this.midlewares();
        this.routes();
        this.listen();
        this.dbConnect();
    }

    listen() {
        this.app.listen(this.port, () => {
            console.log('Aplicacion corriendo en el puerto ' + this.port);
        })
    }

    routes() {
        this.app.use('/api/users', routeUser);
        this.app.use('/api/cajas', routeCaja);
        this.app.use('/api/caja-chica', routeCajaChica);
        this.app.use('/api/dashboard', routeDashboard);
        this.app.use('/api/clientes', routeClientes);
        this.app.use('/api/ventas', routeVentas);
        this.app.use('/api/despachos', routeDespachos);
        this.app.use('/api/cobranzas', cobranzaRouter);
        this.app.use('/api/proveedores', routeProveedores);
        this.app.use('/api/productores', routeProductores);
        this.app.use('/api/compras', routeCompras);
        this.app.use('/api/pagos', pagoProveedorRouter);
        this.app.use('/api/gastos', routeGastos);
        this.app.use('/api/productos', routeProductos);
        this.app.use('/api/campanas', routeCampanas);
        this.app.use('/api/producciones', routeProduccion);
        this.app.use('/api/reportes', routeReportes);
        this.app.use('/api/uploads', routeUploads);
        this.app.use('/api/empresa', routeEmpresa);
        this.app.use('/api/plantillas-documentos', routePlantillasDocumentos);
    }

    midlewares() {
        this.app.use(express.json());
        this.app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
        asegurarDirectoriosImagen();
        this.app.use('/uploads', express.static(uploadsRoot()));
    }

    async dbConnect() {
        try {
            const dbName = sequelize.getDatabaseName();
            assertBaseDeUsuario(dbName);
            await sequelize.authenticate();
            const alter = shouldAlterSchema();
            try {
                await sequelize.sync({ force: false, alter });
            } catch (syncError) {
                if (!esPermisoEsquema(syncError)) {
                    console.error('Sequelize sync incompleto (TiDB puede rechazar ALTER de UNIQUE):', syncError);
                } else {
                    console.warn('Sin permiso para alterar tablas. Se usa el esquema existente.');
                }
            }
            const asegurar = [
                asegurarEsquemaGastos,
                asegurarEsquemaPagosGasto,
                asegurarEsquemaPagoMixto,
                asegurarEsquemaEmpresa,
                asegurarEsquemaClientes,
                asegurarEsquemaVentas,
                asegurarEsquemaCompras,
                asegurarEsquemaProductores,
                asegurarEsquemaUsuarios,
                asegurarEsquemaOperacion
            ];
            for (const paso of asegurar) {
                try {
                    await paso();
                } catch (schemaError) {
                    if (!esPermisoEsquema(schemaError)) {
                        throw schemaError;
                    }
                    console.warn('Sin permiso CREATE/ALTER. Se continúa con las tablas actuales.');
                    break;
                }
            }
            try {
                await seedAdmin();
                await seedProgramasCaja();
                await seedInventarioBase();
                await seedCatalogoFotos();
                await asegurarEmpresa();
            } catch (seedError) {
                const mensaje = (seedError as { parent?: { sqlMessage?: string } })?.parent?.sqlMessage
                    || (seedError as Error).message;
                console.warn('Inicio de datos omitido:', mensaje);
            }
            console.log(`Base de datos sincronizada (db=${dbName}, alter=${alter})`);
        } catch (error) {
            const sqlMessage = (error as { parent?: { sqlMessage?: string } })?.parent?.sqlMessage
                || (error as Error).message;
            console.error('Unable to connect to the database:', sqlMessage);
        }
    }
}

function esPermisoEsquema(error: unknown): boolean {
    const err = error as { parent?: { errno?: number; code?: string }; errno?: number; code?: string };
    const errno = err.parent?.errno ?? err.errno;
    const code = err.parent?.code ?? err.code;
    return errno === 1142 || code === 'ER_TABLEACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR';
}

export default Server;
