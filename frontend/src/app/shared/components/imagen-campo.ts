import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { apiUrl } from '../../core/utils/api-url';
import { imagenDefault, mediaUrl, TipoImagen } from '../../core/utils/media-url';

@Component({
    selector: 'app-imagen-campo',
    standalone: true,
    imports: [CommonModule, ButtonModule],
    template: `
        <div class="flex items-center gap-3">
            <img [src]="vista" alt="Imagen" class="w-16 h-16 rounded-border object-cover border border-surface-200 dark:border-surface-700 bg-surface-100" />
            <div class="flex flex-col gap-2">
                <input type="file" accept="image/*" (change)="onFile($event)" />
                <small class="text-muted-color">Opcional. Si no eliges archivo, se guarda la imagen por defecto.</small>
                <p-button *ngIf="path && path !== defaultPath" label="Usar default" size="small" [outlined]="true" (onClick)="usarDefault()" />
            </div>
        </div>
        <small *ngIf="error" class="block text-red-500 mt-2">{{ error }}</small>
    `
})
export class ImagenCampoComponent implements OnChanges {
    @Input() tipo: TipoImagen = 'producto';
    @Input() path: string | null | undefined = '';
    @Output() pathChange = new EventEmitter<string>();

    vista = '';
    error = '';
    defaultPath = imagenDefault('producto');

    constructor(private http: HttpClient) {}

    ngOnChanges(): void {
        this.defaultPath = imagenDefault(this.tipo);
        this.vista = mediaUrl(this.path, this.tipo);
    }

    onFile(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        this.error = '';
        const data = new FormData();
        data.append('imagen', file);
        this.http.post<{ url: string }>(apiUrl(`/api/uploads?tipo=${this.tipo}`), data).subscribe({
            next: (res) => {
                this.pathChange.emit(res.url);
                this.vista = mediaUrl(res.url, this.tipo);
            },
            error: (err) => {
                this.error = err?.error?.mensaje || err?.error?.message || 'No se pudo subir la imagen';
                this.usarDefault();
            }
        });
        input.value = '';
    }

    usarDefault(): void {
        this.pathChange.emit(this.defaultPath);
        this.vista = mediaUrl(this.defaultPath, this.tipo);
    }
}
