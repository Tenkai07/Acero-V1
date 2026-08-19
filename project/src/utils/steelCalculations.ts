import { PlateCalculation, ChannelFoldingCalculation } from "../types";

/**
 * Calculates weight of steel plates
 * @param lengthMm Longitud en mm
 * @param widthMm Ancho en mm
 * @param thicknessMm Espesor en mm
 * @param density Densidad en g/cm³ o kg/dm³ (por defecto 8.0 según solicitud)
 * @param quantity Cantidad de unidades
 */
export function calculatePlateWeight(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number,
  density: number = 8.0,
  quantity: number = 1
): {
  unitWeightKg: number;
  totalWeightKg: number;
  areaM2: number;
  totalAreaM2: number;
  volumeDm3: number;
} {
  const areaM2 = (lengthMm * widthMm) / 1_000_000;
  const totalAreaM2 = areaM2 * quantity;
  
  // Volumen en decímetros cúbicos (litros)
  const volumeDm3 = (lengthMm / 100) * (widthMm / 100) * (thicknessMm / 100);
  
  // Peso unitario con densidad solicitada (8.0 kg/dm³)
  const unitWeightKg = Number((volumeDm3 * density).toFixed(3));
  const totalWeightKg = Number((unitWeightKg * quantity).toFixed(3));

  return {
    unitWeightKg,
    totalWeightKg,
    areaM2: Number(areaM2.toFixed(4)),
    totalAreaM2: Number(totalAreaM2.toFixed(4)),
    volumeDm3: Number(volumeDm3.toFixed(4))
  };
}

/**
 * Calculates Channel Folding Blank Size (Desarrollo de plegado de plancha)
 * Considerando la deducción por pliegue (Bend Deduction) en la zona de curvatura.
 */
export function calculateChannelFolding({
  type,
  thicknessMm,
  innerRadiusMm,
  kFactor = 0.42,
  webHeightH,
  flangeWidthB,
  lipWidthC = 0,
  lengthMm,
  quantity = 1,
  density = 8.0
}: {
  type: "canal-u" | "canal-c-atiesada" | "perfil-z" | "omega" | "angulo";
  thicknessMm: number;
  innerRadiusMm: number;
  kFactor?: number;
  webHeightH: number;
  flangeWidthB: number;
  lipWidthC?: number;
  lengthMm: number;
  quantity?: number;
  density?: number;
}): {
  developedWidthMm: number;
  bendDeductionMm: number;
  bendAllowanceMm: number;
  outerSetbackMm: number;
  weightPerMeterKg: number;
  totalWeightKg: number;
  cutsPerStandardSheet: {
    sheet1000x3000: { cuts: number; scrapMm: number; scrapPercent: number };
    sheet1200x2400: { cuts: number; scrapMm: number; scrapPercent: number };
    sheet1500x3000: { cuts: number; scrapMm: number; scrapPercent: number };
    sheet1500x6000: { cuts: number; scrapMm: number; scrapPercent: number };
  };
  stepBendLocations: number[]; // Posiciones de las líneas de doblado desde el borde (mm)
} {
  const t = Math.max(0.1, thicknessMm);
  const r = Math.max(0.1, innerRadiusMm);
  const k = Math.min(0.5, Math.max(0.2, kFactor));

  // Para 90 grados:
  // Bend Allowance (Longitud de arco neutro): BA = (pi / 2) * (r + k * t)
  const bendAllowanceMm = (Math.PI / 2) * (r + k * t);
  
  // Outside Setback: OSSB = r + t
  const outerSetbackMm = r + t;
  
  // Bend Deduction (Deducción por pliegue): BD = 2 * OSSB - BA
  const bendDeductionMm = (2 * outerSetbackMm) - bendAllowanceMm;

  let developedWidthMm = 0;
  let numBends = 0;
  const stepBendLocations: number[] = [];

  if (type === "canal-u") {
    // 3 caras: B + H + B con 2 pliegues
    numBends = 2;
    developedWidthMm = flangeWidthB + webHeightH + flangeWidthB - (numBends * bendDeductionMm);
    
    // Líneas de doblado (medidas desde el borde exterior plano)
    const bend1 = flangeWidthB - outerSetbackMm + (bendAllowanceMm / 2);
    const bend2 = developedWidthMm - bend1;
    stepBendLocations.push(Number(bend1.toFixed(1)), Number(bend2.toFixed(1)));

  } else if (type === "canal-c-atiesada") {
    // 5 caras: C + B + H + B + C con 4 pliegues
    numBends = 4;
    const c = lipWidthC || 15;
    developedWidthMm = c + flangeWidthB + webHeightH + flangeWidthB + c - (numBends * bendDeductionMm);
    
    const bend1 = c - outerSetbackMm + (bendAllowanceMm / 2);
    const bend2 = bend1 + (flangeWidthB - (2 * outerSetbackMm) + bendAllowanceMm);
    const bend3 = developedWidthMm - bend2;
    const bend4 = developedWidthMm - bend1;
    stepBendLocations.push(
      Number(bend1.toFixed(1)), 
      Number(bend2.toFixed(1)), 
      Number(bend3.toFixed(1)), 
      Number(bend4.toFixed(1))
    );

  } else if (type === "perfil-z") {
    numBends = 2;
    developedWidthMm = flangeWidthB + webHeightH + flangeWidthB - (numBends * bendDeductionMm);
    const bend1 = flangeWidthB - outerSetbackMm + (bendAllowanceMm / 2);
    const bend2 = developedWidthMm - bend1;
    stepBendLocations.push(Number(bend1.toFixed(1)), Number(bend2.toFixed(1)));

  } else if (type === "angulo") {
    numBends = 1;
    developedWidthMm = flangeWidthB + webHeightH - (numBends * bendDeductionMm);
    const bend1 = flangeWidthB - outerSetbackMm + (bendAllowanceMm / 2);
    stepBendLocations.push(Number(bend1.toFixed(1)));
  } else {
    // default canal u
    numBends = 2;
    developedWidthMm = flangeWidthB + webHeightH + flangeWidthB - (numBends * bendDeductionMm);
  }

  developedWidthMm = Number(developedWidthMm.toFixed(2));

  // Peso por metro lineal (kg/m)
  // Ancho en metros * espesor en mm * densidad
  const weightPerMeterKg = Number(((developedWidthMm / 1000) * t * density).toFixed(3));
  
  // Peso total de la pieza o pedido
  const unitWeightKg = (weightPerMeterKg * lengthMm) / 1000;
  const totalWeightKg = Number((unitWeightKg * quantity).toFixed(3));

  // Análisis de optimización en planchas comerciales en Chile
  const calculateCuts = (sheetW: number) => {
    if (developedWidthMm <= 0 || developedWidthMm > sheetW) {
      return { cuts: 0, scrapMm: sheetW, scrapPercent: 100 };
    }
    const cuts = Math.floor(sheetW / developedWidthMm);
    const usedWidth = cuts * developedWidthMm;
    const scrapMm = Number((sheetW - usedWidth).toFixed(1));
    const scrapPercent = Number(((scrapMm / sheetW) * 100).toFixed(1));
    return { cuts, scrapMm, scrapPercent };
  };

  return {
    developedWidthMm,
    bendDeductionMm: Number(bendDeductionMm.toFixed(2)),
    bendAllowanceMm: Number(bendAllowanceMm.toFixed(2)),
    outerSetbackMm: Number(outerSetbackMm.toFixed(2)),
    weightPerMeterKg,
    totalWeightKg,
    cutsPerStandardSheet: {
      sheet1000x3000: calculateCuts(1000),
      sheet1200x2400: calculateCuts(1200),
      sheet1500x3000: calculateCuts(1500),
      sheet1500x6000: calculateCuts(1500)
    },
    stepBendLocations
  };
}

