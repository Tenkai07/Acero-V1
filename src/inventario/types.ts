export type MaterialCategory =
  | 'tubular_cuadrado'
  | 'tubular_rectangular'
  | 'perfil_abierto_c'
  | 'angulo_l'
  | 'viga_h_i'
  | 'barra_solida'
  | 'caneria_redonda'
  | 'pletina'
  | 'plancha'
  | 'perno_conexion'
  | 'otro';

// Cómo se cuenta el stock de este material. 'barra' es el comportamiento
// histórico (perfiles lineales: largo estándar + barras + retazos por
// longitud). 'plancha' cuenta planchas completas (standardBarsCount =
// planchas en stock, standardBarLengthMm se reutiliza como el LARGO de la
// plancha estándar). 'unidad' es para pernos/conexiones: standardBarsCount =
// unidades sueltas en stock, sin longitud. Es opcional y por defecto 'barra'
// para no romper materiales ya cargados antes de este cambio.
export type MaterialUnitType = 'barra' | 'plancha' | 'unidad';

export interface OffcutItem {
  id: string;
  lengthMm: number;
  location?: string;
  tag?: string;
  notes?: string;
  createdAt: string;
  // Si tiene valor, este retazo específico está apartado para otro proyecto
  // y el Pre-Anidado NO debe ofrecerlo como disponible para cubicaciones
  // nuevas — sigue apareciendo en el listado de bodega, solo que marcado.
  reservedForProject?: string;
}

// Reserva manual de una cantidad (no un ítem físico puntual como el retazo)
// de barras/planchas/unidades de un material, apartada para un proyecto
// específico. A diferencia de offcuts reservados (que son piezas concretas),
// esto descuenta de la cantidad fungible standardBarsCount.
export interface StockReservation {
  id: string;
  projectName: string;
  // Para unitType 'barra'/'unidad': cantidad entera de barras/unidades.
  // Para unitType 'plancha': fracción de plancha (admite decimales, igual
  // que standardBarsCount para planchas).
  quantity: number;
  note?: string;
  createdAt: string;
}

export interface PlateBatch {
  id: string;
  colada: string; // número de colada/talla (columna "Partida o Talla" en Softland)
  cantidadPlanchas: number; // admite decimales: una plancha parcialmente consumida queda como fracción (ej. 0.7 restante)
  fechaIngreso: string;
}

export interface MaterialStockItem {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  dimensions: string; // ej. "50x50x2 mm", "IPE 200", "L 40x40x3 mm", "C250x50x4", "PL 1000x4,00x6000"
  grade: string; // ej. "A36", "A270ES", "SAE 1020"
  theoreticalWeightPerMeter: number; // kg/m (irrelevante si unitType = 'unidad')
  costPerMeter: number; // $CLP o USD (para unitType='unidad' se interpreta como costo por unidad, para 'plancha' costo por plancha completa)
  standardBarLengthMm: number; // default 6000 mm (o 12000 mm); para plancha = largo de la plancha estándar
  standardBarsCount: number; // barras completas / planchas completas (admite decimales) / unidades sueltas, según unitType
  offcuts: OffcutItem[]; // retazos en bodega — SOLO trazabilidad interna de la app; Softland no los conoce y nunca deben incluirse en un export/reporte hacia Softland
  minStockBars: number; // alerta de stock mínimo
  location: string; // ej. "Patio Perfiles - Rack 1A"
  lastUpdated: string;
  unitType?: MaterialUnitType; // por defecto 'barra' si no viene definido
  plateWidthMm?: number; // solo para unitType='plancha': ancho de la plancha estándar
  plateThicknessMm?: number; // solo para unitType='plancha': espesor en mm
  plateBatches?: PlateBatch[]; // solo para unitType='plancha': lotes por colada, para trazabilidad de certificado de material
  softlandCode?: string; // código real de Softland si difiere del "code" interno de la app
  reservations?: StockReservation[]; // cantidad de barras/planchas/unidades ya comprometidas con otros proyectos — se descuentan de lo "disponible" en el Pre-Anidado, pero no del stock físico total
  alternateBarLengthsMm?: number[]; // otros largos comerciales disponibles para este perfil además de standardBarLengthMm (ej. [12000] si además del estándar de 6m se puede comprar de 12m) — habilita la comparación "barra más grande vs. empalme" para piezas que exceden el largo estándar
}

export interface CuttingPieceRequest {
  id: string;
  lengthMm: number;
  quantity: number;
  label: string; // ej. "Lim01", "CA01", "Barandilla", "L01"
  color?: string;
  grade?: string;
  weightKg?: number;
  areaM2?: number;
  originalLengthMm?: number;
  isSpliced?: boolean;
}

