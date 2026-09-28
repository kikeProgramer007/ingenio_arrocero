import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/** Rojo vino del logotipo Royal, sin saturar fondos. */
export const ROYAL_PRIMARY_PALETTE = {
    50: '#fdf6f5',
    100: '#f9e8e6',
    200: '#f0cdc9',
    300: '#e3a39d',
    400: '#cc6b64',
    500: '#a51c24',
    600: '#8e181f',
    700: '#741419',
    800: '#5c1115',
    900: '#4a1013',
    950: '#2a0709'
};

export const RoyalAura = definePreset(Aura, {
    semantic: {
        primary: ROYAL_PRIMARY_PALETTE
    }
});