/**
 * Calculates Section Properties and weight for custom I/W beam parameters
 */
export function calculateBeamProperties(
  hMm: number,
  bMm: number,
  twMm: number,
  tfMm: number,
  rMm: number = 0,
  density: number = 7.85
) {
  const h = Math.max(10, hMm);
  const b = Math.max(10, bMm);
  const tw = Math.max(1, twMm);
  const tf = Math.max(1, tfMm);

  // Area en mm² y cm²
  const hw = Math.max(1, h - 2 * tf);
  const flangeArea = 2 * (b * tf);
  const webArea = hw * tw;
  // Corner fillets addition
  const cornerArea = rMm > 0 ? (4 - Math.PI) * Math.pow(rMm, 2) : 0;
  const totalAreaMm2 = flangeArea + webArea + cornerArea;
  const areaCm2 = totalAreaMm2 / 100;

  // Peso lineal en kg/m
  const weightKgM = (areaCm2 * (density / 10));

  // Inercia Ix (eje fuerte) en mm4 -> cm4
  // Ix = (b * h^3 - (b - tw) * hw^3) / 12
  const ixMm4 = (b * Math.pow(h, 3) - (b - tw) * Math.pow(hw, 3)) / 12;
  const ixCm4 = ixMm4 / 10000;

  // Inercia Iy (eje débil) en mm4 -> cm4
  // Iy = 2 * (tf * b^3 / 12) + (hw * tw^3 / 12)
  const iyMm4 = (2 * (tf * Math.pow(b, 3)) / 12) + ((hw * Math.pow(tw, 3)) / 12);
  const iyCm4 = iyMm4 / 10000;

  // Módulos resistentes Wx y Wy (cm3)
  const wxCm3 = (2 * ixCm4) / (h / 10);
  const wyCm3 = (2 * iyCm4) / (b / 10);

  // Radios de giro rx y ry (cm)
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(1)),
    iyCm4: Number(iyCm4.toFixed(1)),
    wxCm3: Number(wxCm3.toFixed(1)),
    wyCm3: Number(wyCm3.toFixed(1)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2)),
    webClearHeightMm: hw
  };
}

/**
 * Calculates Channel (UPN / Canal U sin pestaña) properties
 */
