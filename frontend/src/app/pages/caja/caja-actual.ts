import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { HttpErrorResponse } from '@angular/common/http';
import {
    CATEGORIAS_POR_TIPO,
    METODOS_PAGO_OPTIONS,
    TIPOS_MOVIMIENTO_OPTIONS,
    TIPO_MOVIMIENTO
} from './caja.constants';
import { CajaDetalle, CrearMovimientoRequest } from './caja.models';
import { APP_ROUTES } from '../../core/constants/app-routes';
import { AuthService } from '../../core/services/auth.service';
import { CajaService } from './caja.service';
import { etiquetaCategoria, etiquetaMetodo, formatBs, formatHora } from './caja.utils';

@Component({
    selector: 'app-caja-actual',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        SkeletonModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule,
        TooltipModule
    ],
    providers: [MessageService],
    template: `
        <p-toast />

        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
                <div class="text-surface-900 dark:text-surface-0 font-semibold text-2xl mb-1">Caja actual</div>
                <div class="text-muted-color">Apertura, movimientos y arqueo de la caja del ingenio</div>
            </div>
            <div class="flex gap-2" *ngIf="caja">
                <p-button label="+ Nuevo movimiento" icon="pi pi-plus" (onClick)="abrirDialogMovimiento()" [disabled]="guardando" />
                <p-button label="Cerrar caja" icon="pi pi-lock" severity="warn" (onClick)="abrirDialogCierre()" [disabled]="guardando" />
            </div>
        </div>

        <div class="card" *ngIf="cargando">
            <p-skeleton width="40%" height="1.5rem" styleClass="mb-4" />
            <div class="grid grid-cols-12 gap-4">
                <div class="col-span-12 md:col-span-3" *ngFor="let i of [1,2,3,4]">
                    <p-skeleton height="6rem" />
                </div>
            </div>
            <p-skeleton height="12rem" styleClass="mt-4" />
        </div>

        <div class="card text-center py-12" *ngIf="!cargando && error">
            <i class="pi pi-exclamation-circle text-4xl text-red-500 mb-3"></i>
            <div class="font-medium mb-3">{{ error }}</div>
            <p-button label="Reintentar" icon="pi pi-refresh" (onClick)="cargar()" />
        </div>

        <ng-container *ngIf="!cargando && !error && !caja">
            <div class="card max-w-2xl">
                <div class="flex items-center gap-3 mb-6">
                    <div class="flex items-center justify-center bg-primary-100 dark:bg-primary-400/10 rounded-border" style="width: 3rem; height: 3rem">
                        <i class="pi pi-wallet text-primary !text-xl"></i>
                    </div>
                    <div>
                        <div class="font-semibold text-xl">Abrir caja</div>
                        <div class="text-muted-color">No hay una caja abierta. Ingresa el saldo inicial para comenzar.</div>
                    </div>
                </div>

                <div class="flex flex-col gap-5">
                    <div>
                        <label class="block font-bold mb-2">Saldo inicial</label>
                        <p-inputnumber [(ngModel)]="saldoInicial" mode="decimal" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" prefix="Bs " fluid />
                    </div>
                    <div>
                        <label class="block font-bold mb-2">Observación (opcional)</label>
                        <textarea pTextarea [(ngModel)]="observacionApertura" rows="3" fluid></textarea>
                    </div>
                    <div class="text-muted-color text-sm">
                        Usuario: <span class="font-medium text-surface-900 dark:text-surface-0">{{ username }}</span>
                        · Fecha: {{ ahora | date:'dd/MM/yyyy HH:mm' }}
                    </div>
                    <div class="flex justify-end">
                        <p-button label="Abrir caja" icon="pi pi-unlock" [loading]="guardando" (onClick)="abrirCaja()" />
                    </div>
                </div>
            </div>
        </ng-container>

        <ng-container *ngIf="!cargando && !error && caja">
            <div class="grid grid-cols-12 gap-4 mb-6">
                <div class="col-span-12 sm:col-span-6 xl:col-span-3" *ngFor="let card of cardsResumen()">
                    <div class="card mb-0">
                        <div class="flex justify-between mb-3">
                            <div>
                                <span class="block text-muted-color font-medium mb-3">{{ card.label }}</span>
                                <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ card.value }}</div>
                            </div>
                            <div class="flex items-center justify-center rounded-border" [class]="card.iconBg" style="width: 2.5rem; height: 2.5rem">
                                <i [class]="card.icon"></i>
                            </div>
                        </div>
                        <p-tag *ngIf="card.tag" [value]="card.tag" [severity]="card.severity" />
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="font-semibold text-xl mb-4">Movimientos de caja</div>
                <p-table [value]="caja.movimientos || []" [loading]="cargandoTabla" [paginator]="true" [rows]="10" responsiveLayout="scroll">
                    <ng-template #header>
                        <tr>
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Categoría</th>
                            <th>Concepto</th>
                            <th>Método</th>
                            <th>Ingreso</th>
                            <th>Egreso</th>
                            <th>Usuario</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-mov>
                        <tr>
                            <td>{{ formatHora(mov.fecha) }}</td>
                            <td>
                                <p-tag [value]="mov.tipo" [severity]="mov.tipo === 'INGRESO' ? 'success' : 'danger'" />
                            </td>
                            <td>{{ etiquetaCategoria(mov.categoria) }}</td>
                            <td>{{ mov.concepto }}</td>
                            <td>{{ etiquetaMetodo(mov.metodo_pago) }}</td>
                            <td class="text-green-600 font-medium">{{ mov.ingreso ? formatBs(mov.ingreso) : '-' }}</td>
                            <td class="text-red-500 font-medium">{{ mov.egreso ? formatBs(mov.egreso) : '-' }}</td>
                            <td>{{ mov.usuario?.username || '-' }}</td>
                        </tr>
                    </ng-template>
                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="8">
                                <div class="text-center py-8 text-muted-color">
                                    <i class="pi pi-inbox text-4xl mb-3 block"></i>
                                    No existen movimientos registrados en esta caja.
                                </div>
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </div>
        </ng-container>

        <p-dialog header="Nuevo movimiento" [(visible)]="dialogMovimiento" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '90vw' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block font-bold mb-2">Tipo</label>
                    <p-select [options]="tipos" optionLabel="label" optionValue="value" [(ngModel)]="movimiento.tipo" (onChange)="onCambioTipo()" placeholder="Selecciona" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Categoría</label>
                    <p-select [options]="categorias" optionLabel="label" optionValue="value" [(ngModel)]="movimiento.categoria" placeholder="Selecciona" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Concepto</label>
                    <input pInputText [(ngModel)]="movimiento.concepto" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Monto</label>
                    <p-inputnumber [(ngModel)]="movimiento.monto" mode="decimal" [min]="0.01" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" prefix="Bs " fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Método de pago</label>
                    <p-select [options]="metodos" optionLabel="label" optionValue="value" [(ngModel)]="movimiento.metodo_pago" placeholder="Selecciona" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Referencia (opcional)</label>
                    <input pInputText [(ngModel)]="movimiento.referencia" fluid />
                </div>
                <div>
                    <label class="block font-bold mb-2">Observación (opcional)</label>
                    <textarea pTextarea [(ngModel)]="movimiento.observacion" rows="2" fluid></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogMovimiento = false" />
                <p-button label="Guardar" icon="pi pi-check" [loading]="guardando" (onClick)="guardarMovimiento()" />
            </ng-template>
        </p-dialog>

        <p-dialog header="Cerrar caja / Arqueo" [(visible)]="dialogCierre" [modal]="true" [style]="{ width: '32rem' }" [breakpoints]="{ '960px': '90vw' }">
            <div class="flex flex-col gap-4" *ngIf="caja">
                <div class="grid grid-cols-2 gap-3">
                    <div class="text-muted-color">Saldo inicial</div>
                    <div class="font-medium text-right">{{ formatBs(caja.saldo_inicial) }}</div>
                    <div class="text-muted-color">Total ingresos</div>
                    <div class="font-medium text-right text-green-600">{{ formatBs(caja.ingresos) }}</div>
                    <div class="text-muted-color">Total egresos</div>
                    <div class="font-medium text-right text-red-500">{{ formatBs(caja.egresos) }}</div>
                    <div class="font-semibold">Saldo esperado</div>
                    <div class="font-semibold text-right">{{ formatBs(caja.saldo_esperado) }}</div>
                </div>
                <div>
                    <label class="block font-bold mb-2">Saldo contado físicamente</label>
                    <p-inputnumber [(ngModel)]="saldoContado" mode="decimal" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" prefix="Bs " fluid />
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-muted-color">Diferencia</span>
                    <span class="font-semibold">{{ formatBs(diferenciaCierre) }}</span>
                </div>
                <p-tag [value]="etiquetaArqueo" [severity]="severidadArqueo" />
                <div>
                    <label class="block font-bold mb-2">Observación (opcional)</label>
                    <textarea pTextarea [(ngModel)]="observacionCierre" rows="2" fluid></textarea>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogCierre = false" />
                <p-button label="Confirmar cierre" icon="pi pi-lock" severity="warn" [loading]="guardando" (onClick)="cerrarCaja()" />
            </ng-template>
        </p-dialog>
    `
})
export class CajaActual implements OnInit {
    caja: CajaDetalle | null = null;
    cargando = true;
    cargandoTabla = false;
    guardando = false;
    error: string | null = null;
    username = '';
    ahora = new Date();
    saldoInicial = 0;
    observacionApertura = '';
    dialogMovimiento = false;
    dialogCierre = false;
    saldoContado = 0;
    observacionCierre = '';
    tipos = TIPOS_MOVIMIENTO_OPTIONS;
    metodos = METODOS_PAGO_OPTIONS;
    categorias = CATEGORIAS_POR_TIPO[TIPO_MOVIMIENTO.INGRESO];
    movimiento: CrearMovimientoRequest = this.movimientoVacio();

