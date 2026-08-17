import { ChileanSteelGrade, ProfileDefinition, PriceReference, MarketPriceReference } from "../types";
import { CHILEAN_EXPANDED_PROFILES } from "./profilesData";

export const CHILEAN_STEEL_GRADES: ChileanSteelGrade[] = [
  {
    id: "a270es",
    name: "A270ES (Ex A37-24ES)",
    designation: "A270ES (NCh 203)",
    standard: "NCh 203 Of. 2006",
    nchStandard: "NCh 203 Of. 2006",
    astmEquivalent: "ASTM A36 / A1011 CS",
    equivalentStandards: ["ASTM A36", "A1011 CS", "EN 10025 S275JR"],
    yieldStrengthMin: 270,
    yieldStrengthMinMpa: 270,
    tensileStrengthMin: 410,
    tensileStrengthMpa: 410,
    elongationMin: 20,
    elongationMinPercent: 20,
    weldability: "Excelente (sin precalentamiento < 25mm)",
    identificationColor: "Amarillo / Verde Oscuro",
    colorCode: {
      colorName: "Verde Oscuro / Amarillo",
      hex: "#15803d",
      description: "Franja o extremo pintado de color verde oscuro / amarillo en bodegas de CAP / Cintac / distribuidores."
    },
    sparkTest: {
      pattern: "Líneas rectas continuas amarillentas con pocas ramificaciones o estrellas.",
      sparkColor: "Amarillo paja / anaranjado claro",
      burstDensity: "Baja",
      description: "Chispa larga y suave sin explosiones intensas (típico de acero de bajo carbono < 0.25% C)."
    },
    application: "Acero estructural estándar en Chile para edificación, perfiles conformados en frío (Costaneras C/Z), tubos estructurales y cerrajería industrial.",
    usesInChile: [
      "Perfiles conformados en frío (Costaneras C y Z)",
      "Tubos estructurales cuadrados y rectangulares (Cintac / VH)",
      "Planchas delgadas y medianas para cerrajería y galpones",
      "Estructuras metálicas livianas y medianas sin requerimiento sísmico severo"
    ],
    refPricePerKgCLP: 1350
  },
  {
    id: "a345es",
    name: "A345ES (Ex A52-34ES)",
    designation: "A345ES (NCh 203)",
    standard: "NCh 203 Of. 2006",
    nchStandard: "NCh 203 Of. 2006",
    astmEquivalent: "ASTM A572 Gr. 50 / ASTM A992",
    equivalentStandards: ["ASTM A572 Gr. 50", "ASTM A992", "EN 10025 S355JR"],
    yieldStrengthMin: 345,
    yieldStrengthMinMpa: 345,
    tensileStrengthMin: 490,
    tensileStrengthMpa: 490,
    elongationMin: 18,
    elongationMinPercent: 18,
    weldability: "Buena (precalentamiento según espesor t > 20mm)",
    identificationColor: "Azul / Amarillo",
    colorCode: {
      colorName: "Azul y Amarillo",
      hex: "#1d4ed8",
      description: "Extremo pintado con franja azul y amarilla en perfiles laminados y vigas soldadas."
    },
    sparkTest: {
      pattern: "Líneas de chispa más densas con ramilletes moderados al final.",
      sparkColor: "Amarillo brillante a blanco",
      burstDensity: "Media",
      description: "Mayor contenido de aleación (Manganeso/Silicio), genera ramilletes de chispas en el extremo de la trayectoria."
    },
    application: "Estructuras sismorresistentes pesadas, vigas W, columnas compuestas, puentes grúa y marcos rígidos según NCh 2369.",
    usesInChile: [
      "Vigas W y perfiles laminados para edificios y naves industriales",
      "Columnas y vigas soldadas de alma llena (Vigas IN y HN)",
      "Estructuras de minería de alta exigencia sísmica (NCh 2369)",
      "Puentes viales y pasarelas peatonales"
    ],
    refPricePerKgCLP: 1480
  },
  {
    id: "a36",
    name: "ASTM A36",
    designation: "ASTM A36",
    standard: "ASTM A36 / A36M",
    nchStandard: "Equivalente directo a NCh 203 A270ES",
    astmEquivalent: "ASTM A36",
    equivalentStandards: ["NCh 203 A270ES", "DIN 17100 St37-2", "JIS G3101 SS400"],
    yieldStrengthMin: 250,
    yieldStrengthMinMpa: 250,
    tensileStrengthMin: 400,
    tensileStrengthMpa: 400,
    elongationMin: 20,
    elongationMinPercent: 20,
    weldability: "Excelente (electrodo E6011, E7018, MIG ER70S-6)",
    identificationColor: "Verde Claro / Blanco",
    colorCode: {
      colorName: "Verde Claro",
      hex: "#22c55e",
      description: "Marcación estándar de fábrica o estampado térmico."
    },
    sparkTest: {
      pattern: "Líneas continuas con escasas estrellas secundarias.",
      sparkColor: "Amarillo paja",
      burstDensity: "Baja",
      description: "Chispa clásica de acero dulce al carbono estándar."
    },
    application: "Planchas gruesas de unión, placas base, cartelas de conexión, perfiles de ángulo y pletinas laminadas.",
    usesInChile: [
      "Placas base de anclaje para columnas metálicas",
      "Cartelas de unión viga-columna y arriostramientos",
      "Pletinas comerciales y perfiles ángulo laminados",
      "Flanges de estanques y calderería menor"
    ],
    refPricePerKgCLP: 1380
  },
  {
    id: "a630_420h",
    name: "A630-420H (Fierro de Construcción)",
    designation: "A630-420H (NCh 204)",
    standard: "NCh 204 Of. 2006",
    nchStandard: "NCh 204 Of. 2006",
    astmEquivalent: "ASTM A615 Gr. 60 / ASTM A706",
    equivalentStandards: ["ASTM A615 Gr. 60", "ASTM A706 Gr. 60 (Soldable)", "DIN 488 BSt 500 S"],
    yieldStrengthMin: 420,
    yieldStrengthMinMpa: 420,
    tensileStrengthMin: 630,
    tensileStrengthMpa: 630,
    elongationMin: 14,
    elongationMinPercent: 14,
    weldability: "Limitada (Solo con electrodo E7018 o electrodo especial para enfierradura A706)",
    identificationColor: "Negro de laminación con resaltes (resalte 'CAP' o 'AZA' grabado)",
    colorCode: {
      colorName: "Marcado de Resaltes en Relieve",
      hex: "#64748b",
      description: "Barras con resaltes transversales. Letras en alto relieve identifican fabricante (CAP o AZA) y grado 63 (A630-420H)."
    },
    sparkTest: {
      pattern: "Líneas densas con explosiones en ramillete frecuentes (chispas estrelladas).",
      sparkColor: "Amarillo anaranjado brillante",
      burstDensity: "Alta",
      description: "Mayor contenido de carbono (0.35-0.45% C) y manganeso provoca chispas estrelladas en racimo."
    },
    application: "Armaduras de hormigón armado, fundaciones de galpones, pedestales de columnas y losas de maestranza.",
    usesInChile: [
      "Enfierradura de zapatas y pedestales para columnas de acero",
      "Vigas y losas de hormigón armado",
      "Muros de contención y fundaciones continuas",
      "Pernos de anclaje conformados en frío con hilo maquinado (siempre que no se suelde bajo fatiga)"
    ],
    refPricePerKgCLP: 1290
  },
  {
    id: "aisi304",
    name: "Acero Inoxidable AISI 304 (Austenítico)",
    designation: "AISI 304 / EN 1.4301",
    standard: "ASTM A240 / ASTM A276",
    nchStandard: "Norma chilena de inoxidables",
    astmEquivalent: "ASTM A240 / A276",
    equivalentStandards: ["AISI 304", "EN 1.4301 (X5CrNi18-10)", "JIS SUS304"],
    yieldStrengthMin: 205,
    yieldStrengthMinMpa: 205,
    tensileStrengthMin: 515,
    tensileStrengthMpa: 515,
    elongationMin: 40,
    elongationMinPercent: 40,
    weldability: "Excelente (TIG / MIG con aporte ER308L / Electrodo E308L)",
    identificationColor: "No magnético / Acabado brillante o esmerilado",
    colorCode: {
      colorName: "Plateado Brillante / No Magnético",
      hex: "#cbd5e1",
      description: "Acero inoxidable no magnético (el imán no se adhiere). Marcación láser de colada y grado."
    },
    sparkTest: {
      pattern: "Líneas muy cortas de color rojo oscuro sin ramificaciones (muy escasa chispa).",
      sparkColor: "Rojo oscuro a anaranjado apagado",
      burstDensity: "Casi nula",
      description: "El alto contenido de Cromo (18%) y Níquel (8%) inhibe la formación de chispas en esmerilado."
    },
    application: "Industria de alimentos, vitivinícola, agroindustria, química, estanques sanitarios y barandas costeras.",
    usesInChile: [
      "Cubas y estanques para la industria vitivinícola en el valle central",
      "Mesones y tolvas para plantas procesadoras de alimentos y packing",
      "Cañerías y barandas de alta resistencia a la corrosión marina en puertos",
      "Equipos para celulosa y minería de litio"
    ],
    refPricePerKgCLP: 6800
  },
  {
    id: "galvanizado",
    name: "Acero Galvanizado en Caliente (HDG / Zincalum)",
    designation: "ASTM A653 / ASTM A123",
    standard: "ASTM A653 / NCh 222",
    nchStandard: "NCh 222 / NCh 223",
    astmEquivalent: "ASTM A653 CS Tipo B / ASTM A123",
    equivalentStandards: ["ASTM A653 G90", "ASTM A123 (Inmersión en caliente)", "EN 10346 DX51D+Z"],
    yieldStrengthMin: 230,
    yieldStrengthMinMpa: 230,
    tensileStrengthMin: 350,
    tensileStrengthMpa: 350,
    elongationMin: 20,
    elongationMinPercent: 20,
    weldability: "Requiere remover capa de zinc o usar electrodo celulósico E6010 / E6011 con buena ventilación (humos de zinc tóxicos)",
    identificationColor: "Gris zinc con florescencia cristalina (Spangle)",
    colorCode: {
      colorName: "Gris Cincado Plateado",
      hex: "#94a3b8",
      description: "Superficie plateada mate con cristalización de cinc (flores de zinc)."
    },
    sparkTest: {
      pattern: "Llama blanca/verdosa inicial con humo blanco denso al quemar el recubrimiento de cinc, seguido de chispa A36.",
      sparkColor: "Humo blanco de óxido de zinc + chispa amarilla",
      burstDensity: "Baja a Media",
      description: "Desprende humo blanco espeso de óxido de cinc tóxico (fiebre de humos metálicos) durante el esmerilado/corte."
    },
    application: "Costaneras galvanizadas para ambientes húmedos, techumbres (PV4, 5V), ductos y bandejas portacables.",
    usesInChile: [
      "Costaneras galvanizadas para zonas marinas o agrícolas con humedad",
      "Planchas de cubierta ondulada y trapezoidal (PV4, 5V)",
      "Conductos de climatización y bandejas portacables"
    ],
    refPricePerKgCLP: 1850
  }
];