export function calculateChannelProperties(
  hMm: number,
  bMm: number,
  twMm: number,
  tfMm: number = twMm,
  density: number = 7.85
) {
  const h = Math.max(10, hMm);
  const b = Math.max(10, bMm);
  const tw = Math.max(0.5, twMm);
  const tf = Math.max(0.5, tfMm);
  const hw = Math.max(1, h - 2 * tf);

  const flangeArea = 2 * (b * tf);
  const webArea = hw * tw;
  const areaCm2 = (flangeArea + webArea) / 100;
  const weightKgM = areaCm2 * (density / 10);

  const ixMm4 = (b * Math.pow(h, 3) - (b - tw) * Math.pow(hw, 3)) / 12;
  const ixCm4 = ixMm4 / 10000;
  const wxCm3 = (2 * ixCm4) / (h / 10);
  const rxCm = Math.sqrt(ixCm4 / areaCm2);

  // Eje Y (Centroide xG desplazado del alma)
  const xG = (2 * (b * tf * (b / 2)) + (hw * tw * (tw / 2))) / (2 * b * tf + hw * tw);
  const iyMm4 = 2 * (tf * Math.pow(b, 3) / 12 + (b * tf) * Math.pow(b / 2 - xG, 2)) +
                (hw * Math.pow(tw, 3) / 12 + (hw * tw) * Math.pow(tw / 2 - xG, 2));
  const iyCm4 = iyMm4 / 10000;
  const wyCm3 = iyCm4 / (Math.max(xG, b - xG) / 10);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(1)),
    iyCm4: Number(iyCm4.toFixed(1)),
    wxCm3: Number(wxCm3.toFixed(1)),
    wyCm3: Number(wyCm3.toFixed(1)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2)),
    centroidXG: Number(xG.toFixed(1))
  };
}

/**
 * Calculates C Channel / Costanera C (Perfil C con pestañas atiesadoras) properties
 * Dimensiones exteriores: h (alto alma), b (ancho alas), c (pestaña atiesadora), t (espesor)
 */
export function calculateCChannelProperties(
  hMm: number,
  bMm: number,
  cMm: number,
  tMm: number,
  density: number = 7.85
) {
  const h = Math.max(10, hMm);
  const b = Math.max(10, bMm);
  const c = Math.max(0, cMm);
  const t = Math.max(0.5, tMm);

  if (c <= 0) {
    return calculateChannelProperties(h, b, t, t, density);
  }

  const hw = Math.max(1, h - 2 * t);
  const bw = Math.max(1, b - t);
  const cw = Math.max(1, c - t);

  const areaWeb = hw * t;
  const areaFlange = bw * t;
  const areaLip = cw * t;
  const totalAreaMm2 = areaWeb + (2 * areaFlange) + (2 * areaLip);
  const areaCm2 = totalAreaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  // Centroide xG desde el dorso exterior del alma
  const momentX = (areaWeb * (t / 2)) + (2 * areaFlange * ((b + t) / 2)) + (2 * areaLip * (b - (t / 2)));
  const xG = momentX / totalAreaMm2;

  // Inercia Ix (cm4)
  const ixWeb = (t * Math.pow(hw, 3)) / 12;
  const ixFlange = 2 * (((bw * Math.pow(t, 3)) / 12) + (areaFlange * Math.pow((h - t) / 2, 2)));
  const ixLip = 2 * (((t * Math.pow(cw, 3)) / 12) + (areaLip * Math.pow((h / 2) - (c / 2), 2)));
  const ixMm4 = ixWeb + ixFlange + ixLip;
  const ixCm4 = ixMm4 / 10000;

  // Inercia Iy (cm4)
  const iyWeb = ((hw * Math.pow(t, 3)) / 12) + (areaWeb * Math.pow((t / 2) - xG, 2));
  const iyFlange = 2 * (((t * Math.pow(bw, 3)) / 12) + (areaFlange * Math.pow(((b + t) / 2) - xG, 2)));
  const iyLip = 2 * (((cw * Math.pow(t, 3)) / 12) + (areaLip * Math.pow(b - (t / 2) - xG, 2)));
  const iyMm4 = iyWeb + iyFlange + iyLip;
  const iyCm4 = iyMm4 / 10000;

  const wxCm3 = (2 * ixCm4) / (h / 10);
  const wyCm3 = iyCm4 / (Math.max(xG, b - xG) / 10);
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(1)),
    iyCm4: Number(iyCm4.toFixed(1)),
    wxCm3: Number(wxCm3.toFixed(1)),
    wyCm3: Number(wyCm3.toFixed(1)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2)),
    centroidXG: Number(xG.toFixed(1))
  };
}

/**
 * Calculates Hollow Structural Sections (Tubos Cuadrados y Rectangulares)
 */
export function calculateHSSProperties(
  hMm: number,
  bMm: number,
  tMm: number,
  density: number = 7.85
) {
  const h = Math.max(10, hMm);
  const b = Math.max(10, bMm);
  const t = Math.max(0.5, tMm);
  const hi = Math.max(1, h - 2 * t);
  const bi = Math.max(1, b - 2 * t);

  const areaMm2 = (h * b) - (hi * bi);
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  const ixMm4 = (b * Math.pow(h, 3) - bi * Math.pow(hi, 3)) / 12;
  const iyMm4 = (h * Math.pow(b, 3) - hi * Math.pow(bi, 3)) / 12;
  const ixCm4 = ixMm4 / 10000;
  const iyCm4 = iyMm4 / 10000;

  const wxCm3 = (2 * ixCm4) / (h / 10);
  const wyCm3 = (2 * iyCm4) / (b / 10);
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(1)),
    iyCm4: Number(iyCm4.toFixed(1)),
    wxCm3: Number(wxCm3.toFixed(1)),
    wyCm3: Number(wyCm3.toFixed(1)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2))
  };
}

