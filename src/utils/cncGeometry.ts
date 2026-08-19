import { DstvPiece, DstvFace } from "./dstvParser";
import { DxfPiece } from "./dxfParser";

export interface CncHole {
  x: number;
  y: number;
  diameterMm: number;
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