export const STANDARD_CHILEAN_PROFILES: ProfileDefinition[] = CHILEAN_EXPANDED_PROFILES;

export const STANDARD_SHEET_SIZES = [
  { label: "1500 x 3000 mm (1.5 x 3 m Estándar)", width: 1500, length: 3000, desc: "Formato preferido para mesas de corte CNC láser, plasma y maestranzas" },
  { label: "1000 x 3000 mm (1.0 x 3 m Maestranza)", width: 1000, length: 3000, desc: "Formato estándar para plegado de perfiles, canales y cerrajería" },
  { label: "1500 x 6000 mm (1.5 x 6 m Plancha Grande)", width: 1500, length: 6000, desc: "Uso estructural industrial, tolvas de camión y vigas soldadas" },
  { label: "12000 x 2440 mm (12 x 2.44 m Industrial / Astilleros)", width: 2440, length: 12000, desc: "Plancha extra larga para minería, estanques de gran escala y navales" },
  { label: "Personalizada...", width: 0, length: 0, desc: "Dimensiones libres a medida" }
];

export interface ChileanMetricThickness {
  mm: number;
  category: "delgada" | "media" | "gruesa";
  typicalUse: string;
}

export const CHILEAN_COMMERCIAL_THICKNESSES: ChileanMetricThickness[] = [
  // Delgadas / Conformadas en frío / Cerrajería (0.5 mm a 5.0 mm)
  { mm: 0.5, category: "delgada", typicalUse: "Hojalatería fina, ductos de ventilación y zinguería" },
  { mm: 0.6, category: "delgada", typicalUse: "Revestimientos metálicos y hojalatería" },
  { mm: 0.8, category: "delgada", typicalUse: "Puertas metálicas livianas y muebles de taller" },
  { mm: 0.9, category: "delgada", typicalUse: "Cerrajería liviana, gabinetes y tableros eléctricos" },
  { mm: 1.0, category: "delgada", typicalUse: "Mobiliario industrial, bateas y protecciones" },
  { mm: 1.2, category: "delgada", typicalUse: "Portones residenciales, marcos metálicos y cubiertas" },
  { mm: 1.5, category: "delgada", typicalUse: "Canales plegadas, peldaños livianos, tolvas y defensas" },
  { mm: 2.0, category: "delgada", typicalUse: "Estructuras livianas, costaneras, vigas cajón y mesones" },
  { mm: 2.5, category: "delgada", typicalUse: "Canales de alta carga, tolvas de áridos y refuerzos" },
  { mm: 3.0, category: "delgada", typicalUse: "Bases de pilares livianos, pletinas, estanques y defensas" },
  { mm: 4.0, category: "delgada", typicalUse: "Placas intermedias, cartelas de galpón y refuerzos de chasis" },
  { mm: 5.0, category: "delgada", typicalUse: "Placas de nudos, cartelas estructurales y bateas pesadas" },

  // Estructurales medias (6.0 mm a 22.0 mm) - 100% Métrico Comercial Chile (incluye 14mm y 18mm)
  { mm: 6.0, category: "media", typicalUse: "Placas base de galpones, cartelas principales y uniones viga-columna (estándar chileno)" },
  { mm: 8.0, category: "media", typicalUse: "Placas de anclaje, bridas de cañería y refuerzos sísmicos" },
  { mm: 10.0, category: "media", typicalUse: "Placas base de pilares medianos, nervaduras y cartelas de momento" },
  { mm: 12.0, category: "media", typicalUse: "Placas base de galpones de gran luz y uniones apernadas pesadas" },
  { mm: 14.0, category: "media", typicalUse: "Cartelas de unión de momento, nervaduras pesadas y placas base intermedias" },
  { mm: 15.0, category: "media", typicalUse: "Placas de transición y bridas industriales" },
  { mm: 16.0, category: "media", typicalUse: "Placas base pesadas para pilares HEB / Vigas W y nudos sísmicos" },
  { mm: 18.0, category: "media", typicalUse: "Flanges de vigas armadas, orejas de izaje y cartelas de alta rigidez" },
  { mm: 20.0, category: "media", typicalUse: "Fundaciones estructurales, puentes grúa y marcos rígidos" },
  { mm: 22.0, category: "media", typicalUse: "Placas de apoyo para vigas de puentes y calderería pesada" },

  // Planchas Gruesas y Minería (25.0 mm a 100.0 mm)
  { mm: 25.0, category: "gruesa", typicalUse: "Placas de anclaje de gran solicitación sísmica y blindajes" },
  { mm: 28.0, category: "gruesa", typicalUse: "Maquinaria pesada y matrices industriales" },
  { mm: 30.0, category: "gruesa", typicalUse: "Fundaciones para columnas de alta carga en edificación en altura" },
  { mm: 32.0, category: "gruesa", typicalUse: "Bases de puentes viales y nudos críticos NCh 2369" },
  { mm: 35.0, category: "gruesa", typicalUse: "Calderería pesada y recipientes a presión" },
  { mm: 40.0, category: "gruesa", typicalUse: "Placas base de torres y columnas pesadas de minería" },
  { mm: 45.0, category: "gruesa", typicalUse: "Equipos de molienda y chancado minero" },
  { mm: 50.0, category: "gruesa", typicalUse: "Placas de apoyo de gran tonelaje y matrices de forja" },
  { mm: 60.0, category: "gruesa", typicalUse: "Bases para prensas industriales y blindajes especiales" },
  { mm: 70.0, category: "gruesa", typicalUse: "Maquinaria de gran minería y cimentaciones extremas" },
  { mm: 80.0, category: "gruesa", typicalUse: "Soportes de molinos SAG y calderería pesada" },
  { mm: 100.0, category: "gruesa", typicalUse: "Bloques de anclaje macizos y aplicaciones siderúrgicas" }
];

