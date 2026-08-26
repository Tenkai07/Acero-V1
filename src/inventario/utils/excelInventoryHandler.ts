import * as XLSX from 'xlsx';
import { MaterialStockItem, MaterialCategory, OffcutItem } from '../types';
import { CATEGORY_LABELS } from '../data/initialStock';

export interface ExcelImportResult {
  items: MaterialStockItem[];
  errors: string[];
  totalParsed: number;
}

/**
 * Normaliza nombres de encabezados para detección flexible
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Detecta automáticamente la categoría del perfil a partir de su nombre o código
 */
export function detectCategoryFromText(text: string): MaterialCategory {
  const t = text.toLowerCase();
  if (t.includes('tubo cuad') || t.includes('tc-') || t.includes('cuadrado') || t.match(/\b\d+x\d+x\d+\b/)) {
    return 'tubular_cuadrado';
  }
  if (t.includes('tubo rect') || t.includes('tr-') || t.includes('rectangular')) {
    return 'tubular_rectangular';
  }
  if (t.includes('costanera') || t.includes('canal') || t.startsWith('c') || t.startsWith('ca')) {
    return 'perfil_abierto_c';
  }
  if (t.includes('angulo') || t.startsWith('l') || t.includes(' l ') || t.includes('l50') || t.includes('l65')) {
    return 'angulo_l';
  }
  if (t.includes('viga') || t.includes('ipe') || t.includes('hea') || t.includes('heb') || t.includes('in') || t.includes('hn')) {
    return 'viga_h_i';
  }
  if (t.includes('barra') || t.includes('redondo') || t.includes('fierro') || t.startsWith('d') || t.includes('d12') || t.includes('d16')) {
    return 'barra_solida';
  }
  if (t.includes('caneria') || t.includes('tubo red') || t.includes('pipe')) {
    return 'caneria_redonda';
  }
  if (t.includes('pletina') || t.includes('platina') || t.includes('pl ')) {
    return 'pletina';
  }
  return 'perfil_abierto_c';
}

/**
 * Lee un archivo Excel (.xlsx, .xls) o CSV y lo convierte en lista de MaterialStockItem
 */
