import { useState, useMemo } from 'react';
import { MaterialStockItem } from '../types';
import {
  Search,
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  MapPin,
  Tag,
  Scissors,
  ArrowRight,
  Filter,
  Check,
  Calculator
} from 'lucide-react';

interface StockLookupModalProps {
  inventory: MaterialStockItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelectProfileForBOM?: (profileCode: string) => void;
}

export const StockLookupModal = ({
  inventory,
  isOpen,
  onClose,
  onSelectProfileForBOM
}: StockLookupModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedItem, setSelectedItem] = useState<MaterialStockItem | null>(null);

  // Quick Cut Feasibility Calculator
  const [calcLengthMm, setCalcLengthMm] = useState<number>(1500);
  const [calcQuantity, setCalcQuantity] = useState<number>(2);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return ['todos', ...Array.from(cats)];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch =
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.dimensions && item.dimensions.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat =
        selectedCategory === 'todos' ||
        item.category?.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCat;
    });
  }, [inventory, searchTerm, selectedCategory]);

  const activeItem = selectedItem || filteredInventory[0] || null;

  // Feasibility calculation for active item
  const feasibility = useMemo(() => {
    if (!activeItem || calcLengthMm <= 0 || calcQuantity <= 0) return null;

    const barLen = activeItem.standardBarLengthMm || 6000;
    const kerf = 3;

    // Check suitable offcuts
    const suitableOffcuts = activeItem.offcuts.filter(
      (off) => off.lengthMm >= calcLengthMm
    );

    // How many pieces can offcuts cover?
    let piecesFromOffcuts = 0;
    suitableOffcuts.forEach((off) => {
      const p = Math.floor((off.lengthMm + kerf) / (calcLengthMm + kerf));
      piecesFromOffcuts += p;
    });

    const remainingPieces = Math.max(0, calcQuantity - piecesFromOffcuts);
    const piecesPerStandardBar = Math.floor((barLen + kerf) / (calcLengthMm + kerf));
    const standardBarsNeeded =
      piecesPerStandardBar > 0
        ? Math.ceil(remainingPieces / piecesPerStandardBar)
        : 0;

    const hasEnoughStock =
      remainingPieces === 0 || activeItem.standardBarsCount >= standardBarsNeeded;

    return {
      piecesFromOffcuts: Math.min(calcQuantity, piecesFromOffcuts),
      remainingPieces,
      standardBarsNeeded,
      piecesPerStandardBar,
      hasEnoughStock,
      suitableOffcutsCount: suitableOffcuts.length
    };
  }, [activeItem, calcLengthMm, calcQuantity]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs font-bold">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Consulta Rápida de Stock en Bodega</span>
                <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  {inventory.length} perfiles
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Verifica existencias de barras completas, despuntes útiles y disponibilidad para cortes inmediatos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código (C250X50X4, D12, L50X50X3), nombre o ubicación..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'todos' ? 'Todas las Categorías' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Body: Split View (List of Materials + Detail Panel) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Material List */}
          <div className="lg:col-span-5 overflow-y-auto p-3 space-y-2 max-h-[40vh] lg:max-h-full">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No se encontraron perfiles</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Intenta con otro término o borra el filtro de búsqueda.
                </p>
              </div>
            ) : (
              filteredInventory.map((item) => {
                const isSelected = activeItem?.id === item.id;
                const hasStock = item.standardBarsCount > 0 || item.offcuts.length > 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{item.code}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">
                            {item.grade || 'A36'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
                          {item.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            hasStock
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {hasStock ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{item.standardBarsCount} b. / {item.offcuts.length} ret.</span>
                            </>
                          ) : (
                            <span>Sin Stock</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Barra: {(item.standardBarLengthMm / 1000)}m</span>
                      {item.location && (
                        <span className="truncate max-w-[150px] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Material Details & Instant Cut Feasibility */}
          {activeItem ? (
            <div className="lg:col-span-7 overflow-y-auto p-4 sm:p-5 space-y-5 bg-slate-50/50">
              {/* Profile Card Header */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900">{activeItem.code}</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                        {activeItem.grade || 'A36'}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize">
                        {activeItem.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{activeItem.name}</p>
                  </div>

                  {activeItem.location && (
                    <div className="text-right bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold">{activeItem.location}</span>
                    </div>
                  )}
                </div>

                {/* Stock Badges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                      Barras Nuevas ({(activeItem.standardBarLengthMm / 1000)}m)
                    </span>
                    <span className="text-xl font-black text-emerald-950 block mt-0.5">
                      {activeItem.standardBarsCount}
                    </span>
                    <span className="text-[10px] text-emerald-700">
                      {((activeItem.standardBarsCount * activeItem.standardBarLengthMm) / 1000).toFixed(1)} m lineales
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-amber-800 block">
                      Retazos Útiles
                    </span>
                    <span className="text-xl font-black text-amber-950 block mt-0.5">
                      {activeItem.offcuts.length}
                    </span>
                    <span className="text-[10px] text-amber-700">
                      {(activeItem.offcuts.reduce((s, o) => s + o.lengthMm, 0) / 1000).toFixed(1)} m aprovechables
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">
                      Peso Teórico
                    </span>
                    <span className="text-base font-black text-slate-900 block mt-0.5">
                      {activeItem.theoreticalWeightPerMeter} kg/m
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Cálculo de estructura
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">
                      Costo Referencial
                    </span>
                    <span className="text-base font-black text-slate-900 block mt-0.5">
                      ${activeItem.costPerMeter ? activeItem.costPerMeter.toLocaleString('es-CL') : '0'} /m
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Para cotizaciones
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Cut Availability Simulator */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                      Verificador de Corte Rápido
                    </span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">
                    ¿Me alcanza el stock actual?
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Largo de la pieza a cortar (mm):
                    </label>
                    <input
                      type="number"
                      value={calcLengthMm}
                      onChange={(e) => setCalcLengthMm(Math.max(10, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Cantidad de piezas requeridas:
                    </label>
                    <input
                      type="number"
                      value={calcQuantity}
                      onChange={(e) => setCalcQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Simulation Result */}
                {feasibility && (
                  <div
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      feasibility.hasEnoughStock
                        ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950'
                        : 'bg-amber-100/90 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {feasibility.hasEnoughStock ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>¡SÍ HAY STOCK SUFICIENTE EN BODEGA!</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>STOCK INSUFICIENTE — REQUIERE COMPRA</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] space-y-0.5">
                      {feasibility.piecesFromOffcuts > 0 && (
                        <div>
                          • Puedes obtener <strong>{feasibility.piecesFromOffcuts} pieza(s)</strong> reutilizando retazos existentes.
                        </div>
                      )}
                      {feasibility.remainingPieces > 0 ? (
                        <div>
                          • Faltan {feasibility.remainingPieces} pieza(s) ➔ Requiere{' '}
                          <strong>{feasibility.standardBarsNeeded} barra(s)</strong> de {(activeItem.standardBarLengthMm / 1000)}m (tienes {activeItem.standardBarsCount} en bodega).
                        </div>
                      ) : (
                        <div>
                          • ¡100% cubierto exclusivamente con retazos de bodega sin cortar barras nuevas!
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed List of Available Offcuts */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-600" />
                    <span>Detalle de Retazos / Despuntes en Bodega ({activeItem.offcuts.length}):</span>
                  </span>
                </div>

                {activeItem.offcuts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No hay despuntes registrados para este perfil.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {activeItem.offcuts.map((offcut, idx) => (
                      <div
                        key={offcut.id || idx}
                        className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-extrabold text-amber-950 text-sm">
                            {offcut.lengthMm} mm{' '}
                            <span className="text-[11px] font-normal text-amber-800">
                              ({(offcut.lengthMm / 1000).toFixed(2)} m)
                            </span>
                          </div>
                          {offcut.tag && (
                            <div className="text-[10px] text-amber-800 flex items-center gap-1 mt-0.5">
                              <Tag className="w-3 h-3" />
                              <span className="font-mono">{offcut.tag}</span>
                            </div>
                          )}
                          {offcut.location && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {offcut.location}
                            </div>
                          )}
                        </div>

                        <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                          Disponible
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-7 flex items-center justify-center p-12 text-slate-400 text-center">
              Selecciona un perfil de la lista izquierda para ver el detalle de stock.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Total en inventario: <strong>{inventory.reduce((s, m) => s + m.standardBarsCount, 0)} barras completas</strong> y{' '}
            <strong>{inventory.reduce((s, m) => s + m.offcuts.length, 0)} retazos</strong>.
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
          >
            Cerrar Consulta
          </button>
        </div>
      </div>
    </div>
  );
};
