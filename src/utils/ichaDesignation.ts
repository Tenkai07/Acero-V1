import { ICHA_PROFILES } from '../data/ichaProfiles';
import { IchaProfile } from '../types';

/**
 * Conversión entre las dos formas de nombrar un mismo perfil ICHA.
 *
 * El problema real que resuelve: los planos y los listados de materiales
 * vienen en designación tradicional ("C 25x17.9", donde 17.9 es el peso en
 * kgf/m), pero bodega, la orden de compra y el proveedor hablan en medidas
 * ("C 250x75x6"). Son el MISMO perfil, y sin traducir uno al otro la
 * cubicación no calza con el inventario y termina comprando material que
 * ya estaba en bodega.
 */

/**
 * Normaliza un código de perfil para comparar: minúsculas, sin espacios,
 * comas decimales a punto, y cualquier separador (x, X, ×, *) unificado.
 * Así "C 25 x 17,9", "c25X17.9" y "C25*17.9" son la misma llave.
 */
export function normalizeDesignation(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, '')
    .trim();
}

/** Índice construido una sola vez: cada forma conocida apunta a su perfil. */
const designationIndex: Map<string, IchaProfile> = (() => {
  const index = new Map<string, IchaProfile>();
  ICHA_PROFILES.forEach((profile) => {
    // El primero gana: si dos perfiles comparten una forma normalizada
    // (puede pasar entre manuales), se conserva el del manual Tradicional,
    // que va primero en el catálogo y es el de uso corriente.
    [profile.name, profile.mm].forEach((form) => {
      const key = normalizeDesignation(form);
      if (!index.has(key)) index.set(key, profile);
    });
  });
  return index;
})();

/**
 * Busca un perfil ICHA por cualquiera de sus dos designaciones. Devuelve
 * undefined si el código no corresponde a un perfil del catálogo (ej. un
 * tubular RHS comercial, que no es ICHA).
 */
export function findIchaProfile(designation: string): IchaProfile | undefined {
  return designationIndex.get(normalizeDesignation(designation));
}

/**
 * Traduce una designación a su forma equivalente: de tradicional a medidas
 * o al revés. Si el código no está en el catálogo ICHA, devuelve undefined
 * — no inventa una conversión.
 */
export function convertIchaDesignation(designation: string): string | undefined {
  const profile = findIchaProfile(designation);
  if (!profile) return undefined;
  const normalized = normalizeDesignation(designation);
  return normalized === normalizeDesignation(profile.name) ? profile.mm : profile.name;
}

/**
 * Forma canónica para agrupar/comparar perfiles: siempre la designación por
 * MEDIDAS, que es la que usa bodega y la orden de compra.
 *
 * Pensado para el parser de BOM y el cotejo con inventario: si el listado
 * trae "C 25x17.9" y bodega tiene "C 250x75x6", ambos colapsan a la misma
 * llave y el material se reconoce como disponible en vez de comprarse de
 * nuevo. Un código que no es ICHA se devuelve tal cual, sin tocar.
 */
export function canonicalIchaCode(designation: string): string {
  const profile = findIchaProfile(designation);
  return profile ? profile.mm : designation;
}

/**
 * Sugerencias para el buscador del catálogo: acepta parte del nombre, de
 * las medidas o dígitos sueltos ("25x17" encuentra "C 25x17.9").
 */
export function searchIchaProfiles(query: string, limit: number = 12): IchaProfile[] {
  const q = normalizeDesignation(query);
  if (!q) return [];
  return ICHA_PROFILES.filter(
    (p) => normalizeDesignation(p.name).includes(q) || normalizeDesignation(p.mm).includes(q)
  ).slice(0, limit);
}
