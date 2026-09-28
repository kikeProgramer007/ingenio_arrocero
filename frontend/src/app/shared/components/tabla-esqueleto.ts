import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
    selector: 'tr[app-tabla-esqueleto]',
    standalone: true,
    imports: [CommonModule, SkeletonModule],
    template: `
        <td *ngFor="let col of columnasArr; let i = index">
            <div class="flex items-center gap-2 py-1" *ngIf="conAvatar && i === 0">
                <p-skeleton shape="circle" size="1.75rem" />
                <p-skeleton [width]="ancho(i)" height="0.8rem" />
            </div>
            <p-skeleton *ngIf="!(conAvatar && i === 0)" [width]="ancho(i)" height="0.8rem" />
        </td>
    `
})
export class TablaEsqueletoComponent {
    @Input() columnas = 6;
    @Input() fila = 0;
    @Input() conAvatar = false;

    private readonly anchos = ['72%', '88%', '54%', '40%', '66%', '48%', '36%', '78%'];

    get columnasArr(): number[] {
        return Array.from({ length: this.columnas }, (_, i) => i);
    }

    ancho(col: number): string {
        return this.anchos[(col + this.fila) % this.anchos.length];
    }
}
