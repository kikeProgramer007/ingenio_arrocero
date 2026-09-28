import { Component } from '@angular/core';
import { EMPRESA } from '../../core/constants/empresa';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        {{ empresa.nombre }}
        <span class="text-muted-color mx-2">·</span>
        <span class="text-muted-color">{{ empresa.slogan }}</span>
    </div>`
})
export class AppFooter {
    empresa = EMPRESA;
}
