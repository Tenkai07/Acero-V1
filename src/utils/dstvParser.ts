/**
 * Parser de archivos DSTV / NC1 — el formato estándar (norma alemana DSTV)
 * usado por líneas CNC de perfiles estructurales (Peddinghaus, Voortman,
 * Kaltenbach, etc.) para taladro, corte y marcado de perfiles, ángulos,
 * costaneras y planchas.
 *
 * Estructura del archivo (texto plano, bloques separados por palabras clave):
 *   ST ... EN     Cabecera: perfil, calidad, dimensiones, largo, peso/m
 *   BO ... EN     Taladros (Bohrung): cara, posición X/Y, diámetro
 *   AK ... EN     Contorno exterior (Außenkontur)
 *   IK ... EN     Contorno interior / recortes (Innenkontur)
 *   SI ... EN     Marcas / texto de grabado (Signierung)
 *   SC ... EN     Cortes rectos adicionales
 */

export type DstvFace = "v" | "o" | "u" | "h"; // v=alma(web/vorderseite), o=ala sup, u=ala inf, h=parte trasera

export interface DstvHole {
  face: DstvFace;
  x: number; // mm a lo largo del perfil, desde el extremo inicial
  y: number; // mm a través de la cara (ancho/alto local)
  diameterMm: number;
}

export interface DstvContourPoint {
  x: number;
  y: number;
  isRadius?: boolean;
}

export interface DstvContour {
  face: DstvFace;
  points: DstvContourPoint[];
}

export interface DstvMarking {
  face: DstvFace;
  x: number;
  y: number;
  text: string;
}

export interface DstvPiece {
  orderId?: string;
  pieceId?: string;
  profileCode: string; // ej. "IPE200", "L50X50X5", "RHS100X50X4"
  profileType: string; // clasificación cruda de DSTV (I, L, U, M, C, RU, RO, ...)
  grade: string;
  quantity: number;
  lengthMm: number;
  heightMm: number; // h del perfil
  widthMm: number; // b del perfil
  webThicknessMm: number; // tw
  flangeThicknessMm: number; // tf
  weightPerMeterKg: number;
  holes: DstvHole[];
  outerContours: DstvContour[];
  innerContours: DstvContour[];
  markings: DstvMarking[];
  rawUnknownBlocks: string[];
}

function parseNum(token: string | undefined): number {
  if (!token) return 0;
  const n = parseFloat(token.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

/**
 * Parsea el contenido completo de un archivo .nc1/.nc/.dstv en un DstvPiece.
 */
export function parseDstvFile(content: string): DstvPiece {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.replace(/\*.*$/, "").trim()) // quita comentarios tras '*'
    .filter((l) => l.length > 0);

  const piece: DstvPiece = {
    profileCode: "",
    profileType: "",
    grade: "A36",
    quantity: 1,
    lengthMm: 0,
    heightMm: 0,
    widthMm: 0,
    webThicknessMm: 0,
    flangeThicknessMm: 0,
    weightPerMeterKg: 0,
    holes: [],
    outerContours: [],
    innerContours: [],
    markings: [],
    rawUnknownBlocks: []
  };

  let i = 0;

  // La primera línea suele ser "ST" solo (marca de inicio de programa)
  while (i < lines.length) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper === "ST") {
      i++;
      // Bloque de cabecera: cada línea siguiente es un campo, hasta "EN"
      const headerLines: string[] = [];
      while (i < lines.length && lines[i].toUpperCase() !== "EN") {
        headerLines.push(lines[i]);
        i++;
      }
      i++; // saltar EN
      applyHeaderFields(piece, headerLines);
      continue;
    }

    if (upper === "BO") {
      i++;
      while (i < lines.length && lines[i].toUpperCase() !== "EN") {
        const t = tokenize(lines[i]);
        // Formato típico: <cara> <x> <y> <diametro> [...]
        if (t.length >= 4) {
          piece.holes.push({
            face: (t[0].toLowerCase() as DstvFace) || "v",
            x: parseNum(t[1]),
            y: parseNum(t[2]),
            diameterMm: parseNum(t[3])
          });
        }
        i++;
      }
      i++;
      continue;
    }

    if (upper === "AK" || upper === "IK") {
      i++;
      let currentFace: DstvFace = "v";
      const points: DstvContourPoint[] = [];
      while (i < lines.length && lines[i].toUpperCase() !== "EN") {
        const t = tokenize(lines[i]);
        if (t.length >= 3) {
          currentFace = (t[0].toLowerCase() as DstvFace) || currentFace;
          points.push({
            x: parseNum(t[1]),
            y: parseNum(t[2]),
            isRadius: t.length > 3 && /r/i.test(t[3])
          });
        }
        i++;
      }
      i++;
      const contour: DstvContour = { face: currentFace, points };
      if (upper === "AK") piece.outerContours.push(contour);
      else piece.innerContours.push(contour);
      continue;
    }

    if (upper === "SI") {
      i++;
      while (i < lines.length && lines[i].toUpperCase() !== "EN") {
        const t = tokenize(lines[i]);
        if (t.length >= 4) {
          piece.markings.push({
            face: (t[0].toLowerCase() as DstvFace) || "v",
            x: parseNum(t[1]),
            y: parseNum(t[2]),
            text: t.slice(3).join(" ")
          });
        }
        i++;
      }
      i++;
      continue;
    }

    // Bloques que reconocemos pero no procesamos en detalle todavía
    if (/^(SC|KO|PU|KA|TE)$/.test(upper)) {
      const blockLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].toUpperCase() !== "EN") {
        blockLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      piece.rawUnknownBlocks.push(blockLines.join(" | "));
      continue;
    }

    if (upper === "EN" || upper.length === 0) {
      i++;
      continue;
    }

    // Línea no reconocida: avanzar para no quedar en loop infinito
    i++;
  }

  return piece;
}

