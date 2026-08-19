import React from "react";
import { CncFaceView, generateOverallDimensions, generateHoleAnnotations } from "../../utils/cncGeometry";

interface Cnc2DDrawingProps {
  face: CncFaceView;
}

export const Cnc2DDrawing: React.FC<Cnc2DDrawingProps> = ({ face }) => {
  const padding = Math.max(face.widthMm, face.heightMm) * 0.25 + 40;
  const minX = -padding;
  const minY = -padding;
  const vbWidth = face.widthMm + padding * 2;
  const vbHeight = face.heightMm + padding * 2;

  // SVG tiene Y creciendo hacia abajo; invertimos para que las cotas se vean
  // como un plano técnico normal (Y creciendo hacia arriba).
  const flipY = (y: number) => face.heightMm - y;

  const contourPath =
    face.contour.length > 0
      ? `M ${face.contour.map((p) => `${p.x},${flipY(p.y)}`).join(" L ")} Z`
      : "";

  const holeAnnotations = generateHoleAnnotations(face);

  const fontSize = Math.max(face.widthMm, face.heightMm) * 0.022;
  const strokeW = Math.max(face.widthMm, face.heightMm) * 0.0025;

  return (
    <svg viewBox={`${minX} ${minY - 30} ${vbWidth} ${vbHeight + 30}`} className="w-full h-full">
      <defs>
        <marker id="dimArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
        <pattern id="mmGrid" width={Math.max(face.widthMm, 50) / 20} height={Math.max(face.widthMm, 50) / 20} patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.5" fill="#1e293b" />
        </pattern>
      </defs>

      {/* Grid de fondo */}
      <rect x={minX} y={minY} width={vbWidth} height={vbHeight} fill="url(#mmGrid)" opacity="0.4" />

      {/* Contorno de la pieza */}
      {contourPath && (
        <path d={contourPath} fill="#1e293b" stroke="#94a3b8" strokeWidth={strokeW * 2} />
      )}

      {/* Agujeros */}
      {face.holes.map((h, idx) => (
        <g key={idx}>
          <circle cx={h.x} cy={flipY(h.y)} r={h.diameterMm / 2} fill="#0f172a" stroke="#f59e0b" strokeWidth={strokeW * 1.5} />
          <line x1={h.x - h.diameterMm * 0.7} y1={flipY(h.y)} x2={h.x + h.diameterMm * 0.7} y2={flipY(h.y)} stroke="#f59e0b" strokeWidth={strokeW} opacity="0.6" />
          <line x1={h.x} y1={flipY(h.y) - h.diameterMm * 0.7} x2={h.x} y2={flipY(h.y) + h.diameterMm * 0.7} stroke="#f59e0b" strokeWidth={strokeW} opacity="0.6" />
        </g>
      ))}

      {/* Cotas generales (largo total / alto total) */}
      <g>
        <line
          x1={0} y1={face.heightMm + padding * 0.35}
          x2={face.widthMm} y2={face.heightMm + padding * 0.35}
          stroke="#38bdf8" strokeWidth={strokeW} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)"
        />
        <text x={face.widthMm / 2} y={face.heightMm + padding * 0.35 - padding * 0.06} fill="#38bdf8" fontSize={fontSize} fontWeight="bold" textAnchor="middle" fontFamily="monospace">
          {face.widthMm.toLocaleString("es-CL")} mm
        </text>

        <line
          x1={-padding * 0.35} y1={0}
          x2={-padding * 0.35} y2={face.heightMm}
          stroke="#38bdf8" strokeWidth={strokeW} markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)"
        />
        <text
          x={-padding * 0.35 - padding * 0.06} y={face.heightMm / 2}
          fill="#38bdf8" fontSize={fontSize} fontWeight="bold" textAnchor="middle" fontFamily="monospace"
          transform={`rotate(-90 ${-padding * 0.35 - padding * 0.06} ${face.heightMm / 2})`}
        >
          {face.heightMm.toLocaleString("es-CL")} mm
        </text>
      </g>

      {/* Cotas de cada agujero: distancia desde el borde inferior izquierdo */}
      {holeAnnotations.map((a, idx) => (
        <g key={`ann-${idx}`} opacity="0.85">
          {/* Línea guía horizontal (X) */}
          <line x1={a.hole.x} y1={flipY(0)} x2={a.hole.x} y2={flipY(a.hole.y)} stroke="#64748b" strokeWidth={strokeW * 0.7} strokeDasharray={`${strokeW * 2} ${strokeW * 2}`} />
          {/* Línea guía vertical (Y) */}
          <line x1={0} y1={flipY(a.hole.y)} x2={a.hole.x} y2={flipY(a.hole.y)} stroke="#64748b" strokeWidth={strokeW * 0.7} strokeDasharray={`${strokeW * 2} ${strokeW * 2}`} />
          <text x={a.hole.x + a.hole.diameterMm} y={flipY(a.hole.y) - a.hole.diameterMm - fontSize * 0.3} fill="#fbbf24" fontSize={fontSize * 0.85} fontWeight="bold" fontFamily="monospace">
            ⌀{a.hole.diameterMm}
          </text>
        </g>
      ))}
    </svg>
  );
};
