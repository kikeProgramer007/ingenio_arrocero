import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AvisoService } from '../../shared/services/aviso.service';
import { AyudaCampoComponent } from '../../shared/components/ayuda-campo';
import { TablaEsqueletoComponent } from '../../shared/components/tabla-esqueleto';
import { TablaBusquedaComponent } from '../../shared/components/tabla-busqueda';
import { FILAS_TABLA, filtrarTabla } from '../../shared/utils/tabla';
import { ESTADOS_ACTIVO_FILTRO } from '../../shared/utils/fecha-filtro';
import { AuthService } from '../../core/services/auth.service';
import { PerfilLista, Usuario, UsuariosService } from './usuarios.service';

@Component({
    selector: 'app-usuarios',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        PasswordModule,
        SelectModule,
        TableModule,
        TagModule,
        ToggleSwitchModule,
        TooltipModule,
        MenuModule,
        AyudaCampoComponent,
        TablaEsqueletoComponent,
        TablaBusquedaComponent
    ],
    template: `
        <p-menu #menuAcciones [popup]="true" [model]="itemsAcciones" [appendTo]="'body'" [baseZIndex]="1200" />
        <div class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div class="min-w-0">
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Usuarios</div>
                <div class="text-muted-color">Cuentas que entran al sistema. El nombre completo aparece en las notas como vendedor.</div>
            </div>
            <p-button label="Nuevo usuario" icon="pi pi-plus" (onClick)="abrirNuevo()" />
        </div>

        <div class="card">
            <div class="barra-listado">
                <div class="campo">
                    <label class="block font-bold mb-1 text-sm">Estado</label>
                    <p-select [options]="estadosActivo" optionLabel="label" optionValue="value" [(ngModel)]="filtroActivo" fluid appendTo="body" />
                </div>
                <div class="campo-buscar">
                    <label class="block font-bold mb-1 text-sm">Buscar</label>
                    <app-tabla-busqueda placeholder="Buscar por nombre, usuario o cargo" (buscar)="filtrarTabla(dt, $event)" />
                </div>
            </div>
            <p-table
                #dt
                [value]="cargando ? [] : usuariosFiltrados"
                [loading]="cargando"
                [showLoader]="false"
                dataKey="id"
                [paginator]="true"
                [rows]="10"
                [rowsPerPageOptions]="filasTabla"
                [globalFilterFields]="['username', 'nombre', 'ci', 'cargo', 'perfil.nombre']"
                responsiveLayout="scroll"
            >
                <ng-template #header>
                    <tr>
                        <th>Usuario</th>
                        <th>Nombre</th>
                        <th>CI</th>
                        <th>Teléfono</th>
                        <th>Cargo</th>
                        <th>Perfil</th>
                        <th>Estado</th>
                        <th style="width: 4rem"></th>
                    </tr>
                </ng-template>
                <ng-template #body let-u>
                    <tr>
                        <td class="font-medium">{{ u.username }}</td>
                        <td>{{ u.nombre || '-' }}</td>
                        <td>{{ u.ci || '-' }}</td>
                        <td>{{ u.telefono || '-' }}</td>
                        <td>{{ u.cargo || '-' }}</td>
                        <td>{{ u.perfil?.nombre || '-' }}</td>
                        <td>
                            <p-tag [value]="u.activo ? 'Activo' : 'Inactivo'" [severity]="u.activo ? 'success' : 'secondary'" />
                        </td>
                        <td>
                            <p-button
                                icon="pi pi-ellipsis-v"
                                [rounded]="true"
                                [text]="true"
                                severity="secondary"
                                pTooltip="Opciones"
                                tooltipPosition="left"
                                ariaLabel="Opciones del usuario"
                                (onClick)="abrirAcciones($event, menuAcciones, u)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #loadingbody>
                    <tr *ngFor="let f of [0,1,2,3,4,5,6,7]" app-tabla-esqueleto [columnas]="8" [fila]="f"></tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8">
                            <div class="text-center py-8 text-muted-color">
                                <i class="pi pi-users text-4xl mb-3 block"></i>
                                No hay usuarios registrados.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog [header]="form.id ? 'Editar usuario' : 'Nuevo usuario'" [(visible)]="dialog" [modal]="true" [style]="{ width: '36rem' }" [breakpoints]="{ '960px': '95vw' }">
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Usuario de acceso <span class="text-red-500">*</span> <app-ayuda-campo texto="Con este nombre entra al sistema. Sin espacios." posicion="right" /></label>
                        <input pInputText class="w-full" [(ngModel)]="form.username" [class.ng-invalid]="invalido('username')" [class.ng-dirty]="intento" autocomplete="off" />
                        <small class="text-red-500" *ngIf="invalido('username')">{{ errorUsername }}</small>
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Nombre completo <span class="text-red-500">*</span> <app-ayuda-campo texto="Sale en la nota como VENDEDOR y Guardado por." posicion="right" /></label>
                        <input pInputText class="w-full" [(ngModel)]="form.nombre" [class.ng-invalid]="invalido('nombre')" [class.ng-dirty]="intento" />
                        <small class="text-red-500" *ngIf="invalido('nombre')">El nombre completo es obligatorio</small>
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Contraseña <span class="text-red-500" *ngIf="!form.id">*</span> <app-ayuda-campo [texto]="form.id ? 'Déjala vacía si no quieres cambiarla.' : 'Mínimo 6 caracteres.'" posicion="right" /></label>
                        <p-password [(ngModel)]="password" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [class.ng-invalid]="invalido('password')" [class.ng-dirty]="intento" />
                        <small class="text-red-500" *ngIf="invalido('password')">{{ errorPassword }}</small>
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Confirmar contraseña <span class="text-red-500" *ngIf="!form.id">*</span></label>
                        <p-password [(ngModel)]="password2" [feedback]="false" [toggleMask]="true" [fluid]="true" autocomplete="new-password" [class.ng-invalid]="invalido('password2')" [class.ng-dirty]="intento" />
                        <small class="text-red-500" *ngIf="invalido('password2')">Las contraseñas no coinciden</small>
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Perfil <span class="text-red-500">*</span> <app-ayuda-campo texto="Define qué menús y permisos tiene." posicion="right" /></label>
                        <p-select [options]="perfiles" optionLabel="nombre" optionValue="id" [(ngModel)]="form.id_perfil" placeholder="Seleccione" fluid appendTo="body" [baseZIndex]="2100" [class.ng-invalid]="invalido('perfil')" />
                        <small class="text-red-500" *ngIf="invalido('perfil')">El perfil es obligatorio</small>
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Cargo <app-ayuda-campo texto="Ej.: Cajera, Encargado de ventas. Opcional." posicion="right" /></label>
                        <input pInputText class="w-full" [(ngModel)]="form.cargo" />
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">CI <app-ayuda-campo texto="Documento de identidad. Opcional." posicion="right" /></label>
                        <input pInputText class="w-full" [(ngModel)]="form.ci" />
                    </div>
                    <div class="col-span-12 md:col-span-6">
                        <label class="flex items-center gap-1 font-bold mb-2">Teléfono</label>
                        <input pInputText class="w-full" [(ngModel)]="form.telefono" />
                    </div>
                    <div class="col-span-12">
                        <label class="flex items-center gap-1 font-bold mb-2">Correo</label>
                        <input pInputText class="w-full" [(ngModel)]="form.email" type="email" [class.ng-invalid]="invalido('email')" [class.ng-dirty]="intento" />
                        <small class="text-red-500" *ngIf="invalido('email')">El correo no es válido</small>
                    </div>
                </div>
                <div class="flex items-center gap-2" *ngIf="form.id">
                    <p-toggleswitch [(ngModel)]="form.activo" [disabled]="esYo" />
                    <span>Activo</span>
                    <small class="text-muted-color" *ngIf="esYo">No puedes inactivar tu propia cuenta</small>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="dialog = false" />
                <p-button label="Guardar" [loading]="guardando" (onClick)="guardar()" />
            </ng-template>
        </p-dialog>
    `
})
export class UsuariosPage implements OnInit {
    filasTabla = FILAS_TABLA;
    filtrarTabla = filtrarTabla;
    usuarios: Usuario[] = [];
    perfiles: PerfilLista[] = [];
    cargando = false;
    guardando = false;
    dialog = false;
    intento = false;
    password = '';
    password2 = '';
    form: Usuario = this.vacio();
    itemsAcciones: MenuItem[] = [];
    estadosActivo = ESTADOS_ACTIVO_FILTRO;
    filtroActivo = 'todos';

