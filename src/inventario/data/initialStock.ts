import { MaterialStockItem, BOMProfileGroup } from '../types';

export const INITIAL_STOCK: MaterialStockItem[] = [
  {
    id: 'mat-c250x50x4',
    code: 'C250X50X4',
    name: 'Canal C 250x50x4 mm',
    category: 'perfil_abierto_c',
    dimensions: '250x50x4.0 mm',
    grade: 'A36',
    theoreticalWeightPerMeter: 10.53,
    costPerMeter: 14500,
    standardBarLengthMm: 6000,
    standardBarsCount: 2, // 2 barras de 6m en stock (insuficiente para 18.57m, requerirá compra de 2 barras más)
    minStockBars: 2,
    location: 'Patio Laminados - Caballete C-1',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-c250-1', lengthMm: 2100, location: 'Rack Retazos C', tag: 'RET-C250-01', notes: 'Despunte limpio', createdAt: '2026-08-10' }
    ]
  },
  {
    id: 'mat-ca200x2',
    code: 'CA200X2-AMCS',
    name: 'Costanera CA 200x2 mm (AMCS)',
    category: 'perfil_abierto_c',
    dimensions: '200x50x2.0 mm',
    grade: 'A36',
    theoreticalWeightPerMeter: 5.96,
    costPerMeter: 7800,
    standardBarLengthMm: 6000,
    standardBarsCount: 15, // 15 barras en stock (suficiente para los 66.72m requeridos)
    minStockBars: 4,
    location: 'Patio Perfiles - Rack 3A',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-ca200-1', lengthMm: 3500, location: 'Rack Retazos B', tag: 'RET-CA-01', notes: 'Sobrante techo', createdAt: '2026-08-12' }
    ]
  },
  {
    id: 'mat-d12',
    code: 'D12',
    name: 'Barra Redonda / Fierro D12 mm',
    category: 'barra_solida',
    dimensions: 'Diam 12.0 mm',
    grade: 'A36',
    theoreticalWeightPerMeter: 0.89,
    costPerMeter: 1250,
    standardBarLengthMm: 6000,
    standardBarsCount: 6, // 6 barras (insuficiente para los 63.2m, requerirá comprar 5 barras más)
    minStockBars: 5,
    location: 'Bodega Enfierradura - Rack D',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-d12-1', lengthMm: 2800, location: 'Cajón Fierros', tag: 'RET-D12-01', notes: 'Útil barandilla', createdAt: '2026-08-14' }
    ]
  },
  {
    id: 'mat-l50x50x3',
    code: 'L50X50X3',
    name: 'Ángulo L 50x50x3 mm',
    category: 'angulo_l',
    dimensions: 'L 50x50x3.0 mm',
    grade: 'A36',
    theoreticalWeightPerMeter: 2.22,
    costPerMeter: 2800,
    standardBarLengthMm: 6000,
    standardBarsCount: 8, // 8 barras en stock (suficiente para los 27.02m)
    minStockBars: 3,
    location: 'Bodega Laminados - Caballete 2',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-l50-1', lengthMm: 1600, location: 'Caballete Retazos 2', tag: 'RET-L50-01', notes: 'Soporte', createdAt: '2026-08-11' },
      { id: 'off-l50-2', lengthMm: 1200, location: 'Caballete Retazos 2', tag: 'RET-L50-02', notes: 'Escuadra', createdAt: '2026-08-13' }
    ]
  },
  {
    id: 'mat-l65x3',
    code: 'L65X3',
    name: 'Ángulo L 65x65x3 mm',
    category: 'angulo_l',
    dimensions: 'L 65x65x3.0 mm',
    grade: 'A36',
    theoreticalWeightPerMeter: 2.99,
    costPerMeter: 3900,
    standardBarLengthMm: 6000,
    standardBarsCount: 0, // 0 barras en stock (sin stock, 100% a comprar)
    minStockBars: 2,
    location: 'Bodega Laminados - Caballete 4',
    lastUpdated: new Date().toISOString(),
    offcuts: []
  },
  {
    id: 'mat-tc50502',
    code: 'TC-50502',
    name: 'Tubo Cuadrado 50x50x2 mm',
    category: 'tubular_cuadrado',
    dimensions: '50x50x2.0 mm',
    grade: 'A270ES',
    theoreticalWeightPerMeter: 2.93,
    costPerMeter: 3450,
    standardBarLengthMm: 6000,
    standardBarsCount: 14,
    minStockBars: 5,
    location: 'Patio Perfiles - Rack 1A',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-101', lengthMm: 2450, location: 'Rack Retazos B1', tag: 'RET-01', notes: 'Corte limpio', createdAt: '2026-08-10' },
      { id: 'off-102', lengthMm: 1820, location: 'Rack Retazos B1', tag: 'RET-02', notes: 'Sobrante galpón', createdAt: '2026-08-12' }
    ]
  },
  {
    id: 'mat-tr100502',
    code: 'TR-100502',
    name: 'Tubo Rectangular 100x50x2 mm',
    category: 'tubular_rectangular',
    dimensions: '100x50x2.0 mm',
    grade: 'A270ES',
    theoreticalWeightPerMeter: 4.54,
    costPerMeter: 5400,
    standardBarLengthMm: 6000,
    standardBarsCount: 12,
    minStockBars: 4,
    location: 'Patio Perfiles - Rack 2B',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-301', lengthMm: 2850, location: 'Rack Retazos B2', tag: 'RET-06', notes: 'Cercha', createdAt: '2026-08-08' }
    ]
  },
  {
    id: 'mat-ipe200',
    code: 'VIGA-IPE200',
    name: 'Viga IPE 200',
    category: 'viga_h_i',
    dimensions: 'IPE 200 (h=200, b=100)',
    grade: 'A36',
    theoreticalWeightPerMeter: 22.4,
    costPerMeter: 29500,
    standardBarLengthMm: 12000,
    standardBarsCount: 4,
    minStockBars: 2,
    location: 'Patio Pesado - Caballete Vigas V1',
    lastUpdated: new Date().toISOString(),
    offcuts: [
      { id: 'off-701', lengthMm: 4800, location: 'Patio Pesado Retazos', tag: 'RET-15', notes: 'Sobrante marco 4', createdAt: '2026-08-01' }
    ]
  }
];

