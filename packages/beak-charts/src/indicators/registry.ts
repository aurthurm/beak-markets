import type { IndicatorDefinition } from './types.ts';
import { builtinIndicators } from './builtin/index.ts';
import vwap from './custom/vwap.ts';

const registeredIndicators: IndicatorDefinition[] = [
    ...builtinIndicators,
    vwap
];

/**
 * Register a new custom indicator dynamically from the consumer application.
 */
export function registerIndicator(indicator: IndicatorDefinition): void {
    if (!registeredIndicators.find(i => i.id === indicator.id)) {
        registeredIndicators.push(indicator);
    }
}

/**
 * Returns all available indicators (built-in + explicitly registered).
 */
export function getAllIndicators(): IndicatorDefinition[] {
    return registeredIndicators;
}

/**
 * Get an indicator by its id.
 */
export function getIndicator(id: string): IndicatorDefinition | undefined {
    return registeredIndicators.find((indicator) => indicator.id === id);
}

/**
 * Helper to be called by consumer to ensure loading completes if they do async registering
 */
export async function loadCustomIndicators(): Promise<void> {
    // If the consumer uses dynamic imports, they can await them here or before calling registerIndicator.
    // For native beak-charts indicators, they are already statically loaded.
    return Promise.resolve();
}