    formatBs = formatBs;
    formatHora = formatHora;
    etiquetaCategoria = etiquetaCategoria;
    etiquetaMetodo = etiquetaMetodo;

    constructor(
        private cajaService: CajaService,
        private messageService: MessageService,
        private router: Router,
        private authService: AuthService
    ) {}

    ngOnInit(): void {
        this.username = this.obtenerUsername();
        this.cargar();
    }

    cardsResumen() {
        if (!this.caja) {
            return [];
        }
        return [
            { label: 'Saldo inicial', value: formatBs(this.caja.saldo_inicial), icon: 'pi pi-inbox text-blue-500 !text-xl', iconBg: 'bg-blue-100 dark:bg-blue-400/10', tag: '', severity: 'info' as const },
            { label: 'Ingresos', value: formatBs(this.caja.ingresos), icon: 'pi pi-arrow-down-left text-green-500 !text-xl', iconBg: 'bg-green-100 dark:bg-green-400/10', tag: '', severity: 'success' as const },
            { label: 'Egresos', value: formatBs(this.caja.egresos), icon: 'pi pi-arrow-up-right text-red-500 !text-xl', iconBg: 'bg-red-100 dark:bg-red-400/10', tag: '', severity: 'danger' as const },
            { label: 'Saldo esperado', value: formatBs(this.caja.saldo_esperado), icon: 'pi pi-wallet text-primary !text-xl', iconBg: 'bg-primary-100 dark:bg-primary-400/10', tag: this.caja.estado, severity: 'success' as const }
        ];
    }

