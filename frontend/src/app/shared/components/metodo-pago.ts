import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { METODO_PAGO } from '../../pages/caja/caja.constants';

const OPCIONES = [
    { label: 'QR', value: METODO_PAGO.QR, icono: 'pi pi-qrcode' },
    { label: 'Efectivo', value: METODO_PAGO.EFECTIVO, icono: 'pi pi-wallet' },
    { label: 'Transferencia', value: METODO_PAGO.TRANSFERENCIA, icono: 'pi pi-send' },
    { label: 'Otro', value: METODO_PAGO.OTRO, icono: 'pi pi-ellipsis-h' }
];

@Component({
    selector: 'app-metodo-pago',
    standalone: true,
    imports: [CommonModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MetodoPagoComponent),
            multi: true
        }
    ],
    template: `
        <div class="metodo-pago-grid" role="radiogroup" [attr.aria-label]="ariaLabel">
            <button
                type="button"
                class="metodo-pago-card"
                *ngFor="let op of opciones"
                [class.metodo-pago-card-activo]="valor === op.value"
                [disabled]="deshabilitado"
                role="radio"
                [attr.aria-checked]="valor === op.value"
                (click)="elegir(op.value)"
            >
                <span class="metodo-pago-radio" [class.metodo-pago-radio-on]="valor === op.value"></span>
                <i class="metodo-pago-icono" [ngClass]="op.icono"></i>
                <span class="metodo-pago-texto">{{ op.label }}</span>
            </button>
        </div>
    `,
    styles: [`
        .metodo-pago-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.65rem;
        }
        .metodo-pago-card {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            min-height: 5.5rem;
            padding: 0.85rem 0.5rem 0.7rem;
            border: 1px solid var(--surface-border);
            border-radius: 0.75rem;
            background: var(--surface-card);
            color: var(--text-color);
            cursor: pointer;
            transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
        }
        .metodo-pago-card:hover:not(:disabled) {
            border-color: color-mix(in srgb, var(--primary-color) 45%, var(--surface-border));
        }
        .metodo-pago-card-activo {
            border-color: var(--primary-color);
            background: color-mix(in srgb, var(--primary-color) 10%, var(--surface-card));
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 25%, transparent);
        }
        .metodo-pago-card:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }
        .metodo-pago-radio {
            position: absolute;
            top: 0.55rem;
            left: 0.55rem;
            width: 0.9rem;
            height: 0.9rem;
            border-radius: 50%;
            border: 2px solid var(--text-color-secondary);
            background: transparent;
        }
        .metodo-pago-radio-on {
            border-color: var(--primary-color);
            box-shadow: inset 0 0 0 3px var(--surface-card);
            background: var(--primary-color);
        }
        .metodo-pago-icono {
            font-size: 1.55rem;
            color: var(--text-color-secondary);
        }
        .metodo-pago-card-activo .metodo-pago-icono,
        .metodo-pago-card-activo .metodo-pago-texto {
            color: var(--primary-color);
        }
        .metodo-pago-texto {
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
    `]
})
export class MetodoPagoComponent implements ControlValueAccessor {
    @Input() ariaLabel = 'Forma de pago';

    opciones = OPCIONES;
    valor = '';
    deshabilitado = false;

    private onChange: (value: string) => void = () => undefined;
    private onTouched: () => void = () => undefined;

    elegir(value: string): void {
        if (this.deshabilitado) {
            return;
        }
        this.valor = value;
        this.onChange(value);
        this.onTouched();
    }

    writeValue(value: string | null): void {
        this.valor = value || '';
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.deshabilitado = isDisabled;
    }
}