export const STANDARD_GAUGES_MSG = CHILEAN_COMMERCIAL_THICKNESSES.map(t => ({
  gauge: `${t.mm} mm`,
  mm: t.mm,
  fraction: `${t.mm} mm`,
  typicalUse: t.typicalUse
}));

export const MARKET_PRICE_REFERENCES: MarketPriceReference[] = [
  { category: "Planchas", product: "Plancha Negra Lisa A36 / A270ES (1.5mm - 12mm)", unit: "kg", averagePriceCLP: 1380 },
  { category: "Planchas", product: "Plancha Diamantada Antideslizante (2.5mm - 4.0mm)", unit: "kg", averagePriceCLP: 1650 },
  { category: "Planchas", product: "Plancha Inoxidable AISI 304 2B (1.0mm - 3.0mm)", unit: "kg", averagePriceCLP: 6800 },
  { category: "Planchas", product: "Plancha Galvanizada G90 / Zincalum (0.5mm - 2.0mm)", unit: "kg", averagePriceCLP: 1850 },
  { category: "Perfiles", product: "Vigas W (ASTM A6 AISC A36 / A572 Gr 50)", unit: "kg", averagePriceCLP: 1420 },
  { category: "Perfiles", product: "Vigas IN / HN Soldadas (NCh 203 ICHA)", unit: "kg", averagePriceCLP: 1460 },
  { category: "Perfiles", product: "Vigas IPE / IPN Laminadas (DIN 1025)", unit: "kg", averagePriceCLP: 1520 },
  { category: "Perfiles", product: "Canales UPN Laminadas en Caliente", unit: "kg", averagePriceCLP: 1420 },
  { category: "Perfiles", product: "Costaneras C y Z Plegadas (Cintac A270ES)", unit: "kg", averagePriceCLP: 1350 },
  { category: "Perfiles", product: "Ángulos L Laminados (NCh 203 / A36)", unit: "kg", averagePriceCLP: 1390 },
  { category: "Perfiles", product: "Pletinas Laminadas en Caliente (A36)", unit: "kg", averagePriceCLP: 1420 },
  { category: "Barras", product: "Barras Redondas Lisas para Pernos y Barandas (SAE 1020 / A36)", unit: "kg", averagePriceCLP: 1450 },
  { category: "Barras", product: "Barras Cuadradas Macizas (A36)", unit: "kg", averagePriceCLP: 1420 },
  { category: "Fierro Construcción", product: "Fierro Estriado A630-420H (AZA / CAP Ø8 a Ø32mm)", unit: "kg", averagePriceCLP: 1290 },
  { category: "Fierro Construcción", product: "Malla Electrosoldada Acma C-92 / C-139 / C-188", unit: "kg", averagePriceCLP: 1550 },
  { category: "Tubulares", product: "Tubos Cuadrados y Rectangulares (ASTM A500 Gr B)", unit: "kg", averagePriceCLP: 1480 },
  { category: "Tubulares", product: "Cañerías Sch 40 con y sin costura (ASTM A53 Gr B)", unit: "kg", averagePriceCLP: 1720 },
  { category: "Fittings", product: "Codos 90° Butt-Weld Sch 40 (ASTM A234 WPB)", unit: "unidad", averagePriceCLP: 8500 }
];

