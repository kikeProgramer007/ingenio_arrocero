import { Component, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StyleClassModule } from 'primeng/styleclass';
import { AppConfigurator } from './app.configurator';
import { LayoutService } from '../service/layout.service';
import { MenuModule } from 'primeng/menu';
import { AuthService } from '../../core/services/auth.service';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { EmpresaService } from '../../core/services/empresa.service';
import { ConfirmarService } from '../../shared/services/confirmar.service';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, MenuModule, CommonModule, StyleClassModule, AppConfigurator],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo" [routerLink]="dashboardRoute">
                <img [src]="empresa.logo()" [alt]="empresa.nombreUi()" />
                <span>{{ empresa.nombreUi() }}</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
                <div class="relative">
                    <button
                        class="layout-topbar-action layout-topbar-action-highlight"
                        pStyleClass="@next"
                        enterFromClass="hidden"
                        enterActiveClass="animate-scalein"
                        leaveToClass="hidden"
                        leaveActiveClass="animate-fadeout"
                        [hideOnOutsideClick]="true"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <app-configurator />
                </div>
            </div>

            <button class="layout-topbar-menu-button layout-topbar-action" pStyleClass="@next" enterFromClass="hidden" enterActiveClass="animate-scalein" leaveToClass="hidden" leaveActiveClass="animate-fadeout" [hideOnOutsideClick]="true">
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action" (click)="profileMenu.toggle($event)">
                        <i class="pi pi-user"></i>
                        <span>{{ usuario }}</span>
                    </button>
                </div>
            </div>
        </div>
        <p-menu #profileMenu [model]="items" [popup]="true"></p-menu>
    </div>`
})
export class AppTopbar {
    empresa = inject(EmpresaService);
    dashboardRoute = APP_ROUTES.dashboard;
    items: MenuItem[] = [{ label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.logout() }];

    constructor(
        public layoutService: LayoutService,
        private router: Router,
        private authService: AuthService,
        private confirmar: ConfirmarService
    ) {}

    get usuario(): string {
        return this.authService.getUser()?.username || 'Cuenta';
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({ ...state, darkTheme: !state.darkTheme }));
    }

    logout() {
        this.confirmar
            .pedir({
                titulo: 'Cerrar sesión',
                mensaje: '¿Estás seguro de que deseas cerrar sesión?',
                icono: 'pi pi-sign-out',
                aceptar: 'Cerrar sesión',
                peligro: true
            })
            .then((ok) => {
                if (!ok) {
                    return;
                }
                this.authService.clearSession();
                this.router.navigateByUrl(APP_ROUTES.login);
            });
    }
}