export async function readInventoryFromExcel(file: File): Promise<ExcelImportResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawRows.length === 0) {
    throw new Error('La planilla Excel está vacía.');
  }

  // Buscar fila de encabezados (primera fila que tenga texto reconocible)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      const rowStr = row.map((c) => String(c).toLowerCase()).join(' ');
      if (
        rowStr.includes('codigo') ||
        rowStr.includes('perfil') ||
        rowStr.includes('nombre') ||
        rowStr.includes('descripcion') ||
        rowStr.includes('largo') ||
        rowStr.includes('stock') ||
        rowStr.includes('cantidad')
      ) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0; // Si no encuentra coincidencia explícita, asume la fila 0
  }

  const rawHeaders: string[] = (rawRows[headerRowIndex] || []).map((h: any) => String(h || '').trim());
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, colIdx) => {
    const norm = normalizeHeader(h);
    headerMap[norm] = colIdx;
  });

  // Mapeo flexible de columnas
  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      for (const [headerNorm, colIdx] of Object.entries(headerMap)) {
        if (headerNorm === normAlias || headerNorm.includes(normAlias)) {
          return colIdx;
        }
      }
    }
    return -1;
  };

  const colCode = findCol(['codigo', 'cod', 'perfil', 'seccion', 'code', 'id', 'item_code']);
  const colName = findCol(['nombre', 'descripcion', 'descripcion_material', 'material', 'item', 'name']);
  const colCategory = findCol(['categoria', 'tipo', 'familia', 'category']);
  const colDim = findCol(['dimensiones', 'dimension', 'medida', 'medidas', 'seccion_mm', 'dim']);
  const colGrade = findCol(['calidad', 'grado', 'acero', 'grade', 'tipo_acero']);
  const colWeight = findCol(['peso_m', 'peso_teorico', 'peso_kg_m', 'kg_m', 'peso_unitario', 'weight']);
  const colCost = findCol(['precio_m', 'costo_m', 'precio_metro', 'costo_metro', 'costo', 'precio', 'cost']);
  const colLength = findCol(['largo_estandar', 'largo_barra', 'largo_mm', 'largo_m', 'longitud_barra', 'longitud', 'largo']);
  const colStockBars = findCol(['cantidad_barras', 'stock_barras', 'barras_stock', 'stock', 'cantidad', 'cant', 'barras', 'qty']);
  const colMinStock = findCol(['stock_minimo', 'min_stock', 'alerta_minima', 'stock_min']);
  const colLocation = findCol(['ubicacion', 'bodega', 'rack', 'patio', 'posicion', 'location']);
  const colOffcuts = findCol(['retazos', 'despuntes', 'sobrantes', 'retazos_mm', 'offcuts']);

  const items: MaterialStockItem[] = [];
  const errors: string[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row) || row.every((c) => String(c).trim() === '')) {
      continue; // Fila vacía
    }

    const getVal = (col: number, def = ''): string => {
      if (col === -1 || col >= row.length) return def;
      return String(row[col] ?? def).trim();
    };

    const rawCode = getVal(colCode);
    const rawName = getVal(colName);

    if (!rawCode && !rawName) {
      continue; // No tiene identificador
    }

    const code = (rawCode || rawName).replace(/^Perfil\s*:\s*/i, '').trim();
    const name = rawName || `Perfil ${code}`;

    // Parsear largo estándar
    let barLengthMm = 6000;
    const rawLength = getVal(colLength);
    if (rawLength) {
      const cleaned = parseFloat(rawLength.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(cleaned) && cleaned > 0) {
        if (cleaned <= 20) {
          // Si pusieron en metros (ej. 6 o 12)
          barLengthMm = Math.round(cleaned * 1000);
        } else {
          barLengthMm = Math.round(cleaned);
        }
      }
    }

    // Parsear cantidad de barras
    let standardBarsCount = 0;
    const rawStock = getVal(colStockBars);
    if (rawStock) {
      const parsed = parseInt(rawStock.replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        standardBarsCount = parsed;
      }
    }

    // Parsear peso teórico kg/m
    let weightKgM = 0;
    const rawWeight = getVal(colWeight);
    if (rawWeight) {
      const parsed = parseFloat(rawWeight.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        weightKgM = parsed;
      }
    }

    // Parsear costo por metro
    let costPerM = 0;
    const rawCost = getVal(colCost);
    if (rawCost) {
      const parsed = parseFloat(rawCost.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        costPerM = parsed;
      }
    }

    // Parsear stock mínimo
    let minStock = 2;
    const rawMin = getVal(colMinStock);
    if (rawMin) {
      const parsed = parseInt(rawMin.replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        minStock = parsed;
      }
    }

    // Detectar categoría
    let category: MaterialCategory = 'perfil_abierto_c';
    const rawCat = getVal(colCategory);
    if (rawCat) {
      const normCat = rawCat.toLowerCase();
      const matchedKey = Object.keys(CATEGORY_LABELS).find(
        (k) =>
          CATEGORY_LABELS[k].toLowerCase().includes(normCat) ||
          k.toLowerCase().includes(normCat)
      );
      if (matchedKey) {
        category = matchedKey as MaterialCategory;
      } else {
        category = detectCategoryFromText(name + ' ' + code);
      }
    } else {
      category = detectCategoryFromText(name + ' ' + code);
    }

    const dimensions = getVal(colDim) || code;
    const grade = getVal(colGrade) || 'A36';
    const location = getVal(colLocation) || 'Bodega Principal';

    // Parsear retazos / despuntes si existen en la celda
    const offcuts: OffcutItem[] = [];
    const rawOffcuts = getVal(colOffcuts);
    if (rawOffcuts) {
      // Formatos soportados: "1500, 2400, 3100" o "1500; 2400"
      const offcutTokens = rawOffcuts.split(/[,;\n|]/);
      offcutTokens.forEach((tok, idx) => {
        const num = parseInt(tok.replace(/[^\d]/g, ''), 10);
        if (!isNaN(num) && num > 100) {
          offcuts.push({
            id: `off-imp-${Date.now()}-${r}-${idx}`,
            lengthMm: num,
            location: location,
            tag: `RET-${code}-${idx + 1}`,
            notes: 'Importado desde Excel',
            createdAt: new Date().toISOString().split('T')[0]
          });
        }
      });
    }

    items.push({
      id: `mat-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}-${r}`,
      code,
      name,
      category,
      dimensions,
      grade,
      theoreticalWeightPerMeter: weightKgM,
      costPerMeter: costPerM,
      standardBarLengthMm: barLengthMm,
      standardBarsCount,
      minStockBars: minStock,
      location,
      lastUpdated: new Date().toISOString(),
      offcuts
    });
  }

  return {
    items,
    errors,
    totalParsed: items.length
  };
}