    constructor(
        private usuariosService: UsuariosService,
        private aviso: AvisoService,
        private auth: AuthService
    ) {}

    ngOnInit(): void {
        this.cargar();
        this.usuariosService.listarPerfiles().subscribe({
            next: (data) => (this.perfiles = data),
            error: (err) => this.aviso.error(err, 'No se pudieron cargar los perfiles')
        });
    }

    get usuariosFiltrados(): Usuario[] {
        return this.usuarios.filter((u) => {
            if (this.filtroActivo === 'activos' && !u.activo) {
                return false;
            }
            if (this.filtroActivo === 'inactivos' && u.activo) {
                return false;
            }
            return true;
        });
    }

    get esYo(): boolean {
        return !!this.form.id && this.form.id === this.auth.getUser()?.id;
    }

    get errorUsername(): string {
        const u = (this.form.username || '').trim();
        if (!u) {
            return 'El usuario de acceso es obligatorio';
        }
        if (u.length < 3) {
            return 'Mínimo 3 caracteres';
        }
        if (/\s/.test(u)) {
            return 'Sin espacios';
        }
        return '';
    }

    get errorPassword(): string {
        if (!this.form.id && !this.password) {
            return 'La contraseña es obligatoria';
        }
        if (this.password && this.password.length < 6) {
            return 'Mínimo 6 caracteres';
        }
        return '';
    }

