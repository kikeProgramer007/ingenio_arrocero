import { CommonModule } from '@angular/common';
import { Component, EventEmitter, forwardRef, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { METODO_PAGO } from '../../pages/caja/caja.constants';
import { formatBs, toMoney } from '../utils/money';

const OPCIONES = [
    { label: 'QR', value: METODO_PAGO.QR, icono: 'pi pi-qrcode' },
    { label: 'Efectivo', value: METODO_PAGO.EFECTIVO, icono: 'pi pi-wallet' },
    { label: 'Mixto', value: METODO_PAGO.MIXTO, icono: 'pi pi-th-large' }
];

@Component({
    selector: 'app-metodo-pago',
    standalone: true,
    imports: [CommonModule, FormsModule, InputNumberModule],
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
        <div class="metodo-pago-mixto" *ngIf="valor === 'MIXTO'">
            <p class="metodo-pago-ayuda">Indique cuánto entra en QR (banco) y cuánto en efectivo (cajón). La suma debe ser el total.</p>
            <div class="metodo-pago-montos">
                <div>
                    <label>QR / banco</label>
                    <p-inputNumber
                        [ngModel]="montoQr"
                        (ngModelChange)="cambiarQr($event)"
                        mode="decimal"
                        [min]="0"
                        [minFractionDigits]="2"
                        prefix="Bs "
                        [disabled]="deshabilitado"
                        fluid
                    />
                </div>
                <div>
                    <label>Efectivo</label>
                    <p-inputNumber
                        [ngModel]="montoEfectivo"
                        (ngModelChange)="cambiarEfectivo($event)"
                        mode="decimal"
                        [min]="0"
                        [minFractionDigits]="2"
                        prefix="Bs "
                        [disabled]="deshabilitado"
                        fluid
                    />
                </div>
            </div>
            <div class="metodo-pago-suma" [class.metodo-pago-suma-ok]="sumaCuadra" [class.metodo-pago-suma-error]="!sumaCuadra">
                Suma: {{ formatBs(suma) }}
                <span *ngIf="montoTotal > 0"> / total {{ formatBs(montoTotal) }}</span>
            </div>
        </div>
    `,
    styles: [`
        .metodo-pago-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.65rem;
        }
        .metodo-pago-card {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            min-height: 5.25rem;
            padding: 0.85rem 0.4rem 0.7rem;
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
            font-size: 1.45rem;
            color: var(--text-color-secondary);
        }
        .metodo-pago-card-activo .metodo-pago-icono,
        .metodo-pago-card-activo .metodo-pago-texto {
            color: var(--primary-color);
        }
        .metodo-pago-texto {
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .metodo-pago-mixto {
            margin-top: 0.85rem;
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
        }
        .metodo-pago-ayuda {
            margin: 0;
            font-size: 0.8rem;
            color: var(--text-color-secondary);
        }
        .metodo-pago-montos {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.65rem;
        }
        .metodo-pago-montos label {
            display: block;
            font-weight: 700;
            font-size: 0.8rem;
            margin-bottom: 0.35rem;
        }
        .metodo-pago-suma {
            font-size: 0.8rem;
            font-weight: 600;
        }
        .metodo-pago-suma-ok { color: var(--green-600, #16a34a); }
        .metodo-pago-suma-error { color: var(--red-500, #ef4444); }
        @media (max-width: 520px) {
            .metodo-pago-grid,
            .metodo-pago-montos {
                grid-template-columns: 1fr;
            }
        }
    `]
})
export class MetodoPagoComponent implements ControlValueAccessor, OnChanges {
    @Input() ariaLabel = 'Forma de pago';
    @Input() montoTotal = 0;
    @Input() montoEfectivo = 0;
    @Input() montoQr = 0;
    @Output() montoEfectivoChange = new EventEmitter<number>();
    @Output() montoQrChange = new EventEmitter<number>();

    opciones = OPCIONES;
    valor = '';
    deshabilitado = false;
    formatBs = formatBs;

    private onChange: (value: string) => void = () => undefined;
    private onTouched: () => void = () => undefined;

    get suma(): number {
        return toMoney(this.montoEfectivo + this.montoQr);
    }

    get sumaCuadra(): boolean {
        if (this.montoTotal <= 0) {
            return this.montoEfectivo > 0 && this.montoQr > 0;
        }
        return this.suma === toMoney(this.montoTotal) && this.montoEfectivo > 0 && this.montoQr > 0;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['montoTotal'] && this.valor === METODO_PAGO.MIXTO && !changes['montoTotal'].firstChange) {
            this.cambiarEfectivo(this.montoEfectivo);
        }
    }

    elegir(value: string): void {
        if (this.deshabilitado) {
            return;
        }
        this.valor = value;
        this.onChange(value);
        this.onTouched();
        if (value === METODO_PAGO.EFECTIVO) {
            this.emitir(toMoney(this.montoTotal), 0);
        } else if (value === METODO_PAGO.QR) {
            this.emitir(0, toMoney(this.montoTotal));
        } else if (value === METODO_PAGO.MIXTO && this.montoEfectivo <= 0 && this.montoQr <= 0) {
            this.emitir(0, 0);
        }
    }

    cambiarEfectivo(value: number): void {
        const efectivo = toMoney(value);
        const qr = toMoney(Math.max(0, toMoney(this.montoTotal) - efectivo));
        this.emitir(efectivo, qr);
    }

    cambiarQr(value: number): void {
        const qr = toMoney(value);
        const efectivo = toMoney(Math.max(0, toMoney(this.montoTotal) - qr));
        this.emitir(efectivo, qr);
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

    private emitir(efectivo: number, qr: number): void {
        this.montoEfectivo = efectivo;
        this.montoQr = qr;
        this.montoEfectivoChange.emit(efectivo);
        this.montoQrChange.emit(qr);
    }
}
