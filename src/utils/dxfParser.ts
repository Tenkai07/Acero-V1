import DxfParser from "dxf-parser";

export interface DxfHole {
  x: number;
  y: number;
  diameterMm: number;
}

export interface DxfContourSegment {
  points: { x: number; y: number }[];
}

export interface DxfPiece {
  outerContour: DxfContourSegment | null;
  holes: DxfHole[];
  otherContours: DxfContourSegment[]; // notches / cortes internos no circulares
  boundingWidth: number;
  boundingHeight: number;
  units: string;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2);
}

function arcToPoints(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number, segments = 24) {
  const points: { x: number; y: number }[] = [];
  let start = (startAngleDeg * Math.PI) / 180;
  let end = (endAngleDeg * Math.PI) / 180;
  if (end < start) end += Math.PI * 2;
  for (let i = 0; i <= segments; i++) {
    const t = start + ((end - start) * i) / segments;
    points.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return points;
}

/**
 * Parsea el texto de un archivo DXF y extrae:
 * - Círculos pequeños -> se interpretan como agujeros/perforaciones
 * - La polilínea/contorno cerrado de mayor área -> se interpreta como el
 *   contorno exterior de la pieza
 * - Otras polilíneas cerradas -> recortes/notches internos
 */
export function parseDxfContent(content: string): DxfPiece {
  const parser = new DxfParser();
  const dxf = parser.parseSync(content);

  const holes: DxfHole[] = [];
  const closedLoops: DxfContourSegment[] = [];
  const openSegments: { x: number; y: number }[][] = [];

  const entities = dxf?.entities || [];

  for (const entity of entities as any[]) {
    switch (entity.type) {
      case "CIRCLE": {
        holes.push({
          x: entity.center.x,
          y: entity.center.y,
          diameterMm: entity.radius * 2
        });
        break;
      }
      case "ARC": {
        // Los arcos sueltos (no parte de una polilínea) se guardan como
        // segmento abierto; si el contorno los usa para esquinas
        // redondeadas normalmente vienen dentro de una LWPOLYLINE con bulge.
        const pts = arcToPoints(entity.center.x, entity.center.y, entity.radius, entity.startAngle, entity.endAngle);
        openSegments.push(pts);
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const verts = (entity.vertices || []).map((v: any) => ({ x: v.x, y: v.y }));
        if (verts.length < 2) break;

        const isClosed = entity.shape || entity.closed || distance(verts[0], verts[verts.length - 1]) < 0.01;

        // Heurística: una polilínea cerrada de 4-6 vértices formando un
        // rectángulo/círculo pequeño también podría ser un agujero cuadrado;
        // se deja como contorno igual, el usuario ve la forma real.
        if (isClosed) {
          closedLoops.push({ points: verts });
        } else {
          openSegments.push(verts);
        }
        break;
      }
      case "LINE": {
        openSegments.push([
          { x: entity.start.x, y: entity.start.y },
          { x: entity.end.x, y: entity.end.y }
        ]);
        break;
      }
      default:
        break;
    }
  }

  // El contorno exterior = el loop cerrado de mayor área
  let outerContour: DxfContourSegment | null = null;
  let maxArea = -1;
  const otherContours: DxfContourSegment[] = [];

  for (const loop of closedLoops) {
    const area = polygonArea(loop.points);
    if (area > maxArea) {
      if (outerContour) otherContours.push(outerContour);
      outerContour = loop;
      maxArea = area;
    } else {
      otherContours.push(loop);
    }
  }

  // Intentar reconstruir un contorno a partir de segmentos de LINE sueltos
  // conectados extremo a extremo (típico de exports DXF simples sin polyline).
  if (!outerContour && openSegments.length > 0) {
    const chain = chainSegments(openSegments);
    if (chain.length > 2) {
      outerContour = { points: chain };
    }
  }

  const allPointsForBounds = outerContour?.points || openSegments.flat();
  const xs = allPointsForBounds.map((p) => p.x);
  const ys = allPointsForBounds.map((p) => p.y);
  const boundingWidth = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const boundingHeight = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;

  return {
    outerContour,
    holes,
    otherContours,
    boundingWidth,
    boundingHeight,
    units: (dxf as any)?.header?.["$INSUNITS"] === 4 ? "mm" : "mm"
  };
}

/** Encadena segmentos sueltos (LINE) por proximidad de extremos en un solo contorno cerrado */
function chainSegments(segments: { x: number; y: number }[][]): { x: number; y: number }[] {
  const remaining = [...segments];
  if (remaining.length === 0) return [];

  const chain = [...remaining.shift()!];
  const tolerance = 0.5;

  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    const tail = chain[chain.length - 1];

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      if (distance(tail, seg[0]) < tolerance) {
        chain.push(...seg.slice(1));
        remaining.splice(i, 1);
        progress = true;
        break;
      }
      if (distance(tail, seg[seg.length - 1]) < tolerance) {
        chain.push(...[...seg].reverse().slice(1));
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  return chain;
}
