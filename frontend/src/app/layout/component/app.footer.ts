import { Component, inject } from '@angular/core';
import { EmpresaService } from '../../core/services/empresa.service';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        {{ empresa.nombreUi() }}
        <span class="text-muted-color mx-2">·</span>
        <span class="text-muted-color">{{ empresa.slogan() }}</span>
    </div>`
})
export class AppFooter {
    empresa = inject(EmpresaService);
}
