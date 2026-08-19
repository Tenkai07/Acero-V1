export type NavigationTab = 
  | "plates" 
  | "pieces"
  | "profiles" 
  | "folding" 
  | "manual" 
  | "converter" 
  | "cnc"
  | "catalog" 
  | "projects";

export type TabType = NavigationTab | "calculators";

export type CalculatorSubTab = "plates" | "profiles" | "folding" | "converter";

export interface ChileanSteelGrade {
  id: string;
  name: string;
  designation?: string;
  standard: string;
  nchStandard?: string;
  astmEquivalent?: string;
  equivalentStandards: string[];
  yieldStrengthMin: number; // MPa
  yieldStrengthMinMpa: number; // Alias for UI
  tensileStrengthMin: number; // MPa
  tensileStrengthMpa: number; // Alias for UI
  elongationMin: number; // %
  elongationMinPercent: number; // Alias for UI
  weldability: string;
  identificationColor: string;
  colorCode?: {
    colorName: string;
    hex: string;
    description: string;
  };
  sparkTest?: {
    pattern: string;
    sparkColor: string;
    burstDensity: "Baja" | "Media" | "Alta" | "Muy Alta" | "Casi nula" | "Baja a Media";
    description: string;
  };
  application: string;
  usesInChile?: string[];
  refPricePerKgCLP: number;
}

export type ProfileCategory = 
  | "viga-w" 
  | "viga-in" 
  | "viga-hn"
  | "viga-hea"
  | "viga-ipe"
  | "viga-ipn" 
  | "canal-c"
  | "canal-u"
  | "canal-laminado-c"
  | "canal-upn" 
  | "costanera-c" 
  | "costanera-z" 
  | "tubo-cuadrado" 
  | "tubo-rectangular" 
  | "tubo-redondo" 
  | "angulo-l" 
  | "barra-redonda-lisa"
  | "barra-redonda" 
  | "barra-cuadrada" 
  | "pletina" 
  | "codo-fitting"
  | "malla-acma";

export interface ProfileDefinition {
  id: string;
  category: ProfileCategory;
  designation: string; // e.g. "W 10x30", "IN 20x15", "Tubo 100x100x3", "Costanera 150x50x15x2.0"
  standard: string; // e.g. "ASTM A6/A36", "NCh 203 / ICHA", "ASTM A500 Gr B"
  unit?: "m" | "unidad" | "tira_6m" | "tira_12m";
  dimensions: {
    h?: number; // Altura / peralte en mm (d o h)
    b?: number; // Ancho de ala / base en mm (bf o b)
    tw?: number; // Espesor del alma en mm
    tf?: number; // Espesor del ala en mm
    t?: number;  // Espesor de pared general en mm
    r?: number;  // Radio de acuerdo / filete en mm
    c?: number;  // Pestaña / labio atiesador en mm (para costanera C/Z)
    diameter?: number; // Diámetro exterior en mm
    side?: number; // Lado en mm (cuadrada)
    width?: number; // Ancho en mm (pletina)
    thickness?: number; // Espesor en mm (pletina)
    centerToFaceMm?: number; // Centro a extremo en mm (para codos)
    bendRadiusMm?: number; // Radio de curvatura R en mm (para codos)
    angleDeg?: number; // Ángulo en grados (90° / 45°)
  };
  weightPerMeterKg: number; // kg/m (o kg/unidad si es fitting)
  weightPerPieceKg?: number; // Peso por unidad si se vende por pieza
  unitWeightKg?: number; // kg por unidad para fittings/codos
  sectionAreaCm2?: number; // cm²
  ix?: number; // Momento de inercia eje X en cm4
  iy?: number; // Momento de inercia eje Y en cm4
  wx?: number; // Módulo de sección Wx en cm3
  wy?: number; // Módulo de sección Wy en cm3
  rx?: number; // Radio de giro ix en cm
  ry?: number; // Radio de giro iy en cm
  standardLengthM: number; // Largo estándar comercial habitual (6m o 12m) o 1 para fittings
  refPriceCLP?: number; // Precio referencial por tira, barra o unidad
}

export interface PlateCalculation {
  id: string;
  title: string;
  plateType: "lisa" | "diamantada" | "inoxidable" | "galvanizada";
  steelGrade: string;
  thicknessMm: number;
  gauge?: string;
  widthMm: number;
  lengthMm: number;
  density: number; // Densidad solicitada: 8.0 kg/dm³ (g/cm³)
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
  areaM2: number;
  totalAreaM2: number;
  estimatedPriceCLP?: number;
  timestamp: number;
  notes?: string;
}

export interface ChannelFoldingCalculation {
  id: string;
  title: string;
  type: "canal-u" | "canal-c-atiesada" | "perfil-z" | "omega" | "angulo";
  thicknessMm: number;
  innerRadiusMm: number;
  kFactor: number;
  webHeightH: number;
  flangeWidthB: number;
  lipWidthC?: number;
  lengthMm: number;
  quantity: number;
  developedWidthMm: number;
  bendDeductionMm: number;
  bendAllowanceMm: number;
  totalWeightKg: number;
  weightPerMeterKg: number;
  recommendedSheetCommercialSize?: string;
  cutsPerStandardSheet?: number;
  scrapPercentage?: number;
  timestamp?: number;
  notes?: string;
}

export interface CalculationHistoryItem {
  id: string;
  category: "placa" | "perfil" | "plegado" | "conversion";
  title: string;
  summary: string;
  details: Record<string, any>;
  weightKg?: number;
  priceCLP?: number;
  timestamp: number | string;
  projectId?: string;
  tags: string[];
}

export type HistoryCalculationItem = CalculationHistoryItem;

export interface SteelProjectItem {
  id: string;
  type: "placa" | "perfil" | "plegado" | "personalizado";
  description: string;
  profileName?: string;
  dimensions: string;
  quantity: number;
  lengthM?: number;
  unitWeightKg: number;
  totalWeightKg: number;
  unitPriceCLP: number;
  totalPriceCLP: number;
  notes?: string;
  createdAt?: string;
}

export type ProjectItem = SteelProjectItem;

export interface SteelProject {
  id: string;
  name: string;
  client?: string;
  clientName?: string;
  location?: string;
  createdAt: number | string;
  updatedAt: number | string;
  steelGradeDefault?: string;
  currency?: "CLP";
  pricePerKgCLP?: number;
  totalWeightKg: number;
  totalPriceCLP: number;
  items: SteelProjectItem[];
  notes?: string;
  status?: "borrador" | "presupuestado" | "en_taller" | "completado";
}

export interface MarketPriceReference {
  category: string;
  product: string;
  unit: string;
  averagePriceCLP: number;
  notes?: string;
}

export interface PriceReference {
  category: string;
  description: string;
  unit: "kg" | "tira_6m" | "tira_12m" | "plancha_1x3" | "plancha_1.5x6" | "m2" | "unidad";
  priceCLP: number;
  distributorNotes: string;
  lastUpdated: string;
}
