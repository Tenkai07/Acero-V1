import { DstvPiece, DstvFace } from "./dstvParser";
import { DxfPiece } from "./dxfParser";

export interface CncHole {
  x: number;
  y: number;
  diameterMm: number;
}

// ---------------------------------------------------------------------------
// Clasificación de familia de perfil: determina QUÉ FORMA 3D corresponde
// dibujar. No confiamos únicamente en el código de una letra del bloque ST
// (campo "profileType"), porque varía entre softwares CAM y muchas veces
// viene vacío, mal alineado o con formato distinto. Cruzamos ese código con
// el texto del "profileCode" (ej. "L50X50X5", "HEA200", "RHS100X50X4"),
// que en la práctica es mucho más confiable.
// ---------------------------------------------------------------------------
export type ProfileFamily =
  | "i-beam"
  | "channel"
  | "angle"
  | "tube-rect"
  | "tube-round"
  | "tee"
  | "round-bar"
  | "square-bar"
  | "unknown";

export function isPlateProfile(profileTypeRaw: string, profileCode: string): boolean {
  const type = (profileTypeRaw || "").trim().toUpperCase();
  const code = (profileCode || "").trim().toUpperCase();
  if (type === "B") return true; // "B" = Blech (plancha) en el estándar DSTV
  return /^(PL|PLT|PLATE|PLANCHA|CHAPA|BLECH)\b/.test(code);
}

/**
 * Extrae el espesor de una plancha desde el propio código de perfil, que en
 * Chile suele venir como "PL6*118.5" (espesor*ancho) o "PL10x1200x2400".
 * Es más confiable que los campos numéricos del bloque ST, cuyo orden para
 * planchas varía según el software CAM que generó el archivo.
 */
