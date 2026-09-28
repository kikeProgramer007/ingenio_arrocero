import { Component, Input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-ayuda-campo',
    standalone: true,
    imports: [TooltipModule],
    host: { class: 'inline-flex items-center' },
    template: `
        <i
            class="pi pi-info-circle text-muted-color hover:text-primary cursor-help"
            [pTooltip]="texto"
            [tooltipPosition]="posicion"
            tooltipEvent="hover"
            [escape]="true"
            tabindex="0"
            role="img"
            [attr.aria-label]="texto"
        ></i>
    `
})
export class AyudaCampoComponent {
    @Input({ required: true }) texto = '';
    @Input() posicion: 'top' | 'bottom' | 'left' | 'right' = 'top';
}