// Sample raw BOM text matching the exact image uploaded by the user
export const SAMPLE_USER_BOM_TEXT = `Cantidad\tNombre\tCalidad\tLongitud / mm\tPeso / kg\tÁrea / m2
1\tLim01\tA36\t98\t1.03\t0.07
1\tLim01\tA36\t862\t9.07\t0.58
1\tLim01\tA36\t143\t1.51\t0.1
2\tLim01\tA36\t2 936\t30.9\t1.99
1\tLim01\tA36\t149\t1.57\t0.1
1\tLim01\tA36\t1 750\t18.42\t1.19
2\tLim01\tA36\t4 852\t51.08\t3.29
Perfil : C250X50X4\t9 Lim01\tA36\t18 577\t195.56\t12.6
12\tCA01\tA36\t5 560\t33.14\t4.25
Perfil : CA200X2-AMCS\t12 CA01\tA36\t66 720\t397.74\t50.98
6\tBarandilla\tA36\t2 650\t2.12\t0.1
3\tBarandilla\tA36\t5 564\t4.45\t0.2
3\tBarandilla\tA36\t935\t0.75\t0.03
3\tBarandilla\tA36\t1 701\t1.36\t0.06
3\tBarandilla\tA36\t3 803\t3.04\t0.14
3\tBarandilla\tA36\t865\t0.69\t0.03
3\tBarandilla\tA36\t2 908\t2.32\t0.11
Perfil : D12\t24 Barandilla\tA36\t63 225\t50.54\t2.33
4\tL01\tA36\t460\t1.02\t0.09
20\tL01\tA36\t600\t1.33\t0.12
4\tL01\tA36\t540\t1.2\t0.11
4\tL01\tA36\t338\t0.75\t0.07
20\tL01\tA36\t400\t0.89\t0.08
4\tL01\tA36\t418\t0.93\t0.08
Perfil : L50X50X3\t56 L01\tA36\t27 020\t60.03\t5.27
4\tARR01\tA36\t26 115\t78.11\t6.79
Perfil : L65X3\t4 ARR01\tA36\t26 115\t78.11\t6.79`;

export const CATEGORY_LABELS: Record<string, string> = {
  tubular_cuadrado: 'Tubo Cuadrado',
  tubular_rectangular: 'Tubo Rectangular',
  perfil_abierto_c: 'Costanera / Canal C',
  angulo_l: 'Ángulo L',
  viga_h_i: 'Viga I / H / IN',
  barra_solida: 'Barra Sólida (Redonda/Cuadrada)',
  caneria_redonda: 'Cañería / Tubo Redondo',
  pletina: 'Pletina',
  plancha: 'Plancha',
  perno_conexion: 'Perno / Conexión',
  otro: 'Otro Perfil'
};

export const COLOR_PALETTE = [
  '#2563eb', // blue
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#dc2626', // red
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#16a34a', // green
  '#b91c1c', // dark red
  '#0d9488'  // teal
];
