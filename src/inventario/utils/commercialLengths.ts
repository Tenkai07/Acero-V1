import { MaterialCategory } from '../types';

/**
 * Un tubo CUADRADO se escribe de dos formas equivalentes en las planillas:
 * "RHS150X6" y "RHS150X150X6" son exactamente el mismo perfil (150×150,
 * espesor 6). Si quedan como dos perfiles distintos, el anidado nunca
 * combina sus piezas entre sí y se compra material de más — en el proyecto
 * real P420 esa separación costaba ~144m de acero.
 *
 * Devuelve la forma corta canónica para poder agruparlos. Solo colapsa
 * cuando las dos primeras medidas son IGUALES: "RHS200X100X4" es un tubo
 * rectangular de verdad y se deja tal cual.
 */
export function canonicalProfileCode(profileCode: string): string {
  const code = (profileCode || '').trim().toUpperCase();
  const squareTube = /^(RHS|SHS)(\d+)X(\d+)X(\d+)$/.exec(code);
  if (squareTube && squareTube[2] === squareTube[3]) {
    return `${squareTube[1]}${squareTube[2]}X${squareTube[4]}`;
  }
  return code;
}

/**
 * Infiere qué largos comerciales adicionales (además de 6000mm, que siempre
 * está disponible) es razonable ofrecer para un perfil, según reglas de
 * negocio confirmadas por el usuario:
 *  - Tubulares RHS/SHS (cuadrados y rectangulares): siempre hay de 6m Y 12m.
 *  - Ángulos: normalmente solo 6m.
 *  - Cualquier perfil de espesor ≥8mm: también suele conseguirse de 12m
 *    (esto es lo que hace que un ángulo grueso también sume la opción de
 *    12m, aunque los ángulos delgados se queden solo en 6m).
 *
 * Es un DEFAULT razonable, no una verdad absoluta — el campo manual
 * "Largo Comercial Alternativo" en la ficha del material (MaterialStockItem.
 * alternateBarLengthsMm) siempre tiene prioridad si el usuario lo definió.
 */
export function inferAlternateBarLengths(profileCode: string, category?: MaterialCategory): number[] | undefined {
  const code = (profileCode || '').trim().toUpperCase();
  if (!code) return undefined;

  // OJO: sin "\b" después del prefijo — RHS/SHS siempre van pegados a un
  // número ("RHS150X5"), y \b no marca límite entre letra y dígito porque
  // ambos son caracteres de palabra (\w), así que "RHS\b" nunca matchea.
  const isTubular =
    category === 'tubular_cuadrado' ||
    category === 'tubular_rectangular' ||
    /^(RHS|SHS)/.test(code);

  if (isTubular) return [12000];

  const isAngulo = category === 'angulo_l' || /^L\d/.test(code);

  // Espesor: se toma como el último número del código (convención habitual
  // Chile: HxTx..., ej. "L50X8" -> 8, "RHS150X5" -> 5). Se exige que el
  // código traiga AL MENOS 2 números (alto/ancho + espesor) para considerar
  // el último como espesor real — con un solo número (ej. "D16", diámetro
  // de una barra redonda) no hay espesor de pared que inferir, y tratar ese
  // número como espesor dispararía falsos positivos.
  const numbers = code.match(/\d+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(',', '.'))) || [];
  const thicknessMm = numbers.length >= 2 ? numbers[numbers.length - 1] : null;

  if (isAngulo) {
    return thicknessMm !== null && thicknessMm >= 8 ? [12000] : undefined;
  }

  // Regla general para el resto de perfiles (canales, vigas, planas, etc.):
  // espesor >=8mm también suele venir en 12m.
  if (thicknessMm !== null && thicknessMm >= 8) return [12000];

  return undefined;
}

/**
 * Pérdida de saneamiento de la máquina al preparar un empalme, POR PIEZA —
 * varía según el tipo de perfil, no es un número único para todos:
 *  - Ángulos: 90mm por pieza (la máquina sanea la tira completa del ángulo).
 *  - Cualquier otro perfil (RHS/SHS tubulares, canales, vigas, etc.): ~5mm
 *    por corte, muchísimo menor que en un ángulo.
 */
export function getSpliceFacingLossMm(profileCode: string, category?: MaterialCategory, fallbackMm: number = 5): number {
  const code = (profileCode || '').trim().toUpperCase();
  const isAngulo = category === 'angulo_l' || /^L\d/.test(code);
  return isAngulo ? 90 : fallbackMm;
}
