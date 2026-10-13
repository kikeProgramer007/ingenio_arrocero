import { NgIf } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export type TipoInputNumero = 'moneda' | 'cantidad';

@Component({
    selector: 'app-input-numero',
    standalone: true,
    imports: [NgIf, ButtonModule, InputTextModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputNumeroComponent),
            multi: true
        }
    ],
    host: { class: 'block w-full' },
    template: `
        <div class="input-numero">
            <span class="input-numero-prefijo" *ngIf="textoPrefijo">{{ textoPrefijo }}</span>
            <p-button
                *ngIf="tipo === 'cantidad' && !stepperVertical"
                type="button"
                icon="pi pi-minus"
                [outlined]="true"
                size="small"
                [disabled]="deshabilitado || !puedeRestar"
                ariaLabel="Restar"
                (mousedown)="$event.preventDefault()"
                (onClick)="restar()"
            />
            <input
                #campo
                pInputText
                class="w-full"
                [class.text-center]="tipo === 'cantidad'"
                [class.input-con-stepper-vertical]="stepperVertical"
                [placeholder]="textoVacio"
                [disabled]="deshabilitado"
                inputmode="decimal"
                autocomplete="off"
                (focus)="alFoco($event)"
                (mouseup)="alMouseUp($event)"
                (beforeinput)="alAntes($event)"
                (input)="alEscribir($event)"
                (blur)="alSalir()"
            />
            <p-button
                *ngIf="tipo === 'cantidad' && !stepperVertical"
                type="button"
                icon="pi pi-plus"
                [outlined]="true"
                severity="success"
                size="small"
                [disabled]="deshabilitado"
                ariaLabel="Sumar"
                (mousedown)="$event.preventDefault()"
                (onClick)="sumar()"
            />
            <span class="stepper-vertical" *ngIf="tipo === 'cantidad' && stepperVertical">
                <p-button type="button" icon="pi pi-chevron-up" [text]="true" size="small" ariaLabel="Sumar" [disabled]="deshabilitado" (mousedown)="$event.preventDefault()" (onClick)="sumar()" />
                <p-button type="button" icon="pi pi-chevron-down" [text]="true" size="small" ariaLabel="Restar" [disabled]="deshabilitado || !puedeRestar" (mousedown)="$event.preventDefault()" (onClick)="restar()" />
            </span>
        </div>
    `,
    styles: [`
        .input-numero {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            width: 100%;
            min-width: 0;
        }
        .input-numero input {
            min-width: 0;
            flex: 1 1 auto;
        }
        :host-context(.tc-input-unido) .input-numero input {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            outline: none;
        }
        .input-numero-prefijo {
            flex-shrink: 0;
            color: var(--p-text-muted-color, var(--text-color-secondary));
            font-weight: 600;
        }
        .text-center {
            text-align: center;
        }
        .stepper-vertical {
            display:flex;
            flex:0 0 2.5rem;
            flex-direction:column;
            align-self:stretch;
            justify-content:center;
            border-left:1px solid var(--p-form-field-border-color,var(--p-content-border-color));
        }
        .stepper-vertical p-button { height:50%; }
        .stepper-vertical ::ng-deep .p-button { width:100%; height:100%; padding:0; border-radius:0; }
        :host-context(.input-stepper-vertical) .input-numero { gap:0; border:1px solid var(--p-form-field-border-color,var(--p-content-border-color)); border-radius:var(--p-form-field-border-radius,6px); overflow:hidden; }
        :host-context(.input-stepper-vertical) .input-numero input { border:0 !important; border-radius:0 !important; box-shadow:none !important; padding-inline:.65rem; text-align:left; }
    `]
})
export class InputNumeroComponent implements ControlValueAccessor, AfterViewInit {
    @ViewChild('campo') campo?: ElementRef<HTMLInputElement>;

    @Input() tipo: TipoInputNumero = 'moneda';
    @Input() stepperVertical = false;
    @Input() prefijo?: string;
    @Input() min?: number;
    @Input() step = 1;
    @Input() minFractionDigits?: number;
    @Input() maxFractionDigits?: number;
    @Input() placeholder = '';
    @Input()
    set disabled(value: boolean) {
        this.deshabilitado = !!value;
    }

    deshabilitado = false;

    private valor: number | null = null;
    private enfocado = false;
    private recienFoco = false;
    private seleccionarAlSoltar = false;
    private onChange: (value: number | null) => void = () => undefined;
    private onTouched: () => void = () => undefined;

    get minimo(): number | undefined {
        if (this.min !== undefined) {
            return this.min;
        }
        return this.tipo === 'moneda' ? 0 : undefined;
    }

    get minFraccion(): number {
        return this.minFractionDigits ?? (this.tipo === 'moneda' ? 2 : 0);
    }

    get maxFraccion(): number {
        return this.maxFractionDigits ?? (this.tipo === 'moneda' ? 2 : 3);
    }

