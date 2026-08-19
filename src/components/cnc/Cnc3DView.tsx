import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CncNormalizedPiece } from "../../utils/cncGeometry";

interface Cnc3DViewProps {
  piece: CncNormalizedPiece;
}

/** Construye una THREE.Shape 2D a partir de un contorno de puntos {x,y} */
function contourToShape(points: { x: number; y: number }[]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length === 0) return shape;
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return shape;
}

/** Genera la geometría 3D de una plancha/placa DXF: extrusión con agujeros reales */
function buildPlateMesh(piece: CncNormalizedPiece): THREE.Object3D {
  const face = piece.faces[0];
  const shape = contourToShape(face.contour.length > 0 ? face.contour : [
    { x: 0, y: 0 }, { x: face.widthMm, y: 0 }, { x: face.widthMm, y: face.heightMm }, { x: 0, y: face.heightMm }
  ]);

  face.holes.forEach((h) => {
    const holePath = new THREE.Path();
    const r = h.diameterMm / 2;
    holePath.absellipse(h.x, h.y, r, r, 0, Math.PI * 2, false, 0);
    shape.holes.push(holePath);
  });

  const thickness = piece.thicknessMm > 0 ? piece.thicknessMm : 10;
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  geometry.center();

  const material = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.55, roughness: 0.45 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Genera una sección transversal 2D aproximada según el tipo de perfil DSTV */
function buildProfileCrossSection(piece: CncNormalizedPiece): THREE.Shape {
  const h = piece.widthMm || 100; // altura/peralte
  const b = piece.faces.find((f) => f.faceCode === "o")?.heightMm || h * 0.6; // ancho de ala
  const tw = piece.webThicknessMm || Math.max(2, h * 0.04);
  const tf = piece.flangeThicknessMm || Math.max(2, h * 0.06);
  const type = (piece.profileType || "").toUpperCase();

  const shape = new THREE.Shape();

  if (type === "L") {
    // Ángulo: dos brazos en escuadra
    const t = tw || 5;
    shape.moveTo(0, 0);
    shape.lineTo(b, 0);
    shape.lineTo(b, t);
    shape.lineTo(t, t);
    shape.lineTo(t, h);
    shape.lineTo(0, h);
    shape.closePath();
  } else if (type === "U" || type === "C") {
    // Canal / costanera en forma de C
    shape.moveTo(0, 0);
    shape.lineTo(b, 0);
    shape.lineTo(b, tf);
    shape.lineTo(tw, tf);
    shape.lineTo(tw, h - tf);
    shape.lineTo(b, h - tf);
    shape.lineTo(b, h);
    shape.lineTo(0, h);
    shape.closePath();
  } else if (type === "RU" || type === "RO") {
    // Tubo rectangular/cuadrado (aproximado, pared tw)
    const t = tw || Math.max(2, h * 0.05);
    const outer = [
      { x: -b / 2, y: -h / 2 }, { x: b / 2, y: -h / 2 }, { x: b / 2, y: h / 2 }, { x: -b / 2, y: h / 2 }
    ];
    shape.moveTo(outer[0].x, outer[0].y);
    outer.slice(1).forEach((p) => shape.lineTo(p.x, p.y));
    shape.closePath();
    const inner = new THREE.Path();
    inner.moveTo(-b / 2 + t, -h / 2 + t);
    inner.lineTo(b / 2 - t, -h / 2 + t);
    inner.lineTo(b / 2 - t, h / 2 - t);
    inner.lineTo(-b / 2 + t, h / 2 - t);
    inner.closePath();
    shape.holes.push(inner);
  } else {
    // I / W / IPE / HEA / genérico: doble T
    const halfB = b / 2;
    const halfTw = tw / 2;
    shape.moveTo(-halfB, -h / 2);
    shape.lineTo(halfB, -h / 2);
    shape.lineTo(halfB, -h / 2 + tf);
    shape.lineTo(halfTw, -h / 2 + tf);
    shape.lineTo(halfTw, h / 2 - tf);
    shape.lineTo(halfB, h / 2 - tf);
    shape.lineTo(halfB, h / 2);
    shape.lineTo(-halfB, h / 2);
    shape.lineTo(-halfB, h / 2 - tf);
    shape.lineTo(-halfTw, h / 2 - tf);
    shape.lineTo(-halfTw, -h / 2 + tf);
    shape.lineTo(-halfB, -h / 2 + tf);
    shape.closePath();
  }

  return shape;
}

function buildProfileMesh(piece: CncNormalizedPiece): THREE.Object3D {
  const group = new THREE.Group();
  const crossSection = buildProfileCrossSection(piece);

  // Extruye la sección a lo largo del eje Z (largo de la barra)
  const geometry = new THREE.ExtrudeGeometry(crossSection, {
    steps: 1,
    depth: piece.lengthMm,
    bevelEnabled: false
  });

  const material = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.4 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(piece.lengthMm / 2, 0, 0);
  group.add(mesh);

  // Marca visual de los agujeros (anillos) en su posición real a lo largo de la barra
  const h = piece.widthMm || 100;
  piece.faces.forEach((face) => {
    face.holes.forEach((hole) => {
      const ringGeo = new THREE.TorusGeometry(hole.diameterMm / 2, Math.max(0.6, hole.diameterMm * 0.06), 8, 20);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.3 });
      const ring = new THREE.Mesh(ringGeo, ringMat);

      let posX = hole.x;
      let posY = 0;
      let posZ = 0;
      let rotX = 0;
      let rotY = Math.PI / 2;

      if (face.faceCode === "v") {
        posY = hole.y - h / 2;
        posZ = 0;
        rotY = Math.PI / 2;
      } else if (face.faceCode === "o") {
        posY = h / 2;
        posZ = hole.y - face.heightMm / 2;
        rotX = Math.PI / 2;
        rotY = 0;
      } else if (face.faceCode === "u") {
        posY = -h / 2;
        posZ = hole.y - face.heightMm / 2;
        rotX = Math.PI / 2;
        rotY = 0;
      }

      ring.position.set(posX, posY, posZ);
      ring.rotation.set(rotX, rotY, 0);
      group.add(ring);
    });
  });

  group.position.x = -piece.lengthMm / 2;
  return group;
}

export const Cnc3DView: React.FC<Cnc3DViewProps> = ({ piece }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    const maxDim = Math.max(piece.lengthMm, piece.widthMm, 200);
    camera.position.set(maxDim * 0.9, maxDim * 0.7, maxDim * 0.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(maxDim, maxDim * 1.5, maxDim);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.3);
    dirLight2.position.set(-maxDim, -maxDim * 0.5, -maxDim);
    scene.add(dirLight2);

    const gridHelper = new THREE.GridHelper(maxDim * 2.2, 20, 0x1e293b, 0x1e293b);
    scene.add(gridHelper);

    const mesh = piece.kind === "plate" ? buildPlateMesh(piece) : buildProfileMesh(piece);
    scene.add(mesh);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [piece]);

  return <div ref={containerRef} className="w-full h-full" />;
};
