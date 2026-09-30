import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { ImagenCampoComponent } from '../../shared/components/imagen-campo';
import { AvisoService } from '../../shared/services/aviso.service';
import { Empresa } from '../../core/constants/empresa';
import { EmpresaService } from '../../core/services/empresa.service';
import { TipoImagen } from '../../core/utils/media-url';

@Component({
    selector: 'app-empresa',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, FluidModule, InputTextModule, SkeletonModule, AyudaCampoComponent, ImagenCampoComponent],
    template: `
        <div class="mb-6 min-w-0">
            <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Empresa</div>
            <div class="text-muted-color">Datos que aparecen en el login, el dashboard y los reportes PDF</div>
        </div>

        <div class="card">
            @if (cargando) {
                <div class="flex mb-6">
                    <p-skeleton width="7rem" height="7rem" borderRadius="12px" styleClass="mr-4 shrink-0" />
                    <div class="flex flex-col gap-2">
                        <p-skeleton width="8.5rem" height="2.5rem" />
                        <p-skeleton width="6rem" height="0.8rem" />
                    </div>
                </div>
                <div class="grid grid-cols-12 gap-4">
                    @for (i of esqueletoCampos; track i) {
                        <div class="col-span-12 md:col-span-6">
                            <p-skeleton width="7rem" height="0.8rem" styleClass="mb-2" />
                            <p-skeleton width="100%" height="2.5rem" />
                        </div>
                    }
                </div>
                <div class="flex justify-end mt-6">
                    <p-skeleton width="7rem" height="2.5rem" />
                </div>
            } @else {
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">
                            Logotipo
                            <app-ayuda-campo texto="Se usa en el login, el dashboard, la barra superior y las notas de venta." />
                        </label>
                        <app-imagen-campo [tipo]="tipoLogo" [(path)]="form.path_logo" />
                    </div>
                    <p-fluid>
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-nombre" class="font-medium">
                                    Nombre comercial
                                    <app-ayuda-campo texto="Nombre que sale en las notas de venta y reportes PDF." />
                                </label>
                                <input pInputText id="emp-nombre" [(ngModel)]="form.nombre" maxlength="150" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-corto" class="font-medium">
                                    Nombre corto
                                    <app-ayuda-campo texto="Nombre compacto para el login y la barra superior." />
                                </label>
                                <input pInputText id="emp-corto" [(ngModel)]="form.nombre_corto" maxlength="80" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-slogan" class="font-medium">Slogan</label>
                                <input pInputText id="emp-slogan" [(ngModel)]="form.slogan" maxlength="150" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-titular" class="font-medium">
                                    Titular
                                    <app-ayuda-campo texto="Nombre del propietario o razón social que encabeza el ticket." />
                                </label>
                                <input pInputText id="emp-titular" [(ngModel)]="form.titular" maxlength="150" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-nit" class="font-medium">NIT</label>
                                <input pInputText id="emp-nit" [(ngModel)]="form.nit" maxlength="30" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-telefono" class="font-medium">Teléfono</label>
                                <input pInputText id="emp-telefono" [(ngModel)]="form.telefono" maxlength="80" placeholder="78508795 - 74164188" />
                            </div>
                            <div class="col-span-12 flex flex-col gap-2">
                                <label for="emp-direccion" class="font-medium">Dirección</label>
                                <input pInputText id="emp-direccion" [(ngModel)]="form.direccion" maxlength="250" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-ciudad" class="font-medium">Ciudad</label>
                                <input pInputText id="emp-ciudad" [(ngModel)]="form.ciudad" maxlength="80" />
                            </div>
                            <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
                                <label for="emp-email" class="font-medium">Correo</label>
                                <input pInputText id="emp-email" [(ngModel)]="form.email" maxlength="120" />
                            </div>
                        </div>
                    </p-fluid>
                    <div class="flex justify-end pt-4 mt-2 border-t border-surface">
                        <p-button label="Guardar" icon="pi pi-save" [fluid]="false" [loading]="guardando" (onClick)="guardar()" />
                    </div>
                </div>
            }
        </div>
    `
})
export class EmpresaPage implements OnInit {
    private empresaService = inject(EmpresaService);
    private aviso = inject(AvisoService);
    readonly tipoLogo: TipoImagen = 'empresa';
    readonly esqueletoCampos = [1, 2, 3, 4, 5, 6];
    cargando = true;
    guardando = false;
    form: Empresa = {
        id: 0,
        nombre: '',
        nombre_corto: '',
        slogan: '',
        titular: '',
        nit: '',
        direccion: '',
        telefono: '',
        ciudad: '',
        email: '',
        path_logo: ''
    };

    ngOnInit(): void {
        this.empresaService.cargar().subscribe({
            next: (empresa) => {
                this.form = { ...empresa };
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudieron cargar los datos de la empresa');
            }
        });
    }

    guardar(): void {
        if (!this.form.nombre.trim()) {
            this.aviso.aviso('El nombre comercial es obligatorio');
            return;
        }
        this.guardando = true;
        this.empresaService.guardar(this.form).subscribe({
            next: (res) => {
                this.guardando = false;
                this.form = { ...res.data };
                this.aviso.ok(res.mensaje || 'Datos de la empresa actualizados');
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudieron guardar los datos de la empresa');
            }
        });
    }
}
