import { MaterialStockItem, OffcutItem } from '../types';

/**
 * Suma de barras/planchas/unidades reservadas manualmente para otros
 * proyectos (StockReservation.quantity), sin contar retazos individuales
 * reservados (esos se filtran aparte vía offcut.reservedForProject).
 */
export function getReservedBarsCount(material: MaterialStockItem): number {
  if (!material.reservations || material.reservations.length === 0) return 0;
  return material.reservations.reduce((sum, r) => sum + Math.max(0, r.quantity), 0);
}

/**
 * Barras/planchas/unidades realmente disponibles para una cubicación nueva:
 * el total físico en bodega menos lo reservado para otros proyectos. Nunca
 * baja de 0 aunque las reservas excedan el stock físico (dato desactualizado).
 */
export function getAvailableBarsCount(material: MaterialStockItem): number {
  return Math.max(0, material.standardBarsCount - getReservedBarsCount(material));
}

/** Retazos libres, es decir sin reservar para otro proyecto. */
export function getAvailableOffcuts(material: MaterialStockItem): OffcutItem[] {
  return material.offcuts.filter((o) => !o.reservedForProject);
}

/** Retazos apartados para algún proyecto (para mostrarlos igual en pantalla, marcados). */
export function getReservedOffcuts(material: MaterialStockItem): OffcutItem[] {
  return material.offcuts.filter((o) => !!o.reservedForProject);
}