/**
 * Calculates Pipe (Cañerías / Tubos Redondos)
 */
export function calculatePipeProperties(
  odMm: number,
  tMm: number,
  density: number = 7.85
) {
  const od = Math.max(5, odMm);
  const t = Math.max(0.5, tMm);
  const id = Math.max(0.1, od - 2 * t);

  const areaMm2 = (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2));
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  const iMm4 = (Math.PI / 64) * (Math.pow(od, 4) - Math.pow(id, 4));
  const iCm4 = iMm4 / 10000;
  const wCm3 = (2 * iCm4) / (od / 10);
  const rCm = Math.sqrt(iCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(iCm4.toFixed(1)),
    iyCm4: Number(iCm4.toFixed(1)),
    wxCm3: Number(wCm3.toFixed(1)),
    wyCm3: Number(wCm3.toFixed(1)),
    rxCm: Number(rCm.toFixed(2)),
    ryCm: Number(rCm.toFixed(2)),
    idMm: Number(id.toFixed(2))
  };
}

/**
 * Calculates Angle (Ángulo L)
 */
export function calculateAngleProperties(
  hMm: number,
  bMm: number,
  tMm: number,
  density: number = 7.85
) {
  const h = Math.max(10, hMm);
  const b = Math.max(10, bMm);
  const t = Math.max(1, tMm);

  const areaMm2 = (h + b - t) * t;
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  // Centroides
  const xG = (b * t * (b / 2) + (h - t) * t * (t / 2)) / areaMm2;
  const yG = (h * t * (h / 2) + (b - t) * t * (t / 2)) / areaMm2;

  const ixMm4 = (t * Math.pow(h, 3) / 12 + (h * t) * Math.pow(h / 2 - yG, 2)) +
                ((b - t) * Math.pow(t, 3) / 12 + ((b - t) * t) * Math.pow(t / 2 - yG, 2));
  const iyMm4 = (t * Math.pow(b, 3) / 12 + (b * t) * Math.pow(b / 2 - xG, 2)) +
                ((h - t) * Math.pow(t, 3) / 12 + ((h - t) * t) * Math.pow(t / 2 - xG, 2));

  const ixCm4 = ixMm4 / 10000;
  const iyCm4 = iyMm4 / 10000;
  const wxCm3 = ixCm4 / (Math.max(yG, h - yG) / 10);
  const wyCm3 = iyCm4 / (Math.max(xG, b - xG) / 10);
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(1)),
    iyCm4: Number(iyCm4.toFixed(1)),
    wxCm3: Number(wxCm3.toFixed(1)),
    wyCm3: Number(wyCm3.toFixed(1)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2)),
    xG: Number(xG.toFixed(1)),
    yG: Number(yG.toFixed(1))
  };
}

/**
 * Calculates Round Bar (Barras Redondas Lisas / Pernos / Barandas)
 */
export function calculateRoundBarProperties(
  diameterMm: number,
  density: number = 7.85
) {
  const d = Math.max(1, diameterMm);
  const areaMm2 = (Math.PI / 4) * Math.pow(d, 2);
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  const iMm4 = (Math.PI / 64) * Math.pow(d, 4);
  const iCm4 = iMm4 / 10000;
  const wCm3 = (2 * iCm4) / (d / 10);
  const rCm = d / 40; // d/4 en cm

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(3)),
    ixCm4: Number(iCm4.toFixed(2)),
    iyCm4: Number(iCm4.toFixed(2)),
    wxCm3: Number(wCm3.toFixed(2)),
    wyCm3: Number(wCm3.toFixed(2)),
    rxCm: Number(rCm.toFixed(2)),
    ryCm: Number(rCm.toFixed(2))
  };
}

/**
 * Calculates Square Bar (Barras Cuadradas Macizas)
 */
export function calculateSquareBarProperties(
  sideMm: number,
  density: number = 7.85
) {
  const s = Math.max(1, sideMm);
  const areaMm2 = Math.pow(s, 2);
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  const iMm4 = Math.pow(s, 4) / 12;
  const iCm4 = iMm4 / 10000;
  const wCm3 = Math.pow(s / 10, 3) / 6;
  const rCm = (s / 10) / Math.sqrt(12);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(iCm4.toFixed(2)),
    iyCm4: Number(iCm4.toFixed(2)),
    wxCm3: Number(wCm3.toFixed(2)),
    wyCm3: Number(wCm3.toFixed(2)),
    rxCm: Number(rCm.toFixed(2)),
    ryCm: Number(rCm.toFixed(2))
  };
}

/**
 * Calculates Flat Bar (Pletinas)
 */
