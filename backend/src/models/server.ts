import express, { Application } from 'express';
import cors from 'cors';

import routeUser from '../routes/user';
import routeCaja from '../routes/caja.routes';
import routeDashboard from '../routes/dashboard.routes';
import routeClientes from '../routes/cliente.routes';
import routeVentas, { cobranzaRouter } from '../routes/venta.routes';
import routeProveedores from '../routes/proveedor.routes';
import routeCompras, { pagoProveedorRouter } from '../routes/compra.routes';
import routeGastos from '../routes/gasto.routes';
import routeProductos from '../routes/producto.routes';
import routeCampanas from '../routes/campana.routes';
import routeProduccion from '../routes/produccion.routes';
import routeReportes from '../routes/reporte.routes';
import routeUploads from '../routes/upload.routes';
import { seedProgramasCaja } from '../seed/programas-caja.seed';
import { seedInventarioBase } from '../seed/inventario.seed';
import { sequelize } from '../models';
import { assertBaseDeUsuario, shouldAlterSchema } from '../utils/db-sync';
import { asegurarDirectoriosImagen, uploadsRoot } from '../utils/imagen';

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
        this.app.use('/api/dashboard', routeDashboard);
        this.app.use('/api/clientes', routeClientes);
        this.app.use('/api/ventas', routeVentas);
        this.app.use('/api/cobranzas', cobranzaRouter);
        this.app.use('/api/proveedores', routeProveedores);
        this.app.use('/api/compras', routeCompras);
        this.app.use('/api/pagos', pagoProveedorRouter);
        this.app.use('/api/gastos', routeGastos);
        this.app.use('/api/productos', routeProductos);
        this.app.use('/api/campanas', routeCampanas);
        this.app.use('/api/producciones', routeProduccion);
        this.app.use('/api/reportes', routeReportes);
        this.app.use('/api/uploads', routeUploads);
    }

    midlewares() {
        this.app.use(express.json());
        this.app.use(cors());
        asegurarDirectoriosImagen();
        this.app.use('/uploads', express.static(uploadsRoot()));
    }

    async dbConnect() {
        try {
            const dbName = sequelize.getDatabaseName();
            assertBaseDeUsuario(dbName);
            await sequelize.authenticate();
            const alter = shouldAlterSchema();
            await sequelize.sync({ force: false, alter });
            await seedProgramasCaja();
            await seedInventarioBase();
            console.log(`Base de datos sincronizada (db=${dbName}, alter=${alter})`);
        } catch (error) {
            const sqlMessage = (error as { parent?: { sqlMessage?: string } })?.parent?.sqlMessage
                || (error as Error).message;
            console.error('Unable to connect to the database:', sqlMessage);
        }
    }
}

export default Server;