    invalido(campo: string): boolean {
        if (!this.intento) {
            return false;
        }
        if (campo === 'username') {
            return !!this.errorUsername;
        }
        if (campo === 'nombre') {
            return !this.form.nombre?.trim();
        }
        if (campo === 'password') {
            return !!this.errorPassword;
        }
        if (campo === 'password2') {
            if (!this.form.id && !this.password2) {
                return true;
            }
            return !!this.password && this.password !== this.password2;
        }
        if (campo === 'perfil') {
            return !this.form.id_perfil;
        }
        if (campo === 'email') {
            const e = (this.form.email || '').trim();
            return !!e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
        }
        return false;
    }

    cargar(): void {
        this.cargando = true;
        this.usuariosService.listar({ activos: 'todos' }).subscribe({
            next: (data) => {
                this.usuarios = data;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.aviso.error(err, 'No se pudo cargar usuarios');
            }
        });
    }

    abrirNuevo(): void {
        this.form = this.vacio();
        this.password = '';
        this.password2 = '';
        this.intento = false;
        this.dialog = true;
    }

    abrirAcciones(event: Event, menu: Menu, u: Usuario): void {
        this.itemsAcciones = [
            {
                label: 'Editar',
                icon: 'pi pi-pencil menu-icon-editar',
                iconStyle: { color: '#f59e0b' },
                command: () => this.editar(u)
            }
        ];
        menu.toggle(event);
    }

    editar(u: Usuario): void {
        this.form = { ...u };
        this.password = '';
        this.password2 = '';
        this.intento = false;
        this.dialog = true;
    }

    guardar(): void {
        this.intento = true;
        if (this.errorUsername || !this.form.nombre?.trim() || this.errorPassword || this.invalido('password2') || !this.form.id_perfil || this.invalido('email')) {
            this.aviso.aviso('Validación', 'Revisa los campos marcados');
            return;
        }
        this.guardando = true;
        const datos: Partial<Usuario> & { password?: string } = {
            username: this.form.username.trim(),
            nombre: this.form.nombre.trim(),
            ci: this.form.ci || null,
            telefono: this.form.telefono || null,
            email: this.form.email || null,
            cargo: this.form.cargo || null,
            id_perfil: this.form.id_perfil,
            activo: this.form.activo
        };
        if (this.password) {
            datos.password = this.password;
        }
        const req = this.form.id
            ? this.usuariosService.actualizar(this.form.id, datos)
            : this.usuariosService.crear({ ...datos, password: this.password });
        req.subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialog = false;
                this.aviso.ok('Listo', res.mensaje);
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.aviso.error(err, 'No se pudo guardar');
            }
        });
    }

    private vacio(): Usuario {
        return {
            id: 0,
            username: '',
            nombre: '',
            ci: '',
            telefono: '',
            email: '',
            cargo: '',
            activo: true,
            id_perfil: null
        };
    }
}
