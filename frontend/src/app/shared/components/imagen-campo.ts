import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FileSelectEvent, FileUpload, FileUploadHandlerEvent, FileUploadModule } from 'primeng/fileupload';
import { apiUrl } from '../../core/utils/api-url';
import { imagenDefault, mediaUrl, TipoImagen } from '../../core/utils/media-url';
import { AvisoService } from '../services/aviso.service';

@Component({
    selector: 'app-imagen-campo',
    standalone: true,
    imports: [CommonModule, ButtonModule, FileUploadModule],
    styles: [
        `
            :host {
                display: block;
            }
            :host ::ng-deep .p-fileupload,
            :host ::ng-deep .p-fileupload-advanced,
            :host ::ng-deep .p-fileupload-basic {
                width: auto;
                display: inline-flex;
            }
            :host ::ng-deep .p-fileupload .p-button,
            :host ::ng-deep .p-fileupload-choose-button {
                width: auto !important;
            }
        `
    ],
    template: `
        <div class="inline-flex items-center gap-4">
            <div class="relative shrink-0">
                <img
                    [src]="vista"
                    alt="Vista previa"
                    class="object-cover border border-surface-200 dark:border-surface-700 bg-surface-100"
                    [ngClass]="esLogo ? 'h-28 w-28 rounded-xl shadow-sm' : 'h-16 w-16 rounded-border'"
                />
                <div *ngIf="subiendo" class="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                    <i class="pi pi-spin pi-spinner text-white text-xl"></i>
                </div>
            </div>
            <div class="flex flex-col items-start gap-2 min-w-0">
                <p-fileupload
                    #fu
                    mode="basic"
                    [customUpload]="true"
                    [auto]="true"
                    [multiple]="false"
                    [fileLimit]="1"
                    name="imagen"
                    accept="image/*"
                    [maxFileSize]="2097152"
                    [chooseLabel]="esLogo ? 'Cambiar logo' : 'Elegir imagen'"
                    chooseIcon="pi pi-image"
                    [disabled]="subiendo"
                    invalidFileSizeMessageSummary="{0}: tamaño no válido. "
                    invalidFileSizeMessageDetail="El máximo es {0}."
                    invalidFileTypeMessageSummary="{0}: tipo no válido. "
                    invalidFileTypeMessageDetail="Solo imágenes JPG, PNG, WEBP, GIF o SVG."
                    (onSelect)="previsualizar($event)"
                    (uploadHandler)="subir($event)"
                />
                <p-button
                    *ngIf="path && path !== defaultPath"
                    label="Usar default"
                    icon="pi pi-replay"
                    size="small"
                    [outlined]="true"
                    [fluid]="false"
                    [disabled]="subiendo"
                    (onClick)="usarDefault()"
                />
                <small class="text-muted-color">JPG, PNG o WEBP. Máx. 2 MB.</small>
                <small *ngIf="error" class="text-red-500">{{ error }}</small>
            </div>
        </div>
    `
})
export class ImagenCampoComponent implements OnChanges, OnDestroy {
    @Input() tipo: TipoImagen = 'producto';
    @Input() path: string | null | undefined = '';
    @Output() pathChange = new EventEmitter<string>();
    @ViewChild('fu') fu?: FileUpload;

    vista = '';
    error = '';
    subiendo = false;
    defaultPath = imagenDefault('producto');
    private previewLocal = '';

    constructor(private http: HttpClient, private aviso: AvisoService) {}

    get esLogo(): boolean {
        return this.tipo === 'empresa';
    }

    ngOnChanges(): void {
        this.defaultPath = imagenDefault(this.tipo);
        if (!this.previewLocal) {
            this.vista = mediaUrl(this.path, this.tipo);
        }
    }

    ngOnDestroy(): void {
        this.liberarPreview();
    }

    previsualizar(event: FileSelectEvent): void {
        const file = event.files?.[0] || event.currentFiles?.[0];
        if (!file) {
            return;
        }
        this.error = '';
        this.liberarPreview();
        this.previewLocal = URL.createObjectURL(file);
        this.vista = this.previewLocal;
    }

    subir(event: FileUploadHandlerEvent): void {
        const file = event.files?.[0];
        if (!file) {
            return;
        }
        this.error = '';
        this.subiendo = true;
        const data = new FormData();
        data.append('imagen', file);
        this.http.post<{ url: string }>(apiUrl(`/api/uploads?tipo=${this.tipo}`), data).subscribe({
            next: (res) => {
                this.subiendo = false;
                this.liberarPreview();
                this.fu?.clear();
                this.pathChange.emit(res.url);
                this.vista = mediaUrl(res.url, this.tipo);
            },
            error: (err) => {
                this.subiendo = false;
                this.error = this.aviso.error(err, 'No se pudo subir la imagen').resumen;
                this.usarDefault();
            }
        });
    }

    usarDefault(): void {
        this.fu?.clear();
        this.liberarPreview();
        this.pathChange.emit(this.defaultPath);
        this.vista = mediaUrl(this.defaultPath, this.tipo);
    }

    private liberarPreview(): void {
        if (this.previewLocal) {
            URL.revokeObjectURL(this.previewLocal);
            this.previewLocal = '';
        }
    }
}
