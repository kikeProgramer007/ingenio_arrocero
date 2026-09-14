import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';

interface Programa {
    id: number;
    nombre: string;
    url: string | null;
    classIcon: string;
    esExpandible: boolean;
    nroPosicion: number;
}

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model; let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul> `
})
export class AppMenu {
    model: MenuItem[] = [];

    ngOnInit() {
        this.buildMenuFromUserData();
    }

    private buildMenuFromUserData(): void {
        const userMenuData = this.getUserMenuData();
        this.model = this.createMenuStructure(userMenuData || []);
    }

    private getUserMenuData(): Programa[] | null {
        const loggedMenu = localStorage.getItem(STORAGE_KEYS.USER_MENU);
        return loggedMenu ? JSON.parse(loggedMenu) : null;
    }

    private createMenuStructure(programas: Programa[]): MenuItem[] {
        const byUrl = new Map((programas || []).filter((p) => !!p.url).map((p) => [p.url as string, p]));
        const link = (url: string, label: string, icon: string) => {
            const prog = byUrl.get(url);
            return {
                label: prog?.nombre || label,
                icon: prog?.classIcon || icon,
                routerLink: [url]
            };
        };

        return [
            {
                label: 'Inicio',
                items: [link(APP_ROUTES.dashboard, 'Dashboard', 'pi pi-home')]
            },
            {
                label: 'Ingresos',
                items: [
                    link(APP_ROUTES.ventas, 'Ventas', 'pi pi-shopping-cart'),
                    link(APP_ROUTES.cobranzas, 'Cobranzas', 'pi pi-money-bill')
                ]
            },
            {
                label: 'Egresos',
                items: [
                    link(APP_ROUTES.pagos, 'Pagos a proveedores', 'pi pi-send'),
                    link(APP_ROUTES.gastos, 'Gastos de empresa', 'pi pi-briefcase'),
                    link(APP_ROUTES.retiros, 'Retiros personales', 'pi pi-user')
                ]
            },
            {
                label: 'Control financiero',
                items: [
                    link(APP_ROUTES.ingresosEgresos, 'Ingresos y egresos', 'pi pi-arrows-h'),
                    link(APP_ROUTES.caja, 'Caja actual', 'pi pi-wallet'),
                    link(APP_ROUTES.cajaHistorial, 'Historial de cajas', 'pi pi-history')
                ]
            },
            {
                label: 'Gestión',
                items: [
                    link(APP_ROUTES.clientes, 'Clientes', 'pi pi-users'),
                    link(APP_ROUTES.proveedores, 'Proveedores', 'pi pi-truck')
                ]
            },
            {
                label: 'Operaciones',
                items: [
                    link(APP_ROUTES.compras, 'Compras', 'pi pi-box'),
                    link(APP_ROUTES.inventario, 'Inventario', 'pi pi-th-large'),
                    link(APP_ROUTES.campanas, 'Campañas de acopio', 'pi pi-sun'),
                    link(APP_ROUTES.produccion, 'Producción', 'pi pi-cog')
                ]
            },
            {
                label: 'Reportes',
                items: [link(APP_ROUTES.reportes, 'Reportes', 'pi pi-chart-bar')]
            }
        ];
    }
}