const KNOWN_PROFILE_TYPE_CODES = new Set([
  "I", "U", "L", "B", "C", "M", "T", "RU", "RO", "CC", "CW", "SO"
]);

function applyHeaderFields(piece: DstvPiece, headerLines: string[]) {
  // El orden de campos del bloque ST varía según el software CAM que generó
  // el archivo. En vez de asumir posiciones fijas, se busca la línea que
  // corresponde al "código de tipo de perfil" (I, U, L, B, C, M, T, RU, RO...)
  // — ese código sirve de ancla: lo que viene justo antes son los
  // identificadores/calidad/cantidad, y lo que viene después son las
  // dimensiones numéricas (largo, alto, ancho, espesores, radio, peso/m).
  const anchorIdx = headerLines.findIndex((l) => KNOWN_PROFILE_TYPE_CODES.has(l.trim().toUpperCase()));

  if (anchorIdx >= 1) {
    piece.profileType = headerLines[anchorIdx].trim().toUpperCase();
    piece.profileCode = headerLines[anchorIdx - 1]?.trim() || "PERFIL";

    // Busca cantidad (entero pequeño) y calidad (texto con letras) entre las
    // líneas previas al perfil.
    const preLines = headerLines.slice(0, anchorIdx - 1);
    const qtyLine = [...preLines].reverse().find((l) => /^\d{1,4}$/.test(l.trim()));
    piece.quantity = qtyLine ? Math.max(1, parseInt(qtyLine, 10)) : 1;
    const gradeLine = [...preLines].reverse().find((l) => /[A-Za-z]/.test(l) && !/^\d/.test(l.trim()));
    piece.grade = gradeLine?.trim() || "A36";
    piece.orderId = preLines[0]?.trim() || undefined;
    const pieceIdLine = preLines.find((l) => /^[A-Za-z]{1,4}[-]?\d+$/.test(l.trim()));
    piece.pieceId = pieceIdLine?.trim() || undefined;

    const dims = headerLines.slice(anchorIdx + 1).map(parseNum);
    piece.lengthMm = dims[0] || 0;
    piece.heightMm = dims[1] || 0;
    piece.widthMm = dims[2] || 0;
    piece.webThicknessMm = dims[3] || 0;
    piece.flangeThicknessMm = dims[4] || 0;
    piece.weightPerMeterKg = dims[6] || 0;
    return;
  }

  // Fallback: si no se encontró un código de tipo reconocible, se usa el
  // orden posicional estándar más común (Auftrag, Dibujo, Fase, Pieza,
  // Calidad, Cantidad, Perfil, Tipo, Largo, Alto, Ancho, tw, tf, Radio, Peso/m).
  const get = (idx: number) => (headerLines[idx] || "").trim();
  piece.orderId = get(0) || undefined;
  piece.pieceId = get(3) || undefined;
  piece.grade = get(4) || "A36";
  piece.quantity = Math.max(1, Math.round(parseNum(get(5))) || 1);
  piece.profileCode = get(6) || "PERFIL";
  piece.profileType = get(7) || "";

  const dims = headerLines.slice(8).map(parseNum);
  piece.lengthMm = dims[0] || 0;
  piece.heightMm = dims[1] || 0;
  piece.widthMm = dims[2] || 0;
  piece.webThicknessMm = dims[3] || 0;
  piece.flangeThicknessMm = dims[4] || 0;
  piece.weightPerMeterKg = dims[6] || 0;
}

/** Detecta si un archivo (por nombre o contenido) parece ser DSTV/NC1 */
export function looksLikeDstv(filename: string, content: string): boolean {
  if (/\.(nc1|nc|dstv)$/i.test(filename)) return true;
  const head = content.slice(0, 200).toUpperCase();
  return head.includes("ST") && /\bEN\b/.test(content.toUpperCase());
}
