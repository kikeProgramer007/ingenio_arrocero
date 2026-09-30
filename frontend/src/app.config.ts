import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { firstValueFrom } from 'rxjs';
import { appRoutes } from './app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { EmpresaService } from './app/core/services/empresa.service';
import { RoyalAura } from './app/core/theme/royal-theme';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }), withEnabledBlockingInitialNavigation()),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
        provideAppInitializer(() => {
            const empresa = inject(EmpresaService);
            return firstValueFrom(empresa.cargar());
        }),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: { preset: RoyalAura, options: { darkModeSelector: '.app-dark' } },
            translation: {
                emptyMessage: 'No se encontraron resultados',
                emptyFilterMessage: 'No hay resultados',
                emptySearchMessage: 'No hay resultados',
                choose: 'Elegir',
                upload: 'Subir',
                cancel: 'Cancelar',
                pending: 'Pendiente',
                aria: {
                    firstPageLabel: 'Primera página',
                    lastPageLabel: 'Última página',
                    nextPageLabel: 'Página siguiente',
                    prevPageLabel: 'Página anterior',
                    rowsPerPageLabel: 'Filas por página',
                    pageLabel: 'Página {page}'
                }
            }
        }),
        ConfirmationService,
        MessageService
    ]
};