export const CHILE_MARKET_PRICES_REF: PriceReference[] = [
  {
    category: "Acero Laminado Estructural (A36 / A270ES)",
    description: "Perfiles W, IN, HN, IPE, UPN, Ángulos y Pletinas",
    unit: "kg",
    priceCLP: 1420,
    distributorNotes: "Promedio distribuidores zona central (Santiago, Valparaíso, Biobío)",
    lastUpdated: "Agosto 2026"
  },
  {
    category: "Plancha Negra Lisa A36 / A270ES",
    description: "Espesores métricos de 1.5mm a 25mm (incluye 14mm y 18mm)",
    unit: "kg",
    priceCLP: 1380,
    distributorNotes: "Venta por plancha entera 1000x3000, 1200x2400 o 1500x6000",
    lastUpdated: "Agosto 2026"
  },
  {
    category: "Plancha Diamantada / Antideslizante",
    description: "Espesores 2.0mm, 2.5mm, 3.0mm, 4.0mm",
    unit: "kg",
    priceCLP: 1650,
    distributorNotes: "Ideal para rampas, pisos industriales y peldaños",
    lastUpdated: "Agosto 2026"
  },
  {
    category: "Barras Redondas para Pernos y Barandas",
    description: "Ø 6mm a Ø 50.8mm (2\") SAE 1020 / SAE 1045",
    unit: "kg",
    priceCLP: 1450,
    distributorNotes: "Para fabricación de pernos de anclaje, tensores y barandas de maestranza",
    lastUpdated: "Agosto 2026"
  },
  {
    category: "Codos y Fittings Butt-Weld",
    description: "ASTM A234 WPB Sch 40 & Sch 80",
    unit: "unidad",
    priceCLP: 6500,
    distributorNotes: "Para líneas de piping y barandas de cañería",
    lastUpdated: "Agosto 2026"
  }
];