    get textoPrefijo(): string {
        if (this.prefijo !== undefined) {
            return this.prefijo;
        }
        return this.tipo === 'moneda' ? 'Bs' : '';
    }

    get textoVacio(): string {
        return this.placeholder || (this.tipo === 'moneda' ? '0,00' : '0');
    }

    get puedeRestar(): boolean {
        if (this.deshabilitado) {
            return false;
        }
        const actual = this.valorActual();
        return this.minimo === undefined || actual > this.minimo;
    }

    ngAfterViewInit(): void {
        this.pintar();
    }

    restar(): void {
        this.ajustar(-this.paso());
    }

    sumar(): void {
        this.ajustar(this.paso());
    }

    alFoco(evento: FocusEvent): void {
        this.enfocado = true;
        this.recienFoco = true;
        this.seleccionarAlSoltar = true;
        const input = evento.target as HTMLInputElement;
        setTimeout(() => input.select(), 0);
    }

    alMouseUp(evento: MouseEvent): void {
        if (!this.seleccionarAlSoltar) {
            return;
        }
        evento.preventDefault();
        (evento.target as HTMLInputElement).select();
        this.seleccionarAlSoltar = false;
    }

    alAntes(evento: InputEvent): void {
        if (evento.inputType !== 'insertText' && evento.inputType !== 'insertFromPaste') {
            return;
        }
        const input = evento.target as HTMLInputElement;
        const dato = evento.data ?? '';
        if (!/\d/.test(dato) || !this.esCeroFormateado(input.value)) {
            return;
        }
        evento.preventDefault();
        input.value = dato.replace(/[^\d,.\-]/g, '');
        this.valor = this.parsear(input.value);
        this.onChange(this.valor);
        this.recienFoco = false;
    }

    alEscribir(evento: Event): void {
        const input = evento.target as HTMLInputElement;
        const pegado = input.value.match(/^0[,.]0+(\d+)$/);
        if ((this.valor === 0 || this.valor === null) && pegado) {
            input.value = pegado[1];
            this.valor = this.parsear(pegado[1]);
            this.onChange(this.valor);
            this.recienFoco = false;
            return;
        }
        this.recienFoco = false;
        this.valor = this.parsear(input.value);
        this.onChange(this.valor);
    }

    alSalir(): void {
        this.enfocado = false;
        this.recienFoco = false;
        this.seleccionarAlSoltar = false;
        this.valor = this.limitar(this.valor);
        this.pintar();
        this.onChange(this.valor);
        this.onTouched();
    }

    writeValue(value: number | null): void {
        this.valor = value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value);
        if (!this.enfocado) {
            this.pintar();
        }
    }

    registerOnChange(fn: (value: number | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.deshabilitado = isDisabled;
    }

    private paso(): number {
        return this.step > 0 ? this.step : 1;
    }

    private valorActual(): number {
        if (this.campo && this.enfocado) {
            return this.parsear(this.campo.nativeElement.value) ?? 0;
        }
        return this.valor ?? 0;
    }

    private ajustar(delta: number): void {
        this.valor = this.limitar(this.valorActual() + delta);
        this.pintar();
        this.onChange(this.valor);
        this.onTouched();
    }

    private pintar(): void {
        if (!this.campo) {
            return;
        }
        this.campo.nativeElement.value = this.formatear(this.valor);
    }

    private limitar(value: number | null): number | null {
        if (value === null) {
            return null;
        }
        const min = this.minimo;
        if (min !== undefined && value < min) {
            return min;
        }
        const factor = 10 ** this.maxFraccion;
        return Math.round(value * factor) / factor;
    }

    private formatear(value: number | null): string {
        if (value === null) {
            return '';
        }
        return value.toLocaleString('es-BO', {
            minimumFractionDigits: this.minFraccion,
            maximumFractionDigits: this.maxFraccion
        });
    }

    private esCeroFormateado(texto: string): boolean {
        const t = texto.trim();
        return t === '' || t === '0' || /^0[,.]0+$/.test(t);
    }

    private parsear(raw: string): number | null {
        const t = raw.trim();
        if (!t || t === '-' || t === ',' || t === '.') {
            return null;
        }
        const permiteNegativo = this.minimo === undefined || this.minimo < 0;
        const limpio = t.replace(permiteNegativo ? /[^\d,.\-]/g : /[^\d,.]/g, '');
        const lastComma = limpio.lastIndexOf(',');
        const lastDot = limpio.lastIndexOf('.');
        let normalizado = limpio;
        if (lastComma >= 0 && lastDot >= 0) {
            normalizado = lastComma > lastDot
                ? limpio.replace(/\./g, '').replace(',', '.')
                : limpio.replace(/,/g, '');
        } else if (lastComma >= 0) {
            normalizado = limpio.replace(',', '.');
        }
        const n = Number(normalizado);
        return Number.isFinite(n) ? n : null;
    }
}