    cargar(): void {
        this.cargando = true;
        this.error = null;
        this.cajaService.obtenerAbierta().subscribe({
            next: (caja) => {
                this.caja = caja;
                this.cargando = false;
            },
            error: (err) => {
                this.cargando = false;
                this.error = this.mensajeError(err, 'No se pudo cargar la caja actual');
            }
        });
    }

    abrirCaja(): void {
        if (this.saldoInicial == null || this.saldoInicial < 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El saldo inicial no puede ser negativo' });
            return;
        }
        this.guardando = true;
        this.cajaService.abrir({
            saldo_inicial: this.saldoInicial,
            observacion: this.observacionApertura || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.caja = res.data;
                this.messageService.add({ severity: 'success', summary: 'Caja abierta', detail: res.mensaje });
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.mensajeError(err, 'No se pudo abrir la caja') });
            }
        });
    }

    abrirDialogMovimiento(): void {
        this.movimiento = this.movimientoVacio();
        this.categorias = CATEGORIAS_POR_TIPO[TIPO_MOVIMIENTO.INGRESO];
        this.dialogMovimiento = true;
    }

    onCambioTipo(): void {
        this.categorias = CATEGORIAS_POR_TIPO[this.movimiento.tipo] || [];
        this.movimiento.categoria = '';
    }

    guardarMovimiento(): void {
        if (!this.caja) {
            return;
        }
        if (!this.movimiento.tipo || !this.movimiento.categoria || !this.movimiento.concepto?.trim() || !this.movimiento.monto || this.movimiento.monto <= 0 || !this.movimiento.metodo_pago) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Completa tipo, categoría, concepto, monto y método de pago' });
            return;
        }
        this.guardando = true;
        this.cajaService.crearMovimiento(this.caja.id, {
            ...this.movimiento,
            concepto: this.movimiento.concepto.trim()
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogMovimiento = false;
                this.messageService.add({ severity: 'success', summary: 'Movimiento', detail: res.mensaje });
                this.cargar();
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.mensajeError(err, 'No se pudo registrar el movimiento') });
            }
        });
    }

    abrirDialogCierre(): void {
        if (!this.caja) {
            return;
        }
        this.saldoContado = this.caja.saldo_esperado;
        this.observacionCierre = '';
        this.dialogCierre = true;
    }

    get diferenciaCierre(): number {
        if (!this.caja) {
            return 0;
        }
        return Math.round(((this.saldoContado || 0) - this.caja.saldo_esperado) * 100) / 100;
    }

    get etiquetaArqueo(): string {
        if (this.diferenciaCierre === 0) {
            return 'CUADRE CORRECTO';
        }
        return this.diferenciaCierre < 0 ? 'FALTANTE' : 'SOBRANTE';
    }

    get severidadArqueo(): 'success' | 'danger' | 'warn' {
        if (this.diferenciaCierre === 0) {
            return 'success';
        }
        return this.diferenciaCierre < 0 ? 'danger' : 'warn';
    }

    cerrarCaja(): void {
        if (!this.caja) {
            return;
        }
        if (this.saldoContado == null || this.saldoContado < 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El saldo contado no puede ser negativo' });
            return;
        }
        this.guardando = true;
        this.cajaService.cerrar(this.caja.id, {
            saldo_contado: this.saldoContado,
            observacion: this.observacionCierre || undefined
        }).subscribe({
            next: (res) => {
                this.guardando = false;
                this.dialogCierre = false;
                this.messageService.add({ severity: 'success', summary: 'Caja cerrada', detail: res.mensaje });
                this.router.navigateByUrl(APP_ROUTES.cajaHistorial);
            },
            error: (err) => {
                this.guardando = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: this.mensajeError(err, 'No se pudo cerrar la caja') });
            }
        });
    }

    private movimientoVacio(): CrearMovimientoRequest {
        return {
            tipo: TIPO_MOVIMIENTO.INGRESO,
            categoria: '',
            concepto: '',
            monto: 0,
            metodo_pago: '',
            referencia: '',
            observacion: ''
        };
    }

    private obtenerUsername(): string {
        return this.authService.getUser()?.username || 'Usuario';
    }

    private mensajeError(err: HttpErrorResponse, fallback: string): string {
        return err?.error?.mensaje || err?.error?.msg || fallback;
    }
}