export function calculateFlatBarProperties(
  widthMm: number,
  thicknessMm: number,
  density: number = 7.85
) {
  const w = Math.max(1, widthMm);
  const t = Math.max(0.5, thicknessMm);
  const areaMm2 = w * t;
  const areaCm2 = areaMm2 / 100;
  const weightKgM = areaCm2 * (density / 10);

  const ixMm4 = (t * Math.pow(w, 3)) / 12; // Eje fuerte en el plano del ancho
  const iyMm4 = (w * Math.pow(t, 3)) / 12; // Eje débil
  const ixCm4 = ixMm4 / 10000;
  const iyCm4 = iyMm4 / 10000;
  const wxCm3 = (2 * ixCm4) / (w / 10);
  const wyCm3 = (2 * iyCm4) / (t / 10);
  const rxCm = Math.sqrt(ixCm4 / areaCm2);
  const ryCm = Math.sqrt(iyCm4 / areaCm2);

  return {
    areaCm2: Number(areaCm2.toFixed(2)),
    weightKgM: Number(weightKgM.toFixed(2)),
    ixCm4: Number(ixCm4.toFixed(2)),
    iyCm4: Number(iyCm4.toFixed(2)),
    wxCm3: Number(wxCm3.toFixed(2)),
    wyCm3: Number(wyCm3.toFixed(2)),
    rxCm: Number(rxCm.toFixed(2)),
    ryCm: Number(ryCm.toFixed(2))
  };
}

/**
 * Calculates Butt-Weld Elbow (Codos 90° y 45° Radio Largo/Corto y Barandas)
 */
export function calculateElbowProperties(
  odMm: number,
  thicknessMm: number,
  angleDeg: 90 | 45 = 90,
  bendRadiusMm?: number,
  density: number = 7.85
) {
  const od = Math.max(10, odMm);
  const t = Math.max(1, thicknessMm);
  const r = bendRadiusMm || (1.5 * od); // 1.5D para Radio Largo estándar
  const id = Math.max(0.1, od - 2 * t);

  // Longitud de arco por la línea central
  const arcLengthMm = (angleDeg * Math.PI * r) / 180;
  const crossSectionAreaMm2 = (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2));
  const volumeMm3 = crossSectionAreaMm2 * arcLengthMm;
  const unitWeightKg = Number(((volumeMm3 / 1_000_000) * (density / 1000) * 1000).toFixed(3));

  const centerToFaceMm = angleDeg === 90 ? r : r * Math.tan((22.5 * Math.PI) / 180);

  return {
    odMm: od,
    thicknessMm: t,
    idMm: Number(id.toFixed(1)),
    bendRadiusMm: Number(r.toFixed(1)),
    centerToFaceMm: Number(centerToFaceMm.toFixed(1)),
    arcLengthMm: Number(arcLengthMm.toFixed(1)),
    unitWeightKg: Math.max(0.05, unitWeightKg)
  };
}

/**
 * Conversor de Unidades
 */
export function convertUnits(value: number, fromUnit: string, toUnit: string): number {
  if (value === 0 || isNaN(value)) return 0;
  if (fromUnit === toUnit) return value;

  // Convert to base mm or kg
  let baseMm = value;
  switch (fromUnit) {
    case "mm": baseMm = value; break;
    case "cm": baseMm = value * 10; break;
    case "m": baseMm = value * 1000; break;
    case "pulgadas": baseMm = value * 25.4; break;
    case "pies": baseMm = value * 304.8; break;
    case "yardas": baseMm = value * 914.4; break;
    // Weight conversions
    case "kg": return toUnit === "lbs" ? value * 2.20462 : toUnit === "ton" ? value / 1000 : value;
    case "lbs": return toUnit === "kg" ? value / 2.20462 : toUnit === "ton" ? value / 2204.62 : value;
    case "ton": return toUnit === "kg" ? value * 1000 : toUnit === "lbs" ? value * 2204.62 : value;
    default: baseMm = value;
  }

  // Convert base mm to target
  switch (toUnit) {
    case "mm": return baseMm;
    case "cm": return baseMm / 10;
    case "m": return baseMm / 1000;
    case "pulgadas": return baseMm / 25.4;
    case "pies": return baseMm / 304.8;
    case "yardas": return baseMm / 914.4;
    default: return baseMm;
  }
}

/**
 * Convierte decimales de pulgadas a fracción habitual de maestranza (ej: 0.375 -> 3/8", 0.5 -> 1/2", 1.25 -> 1 1/4")
 */
export function decimalToFractionInch(inches: number): string {
  if (isNaN(inches) || inches === 0) return '0"';
  
  const whole = Math.floor(inches);
  const remainder = inches - whole;
  
  if (remainder < 0.015) {
    return whole > 0 ? `${whole}"` : '0"';
  }

  // Common denominators up to 64ths
  const fractionStep = 1 / 64;
  const closest64th = Math.round(remainder / fractionStep);
  
  if (closest64th === 64) {
    return `${whole + 1}"`;
  }
  
  if (closest64th === 0) {
    return whole > 0 ? `${whole}"` : '0"';
  }

  // Reduce fraction
  let num = closest64th;
  let den = 64;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }

  if (whole > 0) {
    return `${whole} ${num}/${den}"`;
  }
  return `${num}/${den}"`;
}

// Aliases for compatibility
export const calculateBarProperties = calculateRoundBarProperties;
export const calculateFlatProperties = calculateFlatBarProperties;

export interface MaterialDensityOption {
  id: string;
  name: string;
  category: "Acero" | "No Ferroso" | "Fundición" | "Plástico Técnico" | "Otro";
  densityGcm3: number; // g/cm³ = kg/dm³ = ton/m³
  notes: string;
}

