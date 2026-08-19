import { ProfileDefinition } from "../types";
import { STANDARD_CHILEAN_PROFILES } from "../data/chileanSteelData";

export interface ProfileDimensionQuery {
  h?: number;  // Alto / Peralte (largo del perfil visto en sección)
  b?: number;  // Ancho de ala
  tw?: number; // Espesor de alma
  tf?: number; // Espesor de ala
}

export interface ProfileMatch {
  profile: ProfileDefinition;
  deviationPercent: number; // 0 = coincidencia perfecta
  matchedFields: number; // cuántos de los campos ingresados se pudieron comparar
}

/**
 * Compara las medidas ingresadas por el usuario contra el catálogo completo
 * de perfiles y devuelve los más parecidos, ordenados de mayor a menor
 * coincidencia. Solo compara los campos (h, b, tw, tf) que el usuario
 * realmente ingresó (mayores a 0) y que el perfil de catálogo también tiene.
 */
export function findMatchingProfiles(
  query: ProfileDimensionQuery,
  maxResults: number = 8
): ProfileMatch[] {
  const activeFields = (["h", "b", "tw", "tf"] as const).filter(
    (k) => query[k] !== undefined && query[k]! > 0
  );

  if (activeFields.length === 0) return [];

  const matches: ProfileMatch[] = [];

  for (const profile of STANDARD_CHILEAN_PROFILES) {
    const dims = profile.dimensions;
    let totalDeviation = 0;
    let comparedFields = 0;

    for (const field of activeFields) {
      const profileValue = dims[field];
      if (profileValue === undefined || profileValue === 0) continue;

      const queryValue = query[field]!;
      const deviation = Math.abs(profileValue - queryValue) / profileValue;
      totalDeviation += deviation;
      comparedFields++;
    }

    // Requiere que al menos la mitad de los campos ingresados existan en este perfil
    if (comparedFields === 0 || comparedFields < Math.ceil(activeFields.length / 2)) continue;

    const avgDeviationPercent = (totalDeviation / comparedFields) * 100;

    // Descarta perfiles claramente distintos (más de 35% de desviación promedio)
    if (avgDeviationPercent > 35) continue;

    matches.push({
      profile,
      deviationPercent: Number(avgDeviationPercent.toFixed(1)),
      matchedFields: comparedFields
    });
  }

  // Ordena por menor desviación, priorizando los que compararon más campos
  matches.sort((a, b) => {
    if (a.matchedFields !== b.matchedFields) return b.matchedFields - a.matchedFields;
    return a.deviationPercent - b.deviationPercent;
  });

  return matches.slice(0, maxResults);
}