export function parsePlateThicknessFromCode(profileCode: string): number | null {
  const m = (profileCode || "").match(/PL\.?\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const val = parseFloat(m[1].replace(",", "."));
  return isNaN(val) ? null : val;
}

export function classifyProfileFamily(profileTypeRaw: string, profileCode: string): ProfileFamily {
  const type = (profileTypeRaw || "").trim().toUpperCase();
  const code = (profileCode || "").trim().toUpperCase().replace(/\s+/g, "");

  // Tubo redondo / cañería
  if (type === "RO" || /^(CHS|TUB\.?RED|TUBORED|OD)/.test(code)) return "tube-round";

  // Tubo cuadrado / rectangular
  if (type === "RU" || /^(SHS|RHS|TUB\.?CUAD|TUBCUAD|TUB\.?REC|TUBREC)/.test(code)) return "tube-rect";

  // Ángulo
  if (type === "L" || /^(L\d|ANGULO|ANGLE)/.test(code)) return "angle";

  // Canal / costanera (laminado U o conformado en frío C/Z)
  if (type === "U" || type === "C" || /^(U\d|UPN|UPE|CANAL|COSTANERA|C\d|Z\d)/.test(code)) return "channel";

  // Perfil T
  if (type === "T" || /^T\d/.test(code)) return "tee";

  // Barra redonda maciza
  if (/^(BARRARED|ROUNDBAR|RD\d)/.test(code)) return "round-bar";

  // Barra cuadrada maciza
  if (/^(BARRACUAD|SQUAREBAR|SQ\d)/.test(code)) return "square-bar";

  // Perfil doble T (I / W / HEA / HEB / IPE / IPN / HN ...)
  if (type === "I" || /^(I|W|HE[AB]|IPE|IPN|HN|HP)\d/.test(code)) return "i-beam";

  return "unknown";
}

export interface CncFaceView {
  faceCode: DstvFace | "plate";
  faceLabel: string;
  widthMm: number; // extensión en X (largo)
  heightMm: number; // extensión en Y (ancho/alto de esa cara)
  contour: { x: number; y: number }[];
  holes: CncHole[];
}

export interface CncNormalizedPiece {
  kind: "plate" | "profile";
  source: "dxf" | "dstv";
  label: string;
  profileType?: string;
  profileFamily?: ProfileFamily;
  grade: string;
  quantity: number;
  lengthMm: number;
  widthMm: number; // ancho de plancha, o altura(h) de perfil
  thicknessMm: number; // espesor de plancha, o 0 para perfiles (se usa tw/tf)
  webThicknessMm?: number;
  flangeThicknessMm?: number;
  weightPerMeterKg?: number;
  faces: CncFaceView[];
}

const FACE_LABELS: Record<DstvFace, string> = {
  v: "Alma (Web)",
  o: "Ala Superior",
  u: "Ala Inferior",
  h: "Cara Posterior"
};

export function normalizeDstvPiece(piece: DstvPiece): CncNormalizedPiece {
  // Las planchas/planchas de corte (DSTV tipo "B" = Blech) vienen dentro de
  // archivos NC1 igual que un perfil, pero geométricamente son un elemento
  // plano: hay que tratarlas como "plate" (igual que un DXF), no extruir
  // una sección de perfil.
  if (isPlateProfile(piece.profileType, piece.profileCode)) {
    const allHoles = piece.holes.map((h) => ({ x: h.x, y: h.y, diameterMm: h.diameterMm }));
    const outer = piece.outerContours[0];
    const outerPts = outer?.points && outer.points.length > 2 ? outer.points : null;

    // El contorno real (AK) es la fuente más confiable para el tamaño de la
    // plancha: refleja la forma real (incluidos chaflanes/recortes), a
    // diferencia de los campos numéricos del header cuyo orden varía entre
    // exportadores y para planchas no sigue el layout h/b/tw/tf de un perfil.
    const xs = outerPts?.map((p) => p.x) || [];
    const ys = outerPts?.map((p) => p.y) || [];
    const boundingW = outerPts ? Math.max(...xs) - Math.min(...xs) : 0;
    const boundingH = outerPts ? Math.max(...ys) - Math.min(...ys) : 0;

    const width = boundingW || piece.lengthMm || 0;
    const height = boundingH || piece.heightMm || piece.widthMm || 0;
    const contour =
      outerPts ||
      [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
        { x: 0, y: 0 }
      ];
    const thickness =
      parsePlateThicknessFromCode(piece.profileCode) || piece.webThicknessMm || piece.flangeThicknessMm || 10;

    return {
      kind: "plate",
      source: "dstv",
      label: piece.profileCode || "Plancha",
      grade: piece.grade,
      quantity: piece.quantity,
      lengthMm: width,
      widthMm: height,
      thicknessMm: thickness,
      faces: [
        {
          faceCode: "plate",
          faceLabel: "Plancha",
          widthMm: width,
          heightMm: height,
          contour,
          holes: allHoles
        }
      ]
    };
  }

  const facesPresent = new Set<DstvFace>();
  piece.holes.forEach((h) => facesPresent.add(h.face));
  piece.outerContours.forEach((c) => facesPresent.add(c.face));
  if (facesPresent.size === 0) facesPresent.add("v");

  const faces: CncFaceView[] = Array.from(facesPresent).map((faceCode) => {
    const faceHoles = piece.holes
      .filter((h) => h.face === faceCode)
      .map((h) => ({ x: h.x, y: h.y, diameterMm: h.diameterMm }));

    const faceContour = piece.outerContours.find((c) => c.face === faceCode);
    const faceHeight =
      faceCode === "v"
        ? piece.heightMm
        : faceCode === "h"
        ? piece.heightMm
        : piece.widthMm; // alas: ancho de ala

    const contour = faceContour
      ? faceContour.points
      : [
          { x: 0, y: 0 },
          { x: piece.lengthMm, y: 0 },
          { x: piece.lengthMm, y: faceHeight },
          { x: 0, y: faceHeight },
          { x: 0, y: 0 }
        ];

    return {
      faceCode,
      faceLabel: FACE_LABELS[faceCode],
      widthMm: piece.lengthMm,
      heightMm: faceHeight,
      contour,
      holes: faceHoles
    };
  });

  // Orden preferente: alma primero, luego alas
  const order: DstvFace[] = ["v", "o", "u", "h"];
  faces.sort((a, b) => order.indexOf(a.faceCode as DstvFace) - order.indexOf(b.faceCode as DstvFace));

  return {
    kind: "profile",
    source: "dstv",
    label: piece.profileCode,
    profileType: piece.profileType,
    profileFamily: classifyProfileFamily(piece.profileType, piece.profileCode),
    grade: piece.grade,
    quantity: piece.quantity,
    lengthMm: piece.lengthMm,
    widthMm: piece.heightMm,
    thicknessMm: 0,
    webThicknessMm: piece.webThicknessMm,
    flangeThicknessMm: piece.flangeThicknessMm,
    weightPerMeterKg: piece.weightPerMeterKg,
    faces
  };
}

export function normalizeDxfPiece(piece: DxfPiece, label: string, thicknessMm: number, grade: string): CncNormalizedPiece {
  const contour = piece.outerContour?.points || [
    { x: 0, y: 0 },
    { x: piece.boundingWidth, y: 0 },
    { x: piece.boundingWidth, y: piece.boundingHeight },
    { x: 0, y: piece.boundingHeight }
  ];

  return {
    kind: "plate",
    source: "dxf",
    label,
    grade,
    quantity: 1,
    lengthMm: piece.boundingWidth,
    widthMm: piece.boundingHeight,
    thicknessMm,
    faces: [
      {
        faceCode: "plate",
        faceLabel: "Plancha",
        widthMm: piece.boundingWidth,
        heightMm: piece.boundingHeight,
        contour,
        holes: piece.holes
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Auto-dimensioning: genera líneas de cota (overall + por agujero) listas
// para dibujar en SVG.
// ---------------------------------------------------------------------------
export interface DimensionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  orientation: "horizontal" | "vertical";
}

export function generateOverallDimensions(face: CncFaceView): DimensionLine[] {
  const dims: DimensionLine[] = [];
  dims.push({
    x1: 0,
    y1: -face.heightMm * 0.18 - 10,
    x2: face.widthMm,
    y2: -face.heightMm * 0.18 - 10,
    label: `${face.widthMm.toLocaleString("es-CL")} mm`,
    orientation: "horizontal"
  });
  dims.push({
    x1: -face.widthMm * 0.12 - 10,
    y1: 0,
    x2: -face.widthMm * 0.12 - 10,
    y2: face.heightMm,
    label: `${face.heightMm.toLocaleString("es-CL")} mm`,
    orientation: "vertical"
  });
  return dims;
}

export interface HoleAnnotation {
  hole: CncHole;
  distToLeftEdge: number;
  distToBottomEdge: number;
}

export function generateHoleAnnotations(face: CncFaceView): HoleAnnotation[] {
  return face.holes.map((hole) => ({
    hole,
    distToLeftEdge: Number(hole.x.toFixed(1)),
    distToBottomEdge: Number(hole.y.toFixed(1))
  }));
}