export const ENGINEERING_MATERIALS: MaterialDensityOption[] = [
  { id: "carbon-steel-std", name: "Acero al Carbono (Norma Chile 8.0)", category: "Acero", densityGcm3: 8.00, notes: "Estándar comercial Maestranzas Chile (A36, A270ES)" },
  { id: "carbon-steel-785", name: "Acero Estructural A36 / SAE 1020/1045", category: "Acero", densityGcm3: 7.85, notes: "Densidad física teórica estándar ASTM / DIN" },
  { id: "alloy-steel-4140", name: "Acero Aleado / Bonificado (SAE 4140/4340/VCL)", category: "Acero", densityGcm3: 7.85, notes: "Ejes, vástagos y piezas de alta exigencia mecánica" },
  { id: "stainless-304", name: "Acero Inoxidable AISI 304 / 304L", category: "Acero", densityGcm3: 7.93, notes: "Inox austenítico alimentario e industrial" },
  { id: "stainless-316", name: "Acero Inoxidable AISI 316 / 316L", category: "Acero", densityGcm3: 8.00, notes: "Inox resistente a ácidos y ambiente marino" },
  { id: "tool-steel-d2", name: "Acero de Herramienta (D2 / H13 / O1 / K100)", category: "Acero", densityGcm3: 7.80, notes: "Matrices, punzones y cuchillas de corte" },
  { id: "cast-iron-gray", name: "Fierro Fundido Gris (FC 200 / 250)", category: "Fundición", densityGcm3: 7.20, notes: "Poleas, volantes, camisas y carcasas" },
  { id: "cast-iron-nodular", name: "Fierro Fundido Nodular / Dúctil (GGG 40/50)", category: "Fundición", densityGcm3: 7.10, notes: "Engranajes, piñones y soportes de alto impacto" },
  { id: "aluminum-6061", name: "Aluminio Comercial / Duraluminio (6061-T6 / 5083)", category: "No Ferroso", densityGcm3: 2.70, notes: "Piezas livianas, placas y estructuras navales" },
  { id: "aluminum-7075", name: "Aluminio Aeronáutico (7075-T6)", category: "No Ferroso", densityGcm3: 2.81, notes: "Alta resistencia mecánica y dureza" },
  { id: "bronze-sae64", name: "Bronce Fosfórico Antifricción (SAE 64)", category: "No Ferroso", densityGcm3: 8.80, notes: "Bujes pesados, coronas de sinfín y cojinetes" },
  { id: "bronze-sae68", name: "Bronce al Aluminio / Manganeso (SAE 68)", category: "No Ferroso", densityGcm3: 8.30, notes: "Alta resistencia a desgaste y corrosión marina" },
  { id: "brass-cuzn", name: "Latón Laminado / Mecanizado (CuZn37 / CuZn39)", category: "No Ferroso", densityGcm3: 8.45, notes: "Piezas de gasfitería, torneado rápido y casquillos" },
  { id: "copper-pure", name: "Cobre Electrolítico Puro (99.9%)", category: "No Ferroso", densityGcm3: 8.96, notes: "Barras de distribución eléctrica y electrodos" },
  { id: "lead-pure", name: "Plomo Puro", category: "No Ferroso", densityGcm3: 11.34, notes: "Contrapesos y blindaje radiológico" },
  { id: "titanium-gr5", name: "Titanio Grado 5 (Ti-6Al-4V)", category: "No Ferroso", densityGcm3: 4.43, notes: "Aeroespacial y médico de ultra resistencia" },
  { id: "nylon-poliamida", name: "Nylon 6 / Poliamida / Ertalon", category: "Plástico Técnico", densityGcm3: 1.15, notes: "Bujes plásticos, patines y engranajes silenciosos" },
  { id: "acetal-pom", name: "Poliacetal / Delrin / POM", category: "Plástico Técnico", densityGcm3: 1.41, notes: "Mecanizado de precisión, gran estabilidad dimensional" },
  { id: "teflon-ptfe", name: "Teflón / PTFE", category: "Plástico Técnico", densityGcm3: 2.20, notes: "Empaquetaduras, sellos químicos y alta temperatura" },
  { id: "uhmw-pe", name: "Polietileno UHMW / APM", category: "Plástico Técnico", densityGcm3: 0.94, notes: "Revestimiento tolvas y deslizaderas antidesgaste" }
];

export interface CustomPieceResult {
  shapeName: string;
  volumeCm3: number;
  volumeDm3: number;
  unitWeightKg: number;
  totalWeightKg: number;
  rawStockWeightKg?: number; // Peso del tocho bruto
  machinedScrapKg?: number; // Peso de viruta extraída
  scrapPercentage?: number; // Porcentaje de merma
  surfaceAreaCm2?: number; // Área superficial
}

/**
 * Calcula el peso y volumen exacto de piezas mecánicas personalizadas
 */