export interface OptimizationSettings {
  kerfMm: number; // ancho de sangría de sierra (ej. 3mm) — pérdida normal entre cortes de CUALQUIER perfil
  trimCutMm: number; // saneo inicial / corte de punta (ej. 10mm)
  minUsableOffcutMm: number; // retazo mínimo aprovechable para guardar en bodega (ej. 1000mm)
  prioritizeOffcuts: boolean; // consumir retazos de bodega antes de abrir barras nuevas
  // Si una pieza no cabe en una barra de standardBarLengthMm: habilita comparar
  // "comprar barra comercial más grande" vs. "empalmar" en vez de marcarla
  // directamente como imposible de cubicar.
  allowMultipleStandardLengths?: boolean;
  // Pérdida fija por saneamiento/preparación de los extremos a soldar en CADA
  // empalme (ej. 90mm) — distinta del kerf normal, que sigue aplicando sin
  // cambios al resto de los cortes.
  spliceFacingLossMm?: number;
}

export interface OversizedPieceOption {
  type: 'bigger_bar' | 'splice';
  label: string;
  barLengthUsedMm: number; // largo comercial de la barra principal
  extraSegmentLengthMm?: number; // solo 'splice': largo del tramo corto adicional cortado para completar la pieza
  extraSegmentSource?: 'offcut' | 'new_bar';
  extraSegmentOffcutId?: string;
  totalMaterialConsumedMm: number; // material físico total usado para producir 1 pieza con esta alternativa
  wasteMm: number;
  wastePercentage: number;
  newBarsRequired: number; // barras nuevas a comprar para 1 pieza con esta alternativa
}

export interface OversizedPieceComparison {
  pieceLengthMm: number;
  quantity: number;
  options: OversizedPieceOption[];
  recommendedType: 'bigger_bar' | 'splice'; // la de menor desperdicio (criterio "minimizar desperdicio")
}

export interface CutPieceDetail {
  pieceId: string;
  label: string;
  lengthMm: number;
  color: string;
  cutIndex: number;
  stopPositionMm: number; // medida acumulada de tope de sierra para el operador
  grade?: string;
}

export interface CutBarPlan {
  id: string;
  barIndex: number;
  sourceType: 'stock_offcut' | 'stock_standard_bar' | 'new_purchased_bar';
  sourceLengthMm: number;
  sourceOffcutId?: string;
  sourceLocation?: string;
  cuts: CutPieceDetail[];
  totalCutLengthMm: number;
  kerfTotalMm: number;
  trimCutMm: number;
  remainingMm: number;
  isReusableOffcut: boolean; // true si remainingMm >= minUsableOffcutMm
  efficiencyPercentage: number;
}

export interface OptimizationResult {
  totalBarsUsed: number;
  stockStandardBarsUsed: number;
  stockOffcutsUsed: number;
  newBarsToBuy: number;
  
  totalPiecesCut: number;
  totalPiecesRequested: number;
  
  totalRawMaterialLengthMm: number;
  totalUsefulCutsLengthMm: number;
  totalKerfLossMm: number;
  totalTrimLossMm: number;
  totalReusableOffcutsLengthMm: number;
  totalScrapWasteLengthMm: number;
  
  overallEfficiencyPercentage: number;
  totalWeightKg: number;
  wasteWeightKg: number;
  estimatedCost: number;
  
  barPlans: CutBarPlan[];
  generatedOffcuts: { lengthMm: number; barIndex: number }[];
  missingPieces: CuttingPieceRequest[];
  // Piezas que exceden standardBarLengthMm y para las que se evaluó la
  // alternativa "barra comercial más grande" vs. "empalme" (solo si
  // settings.allowMultipleStandardLengths está activo).
  oversizedPieceComparisons?: OversizedPieceComparison[];
}

export interface RealtimeStockCheck {
  status: 'available' | 'partial' | 'out_of_stock';
  totalLinearMetersNeeded: number;
  totalLinearMetersAvailableInStock: number;
  standardBarsAvailable: number;
  standardBarsNeededEstimated: number;
  offcutsAvailableCount: number;
  offcutsAvailableMeters: number;
  canFulfillWithCurrentStock: boolean;
  shortageMeters: number;
  shortageBars: number;
  message: string;
}

