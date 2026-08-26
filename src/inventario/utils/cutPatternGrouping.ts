import { CutBarPlan } from '../types';

export interface CutPatternGroup {
  representative: CutBarPlan;
  barIndices: number[];
  repeatCount: number;
  totalRemainingMm: number;
}

/**
 * Agrupa barras que tienen EXACTAMENTE el mismo patrón de corte (mismo
 * largo de origen, mismo tipo de fuente, y las mismas piezas con las
 * mismas cantidades) en una sola entrada con su cantidad de repeticiones —
 * en vez de mostrar/listar una fila o diagrama idéntico por cada barra
 * física. Es el formato que usan las herramientas de corte especializadas
 * ("layout [1] ×2, layout [2] ×24...") y es mucho más legible que una fila
 * por barra cuando hay cientos de barras repitiendo el mismo patrón.
 */
export function groupBarPlansByPattern(barPlans: CutBarPlan[]): CutPatternGroup[] {
  const groups = new Map<string, CutPatternGroup>();

  barPlans.forEach((plan) => {
    const cutsSignature = [...plan.cuts]
      .map((c) => `${c.lengthMm}|${c.label}`)
      .sort()
      .join(',');
    const key = `${plan.sourceLengthMm}|${plan.sourceType}|${cutsSignature}`;

    const existing = groups.get(key);
    if (existing) {
      existing.repeatCount++;
      existing.barIndices.push(plan.barIndex);
      existing.totalRemainingMm += plan.remainingMm;
    } else {
      groups.set(key, {
        representative: plan,
        barIndices: [plan.barIndex],
        repeatCount: 1,
        totalRemainingMm: plan.remainingMm
      });
    }
  });

  return Array.from(groups.values());
}

/** "#1, #2, #3" si son pocas; "#1, #2, #3... (+12 más)" si son muchas. */
export function formatBarIndices(barIndices: number[], maxShown: number = 4): string {
  if (barIndices.length <= maxShown) {
    return barIndices.map((i) => `#${i}`).join(', ');
  }
  const shown = barIndices.slice(0, maxShown).map((i) => `#${i}`).join(', ');
  return `${shown}... (+${barIndices.length - maxShown} más)`;
}