export function calculateCustomPiece({
  shape,
  dimensions,
  densityGcm3 = 7.85,
  quantity = 1,
  subtractions = []
}: {
  shape: 
    | "bloque-prisma" 
    | "cilindro-eje" 
    | "buje-tubo-macizo" 
    | "disco-plato" 
    | "brida-flange" 
    | "barra-hexagonal" 
    | "tronco-cono" 
    | "esfera" 
    | "cartela-triangulo" 
    | "cartela-trapecio";
  dimensions: {
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    thicknessMm?: number;
    outerDiameterMm?: number;
    innerDiameterMm?: number;
    diameterMm?: number;
    diameterMajorMm?: number;
    diameterMinorMm?: number;
    hexWidthAcrossFlatsMm?: number;
    baseMajorMm?: number;
    baseMinorMm?: number;
    cornerCutMm?: number;
    numHoles?: number;
    holeDiameterMm?: number;
  };
  densityGcm3: number;
  quantity?: number;
  subtractions?: Array<{
    type: "barreno-cilindrico" | "cajera-rectangular";
    diameterMm?: number;
    lengthMm?: number;
    widthMm?: number;
    depthMm: number;
    qty?: number;
  }>;
}): CustomPieceResult {
  let volumeCm3 = 0;
  let rawStockVolumeCm3 = 0;
  let shapeName = "Pieza Personalizada";
  let surfaceAreaCm2 = 0;

  const d = densityGcm3;
  const qty = Math.max(1, quantity);

  switch (shape) {
    case "bloque-prisma": {
      const l = dimensions.lengthMm || 100;
      const w = dimensions.widthMm || 100;
      const h = dimensions.heightMm || dimensions.thicknessMm || 20;
      volumeCm3 = (l * w * h) / 1000;
      rawStockVolumeCm3 = volumeCm3;
      surfaceAreaCm2 = 2 * ((l * w) + (l * h) + (w * h)) / 100;
      shapeName = `Bloque Prisma ${l}x${w}x${h} mm`;
      break;
    }

    case "cilindro-eje": {
      const od = dimensions.outerDiameterMm || dimensions.diameterMm || 50;
      const l = dimensions.lengthMm || 100;
      const r = od / 2;
      volumeCm3 = (Math.PI * Math.pow(r, 2) * l) / 1000;
      rawStockVolumeCm3 = volumeCm3;
      surfaceAreaCm2 = (2 * Math.PI * Math.pow(r, 2) + 2 * Math.PI * r * l) / 100;
      shapeName = `Eje Cilíndrico ⌀${od} x ${l} mm`;
      break;
    }

    case "buje-tubo-macizo": {
      const od = dimensions.outerDiameterMm || 100;
      const id = dimensions.innerDiameterMm || 50;
      const l = dimensions.lengthMm || 100;
      const rOut = od / 2;
      const rIn = Math.min(rOut - 0.5, id / 2);
      
      const netAreaMm2 = Math.PI * (Math.pow(rOut, 2) - Math.pow(rIn, 2));
      volumeCm3 = (netAreaMm2 * l) / 1000;
      rawStockVolumeCm3 = (Math.PI * Math.pow(rOut, 2) * l) / 1000;
      surfaceAreaCm2 = (2 * Math.PI * rOut * l + 2 * Math.PI * rIn * l + 2 * netAreaMm2) / 100;
      shapeName = `Buje Mecanizado ⌀ext ${od} / ⌀int ${id} x ${l} mm`;
      break;
    }

    case "disco-plato": {
      const od = dimensions.outerDiameterMm || dimensions.diameterMm || 200;
      const th = dimensions.thicknessMm || dimensions.heightMm || 12;
      const r = od / 2;
      volumeCm3 = (Math.PI * Math.pow(r, 2) * th) / 1000;
      rawStockVolumeCm3 = ((od * od) * th) / 1000; // tocho cuadrado de corte
      surfaceAreaCm2 = (2 * Math.PI * Math.pow(r, 2) + Math.PI * od * th) / 100;
      shapeName = `Disco Circular ⌀${od} x e=${th} mm`;
      break;
    }

    case "brida-flange": {
      const od = dimensions.outerDiameterMm || 200;
      const id = dimensions.innerDiameterMm || 80;
      const th = dimensions.thicknessMm || 20;
      const nHoles = dimensions.numHoles || 4;
      const holeD = dimensions.holeDiameterMm || 18;

      const rOut = od / 2;
      const rIn = id / 2;
      const holeR = holeD / 2;

      const baseVolumeMm3 = Math.PI * (Math.pow(rOut, 2) - Math.pow(rIn, 2)) * th;
      const holesVolumeMm3 = nHoles * (Math.PI * Math.pow(holeR, 2) * th);
      
      const netVolumeMm3 = Math.max(0, baseVolumeMm3 - holesVolumeMm3);
      volumeCm3 = netVolumeMm3 / 1000;
      rawStockVolumeCm3 = (Math.PI * Math.pow(rOut, 2) * th) / 1000;
      shapeName = `Brida Flange ⌀${od} / ⌀${id} x ${th}mm (${nHoles}x⌀${holeD})`;
      break;
    }

    case "barra-hexagonal": {
      const s = dimensions.hexWidthAcrossFlatsMm || dimensions.widthMm || 30; // Entre caras
      const l = dimensions.lengthMm || 100;
      // Área hexágono regular: A = (sqrt(3)/2) * s^2 ≈ 0.866025 * s^2
      const areaHexMm2 = (Math.sqrt(3) / 2) * Math.pow(s, 2);
      volumeCm3 = (areaHexMm2 * l) / 1000;
      rawStockVolumeCm3 = volumeCm3;
      surfaceAreaCm2 = (2 * areaHexMm2 + 6 * (s / Math.sqrt(3)) * l) / 100;
      shapeName = `Barra Hexagonal S=${s} mm x ${l} mm`;
      break;
    }

    case "tronco-cono": {
      const d1 = dimensions.diameterMajorMm || 100;
      const d2 = dimensions.diameterMinorMm || 50;
      const h = dimensions.heightMm || dimensions.lengthMm || 80;
      const id = dimensions.innerDiameterMm || 0;

      const r1 = d1 / 2;
      const r2 = d2 / 2;
      // V = (PI * h / 3) * (r1^2 + r1*r2 + r2^2)
      const solidConeMm3 = (Math.PI * h / 3) * (Math.pow(r1, 2) + r1 * r2 + Math.pow(r2, 2));
      const boreMm3 = id > 0 ? Math.PI * Math.pow(id / 2, 2) * h : 0;
      
      volumeCm3 = Math.max(0, solidConeMm3 - boreMm3) / 1000;
      rawStockVolumeCm3 = (Math.PI * Math.pow(Math.max(r1, r2), 2) * h) / 1000;
      shapeName = `Tronco Cónico ⌀${d1}/⌀${d2} x ${h} mm`;
      break;
    }

    case "esfera": {
      const dSph = dimensions.diameterMm || dimensions.outerDiameterMm || 100;
      const r = dSph / 2;
      // V = 4/3 * PI * r^3
      volumeCm3 = ((4 / 3) * Math.PI * Math.pow(r, 3)) / 1000;
      rawStockVolumeCm3 = Math.pow(dSph, 3) / 1000; // bloque cuadrado de partida
      surfaceAreaCm2 = (4 * Math.PI * Math.pow(r, 2)) / 100;
      shapeName = `Esfera Maciza ⌀${dSph} mm`;
      break;
    }

    case "cartela-triangulo": {
      const b = dimensions.widthMm || dimensions.baseMajorMm || 150;
      const h = dimensions.heightMm || 150;
      const th = dimensions.thicknessMm || 10;
      const cut = dimensions.cornerCutMm || 0; // Despunte o chaflán en esquina

      const fullAreaMm2 = (b * h) / 2;
      const cutAreaMm2 = cut > 0 ? (Math.pow(cut, 2) / 2) : 0;
      const netAreaMm2 = Math.max(0, fullAreaMm2 - cutAreaMm2);

      volumeCm3 = (netAreaMm2 * th) / 1000;
      rawStockVolumeCm3 = (b * h * th) / 1000;
      shapeName = `Cartela Triangular ${b}x${h}x${th} mm${cut > 0 ? ` (Despunte ${cut}mm)` : ""}`;
      break;
    }

    case "cartela-trapecio": {
      const b1 = dimensions.baseMajorMm || 200;
      const b2 = dimensions.baseMinorMm || 100;
      const h = dimensions.heightMm || 150;
      const th = dimensions.thicknessMm || 10;

      const areaTrapezoidMm2 = ((b1 + b2) / 2) * h;
      volumeCm3 = (areaTrapezoidMm2 * th) / 1000;
      rawStockVolumeCm3 = (Math.max(b1, b2) * h * th) / 1000;
      shapeName = `Cartela Trapezoidal B1=${b1} B2=${b2} H=${h} e=${th} mm`;
      break;
    }
  }

  // Deduct custom subtractions / pockets / bore holes
  let subtractionsVolumeCm3 = 0;
  if (subtractions && subtractions.length > 0) {
    for (const sub of subtractions) {
      const subQty = sub.qty || 1;
      if (sub.type === "barreno-cilindrico" && sub.diameterMm && sub.depthMm) {
        const rHole = sub.diameterMm / 2;
        const vHole = (Math.PI * Math.pow(rHole, 2) * sub.depthMm) / 1000;
        subtractionsVolumeCm3 += vHole * subQty;
      } else if (sub.type === "cajera-rectangular" && sub.lengthMm && sub.widthMm && sub.depthMm) {
        const vPocket = (sub.lengthMm * sub.widthMm * sub.depthMm) / 1000;
        subtractionsVolumeCm3 += vPocket * subQty;
      }
    }
  }

  const finalVolumeCm3 = Math.max(0.001, volumeCm3 - subtractionsVolumeCm3);
  const volumeDm3 = finalVolumeCm3 / 1000; // litros o dm3

  const unitWeightKg = (finalVolumeCm3 * d) / 1000;
  const totalWeightKg = unitWeightKg * qty;

  const rawStockWeightKg = rawStockVolumeCm3 > 0 ? (rawStockVolumeCm3 * d) / 1000 : unitWeightKg;
  const machinedScrapKg = Math.max(0, rawStockWeightKg - unitWeightKg);
  const scrapPercentage = rawStockWeightKg > 0 ? (machinedScrapKg / rawStockWeightKg) * 100 : 0;

  return {
    shapeName,
    volumeCm3: Number(finalVolumeCm3.toFixed(2)),
    volumeDm3: Number(volumeDm3.toFixed(4)),
    unitWeightKg: Number(unitWeightKg.toFixed(3)),
    totalWeightKg: Number(totalWeightKg.toFixed(3)),
    rawStockWeightKg: Number(rawStockWeightKg.toFixed(3)),
    machinedScrapKg: Number(machinedScrapKg.toFixed(3)),
    scrapPercentage: Number(scrapPercentage.toFixed(1)),
    surfaceAreaCm2: Number(surfaceAreaCm2.toFixed(1))
  };
}