// Multi-Profile BOM Structure matching Tekla / AutoCAD Structural Detailing
export interface BOMPieceItem {
  id: string;
  itemNumber: string; // ej. "Lim01", "CA01", "Barandilla", "L01", "ARR01"
  grade: string; // ej. "A36"
  lengthMm: number;
  quantity: number;
  weightKg: number;
  areaM2: number;
  originalLengthMm?: number;
  isSpliced?: boolean;
  spliceSegments?: { lengthMm: number; quantity: number }[];
}

export interface BOMProfileGroup {
  id: string;
  profileName: string; // ej. "Perfil : C250X50X4", "Perfil : CA200X2-AMCS", "Perfil : D12", "Perfil : L50X50X3", "Perfil : L65X3"
  cleanProfileCode: string; // ej. "C250X50X4"
  matchedMaterialId?: string; // id del inventario si existe
  commercialBarLengthMm: number; // 6000 o 12000 mm
  pieces: BOMPieceItem[];
  totalPiecesCount: number;
  totalLengthMm: number;
  totalWeightKg: number;
  totalAreaM2: number;
  
  // Pre-nesting / Pre-anidado result (Optimizado con Stock de Bodega)
  nestingResult?: OptimizationResult;
  
  // Anidado Teórico Puro 1D (100% barras nuevas del proyecto, sin stock de bodega)
  pureTheoreticalNestingResult?: OptimizationResult;
  
  // Stock comparison result
  stockComparison?: {
    status: 'in_stock' | 'need_buy' | 'not_in_catalog';
    stockBarsAvailable: number;
    stockOffcutsAvailable: number;
    // Barras/planchas y retazos que existen físicamente en bodega pero están
    // reservados para otro proyecto — no se restan del stock físico, solo se
    // excluyen de lo "disponible" para esta cubicación. Se muestran aparte
    // para que el usuario sepa por qué el sistema no los ofreció.
    stockBarsReserved: number;
    stockOffcutsReserved: number;
    barsNeededTotal: number;
    barsFromStock: number;
    offcutsFromStock: number;
    barsToBuy: number;
    metersToBuy: number;
    weightToBuyKg: number;
    message: string;
  };
}

export interface ProjectMaterialConsumption {
  id: string;
  materialId: string; // referencia al MaterialStockItem
  materialCode: string;
  materialName: string;
  unitType: MaterialUnitType; // 'plancha' o 'unidad' — perfiles siguen su propio flujo de nesting
  quantity: number; // pernos: unidades enteras. planchas: fracción/equivalente en planchas completas (ej. 0.3 = 30% de una plancha)
  colada?: string; // solo para planchas: de qué colada/lote específico se descontó, para trazabilidad de certificado de material
  registeredAt: string;
  notes?: string;
}

export interface BOMProject {
  id: string;
  name: string;
  client?: string;
  workOrder?: string;
  date: string;
  notes?: string;
  totalProfilesCount: number;
  totalPiecesCount: number;
  totalWeightKg: number;
  totalBarsTheoretical: number;
  totalBarsToBuy: number;
  rawBOMText?: string;
  groups: BOMProfileGroup[];
  settings: OptimizationSettings;
  createdAt: string;
  status?: 'cotizacion' | 'en_fabricacion' | 'completado' | 'guardado';
  // Clasificación explícita para reportes: distingue una cubicación que
  // efectivamente se ejecutó/comprará (esReal=true) de una teórica —
  // simulación, cotización exploratoria, o proyecto que finalmente no se
  // concretó (esReal=false). Es independiente de "status" (que describe la
  // etapa de fabricación); el objetivo es que un informe mensual no mezcle
  // consumo/costo real con estimaciones que nunca ocurrieron.
  esReal?: boolean;
  // Vincula este proyecto de cubicación con un presupuesto/proyecto de
  // Acero-V1 (SteelProject), para poder comparar costo real de materiales
  // vs. lo cotizado en el reporte de Rentabilidad. Opcional: no todos los
  // proyectos de cubicación necesitan estar ligados a un presupuesto.
  linkedSteelProjectId?: string;
  // Consumo de planchas y pernos registrado para este proyecto (trazabilidad
  // "esto se gastó en la obra X"). El consumo de perfiles ya queda registrado
  // vía el flujo de Pre-anidado/Compras existente y no se duplica aquí.
  additionalConsumption?: ProjectMaterialConsumption[];
}

export interface SavedProject {
  id: string;
  name: string;
  client?: string;
  workOrder?: string;
  date: string;
  materialId: string;
  pieces: CuttingPieceRequest[];
  settings: OptimizationSettings;
  result?: OptimizationResult;
  status: 'borrador' | 'optimizado' | 'descontado_inventario';
}