/**
 * Genera y descarga la Plantilla Excel (.xlsx) con columnas oficiales y ejemplos prácticos
 */
export function generateSampleInventoryExcel(): void {
  const headers = [
    'Código Perfil',
    'Nombre / Descripción',
    'Categoría',
    'Dimensiones',
    'Calidad Acero',
    'Largo Barra (mm)',
    'Stock Barras Completas',
    'Peso Teórico (kg/m)',
    'Costo por Metro ($)',
    'Stock Mínimo Alerta',
    'Ubicación en Bodega',
    'Retazos Disponibles (mm separados por comas)'
  ];

  const sampleRows = [
    [
      'C250X50X4',
      'Canal C 250x50x4 mm',
      'Costanera / Canal C',
      '250x50x4.0 mm',
      'A36',
      6000,
      2,
      10.53,
      14500,
      2,
      'Patio Laminados - Caballete C-1',
      '2100, 1850'
    ],
    [
      'CA200X2-AMCS',
      'Costanera CA 200x2 mm (AMCS)',
      'Costanera / Canal C',
      '200x50x2.0 mm',
      'A36',
      6000,
      15,
      5.96,
      7800,
      4,
      'Patio Perfiles - Rack 3A',
      '3500'
    ],
    [
      'D12',
      'Barra Redonda / Fierro D12 mm',
      'Barra Sólida (Redonda/Cuadrada)',
      'Diam 12.0 mm',
      'A36',
      6000,
      6,
      0.89,
      1250,
      5,
      'Bodega Enfierradura - Rack D',
      '2800'
    ],
    [
      'L50X50X3',
      'Ángulo L 50x50x3 mm',
      'Ángulo L',
      'L 50x50x3.0 mm',
      'A36',
      6000,
      8,
      2.22,
      2800,
      3,
      'Bodega Laminados - Caballete 2',
      '1600, 1200'
    ],
    [
      'L65X3',
      'Ángulo L 65x65x3 mm',
      'Ángulo L',
      'L 65x65x3.0 mm',
      'A36',
      6000,
      0,
      2.99,
      3900,
      2,
      'Bodega Laminados - Caballete 4',
      ''
    ],
    [
      'TC-50502',
      'Tubo Cuadrado 50x50x2 mm',
      'Tubo Cuadrado',
      '50x50x2.0 mm',
      'A270ES',
      6000,
      14,
      2.93,
      3450,
      5,
      'Patio Perfiles - Rack 1A',
      '2450, 1820'
    ],
    [
      'TR-100502',
      'Tubo Rectangular 100x50x2 mm',
      'Tubo Rectangular',
      '100x50x2.0 mm',
      'A270ES',
      6000,
      12,
      4.54,
      5400,
      4,
      'Patio Perfiles - Rack 2B',
      '2850'
    ],
    [
      'VIGA-IPE200',
      'Viga IPE 200',
      'Viga I / H / IN',
      'IPE 200 (h=200, b=100)',
      'A36',
      12000,
      4,
      22.4,
      29500,
      2,
      'Patio Pesado - Caballete Vigas V1',
      '4800'
    ]
  ];

  const wsData = [headers, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos de columna automáticos
  worksheet['!cols'] = [
    { wch: 18 }, // Código
    { wch: 32 }, // Nombre
    { wch: 24 }, // Categoría
    { wch: 22 }, // Dimensiones
    { wch: 14 }, // Calidad
    { wch: 16 }, // Largo Barra
    { wch: 20 }, // Stock Barras
    { wch: 18 }, // Peso Teórico
    { wch: 18 }, // Costo Metro
    { wch: 18 }, // Stock Mínimo
    { wch: 32 }, // Ubicación
    { wch: 35 }  // Retazos
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario_Maestranza');

  // Hoja 2: Guía explicativa para que la importación funcione a la primera sin errores
  const guideHeaders = ['Columna', '¿Es Obligatoria?', 'Ejemplo de Valor', 'Explicación / Formato'];
  const guideRows = [
    ['Código Perfil', 'SÍ (Clave principal)', 'C250X50X4, CA200X2-AMCS, D12, L50X50X3', 'Código exacto como aparece en tus planos o cubicaciones Tekla/AutoCAD.'],
    ['Nombre / Descripción', 'Recomendado', 'Canal C 250x50x4 mm', 'Nombre comercial o descripción legible del perfil de acero.'],
    ['Categoría', 'Opcional (Auto-detectable)', 'Costanera / Canal C, Ángulo L, Tubo Cuadrado', 'Familia del material. Si lo dejas vacío, el sistema lo detecta del código.'],
    ['Dimensiones', 'Opcional', '250x50x4.0 mm', 'Medidas físicas del perfil.'],
    ['Calidad Acero', 'Opcional (Default A36)', 'A36, A270ES, SAE 1020', 'Norma o grado del acero estructural.'],
    ['Largo Barra (mm)', 'SÍ (Default 6000)', '6000 o 12000', 'Longitud comercial estándar en milímetros (ej: 6000 o 12000).'],
    ['Stock Barras Completas', 'SÍ', '15, 0, 8', 'Número entero de barras nuevas y enteras disponibles hoy en bodega.'],
    ['Peso Teórico (kg/m)', 'Recomendado', '10.53, 5.96, 2.22', 'Kilos por metro lineal. Si no lo tienes, puedes poner 0 y el sistema lo estimará.'],
    ['Costo por Metro ($)', 'Opcional', '14500, 7800, 2800', 'Precio unitario en CLP o USD por metro para costear órdenes de compra.'],
    ['Stock Mínimo Alerta', 'Opcional (Default 2)', '2, 5, 0', 'Umbral para alertas visuales de reorden de compras.'],
    ['Ubicación en Bodega', 'Opcional', 'Patio Laminados - Caballete C-1', 'Rack, pasillo o patio físico donde está almacenado el material.'],
    ['Retazos Disponibles (mm)', 'Opcional (Muy Útil)', '2100, 1850, 3200', 'Largos en milímetros de despuntes utilizables, separados por comas.']
  ];

  const guideWsData = [guideHeaders, ...guideRows];
  const guideWorksheet = XLSX.utils.aoa_to_sheet(guideWsData);
  guideWorksheet['!cols'] = [
    { wch: 26 },
    { wch: 24 },
    { wch: 40 },
    { wch: 65 }
  ];

  XLSX.utils.book_append_sheet(workbook, guideWorksheet, 'GUIA_COLUMNAS');

  XLSX.writeFile(workbook, 'Plantilla_Inventario_Maestranza.xlsx');
}

/**
 * Exporta el inventario activo a un archivo Excel (.xlsx) completo
 */
export function exportInventoryToExcelFile(inventory: MaterialStockItem[]): void {
  const headers = [
    'Código Perfil',
    'Nombre / Descripción',
    'Categoría',
    'Dimensiones',
    'Calidad Acero',
    'Largo Barra (mm)',
    'Stock Barras Completas',
    'Peso Teórico (kg/m)',
    'Costo por Metro ($)',
    'Stock Mínimo Alerta',
    'Ubicación en Bodega',
    'Retazos Disponibles (mm)'
  ];

  const rows = inventory.map((item) => [
    item.code,
    item.name,
    CATEGORY_LABELS[item.category] || item.category,
    item.dimensions,
    item.grade,
    item.standardBarLengthMm,
    item.standardBarsCount,
    item.theoreticalWeightPerMeter,
    item.costPerMeter,
    item.minStockBars,
    item.location,
    item.offcuts.map((o) => `${o.lengthMm}mm`).join(', ')
  ]);

  const wsData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 32 },
    { wch: 24 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 35 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock_Bodega');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Inventario_Bodega_Maestranza_${dateStr}.xlsx`);
}
