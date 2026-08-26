import { useState, useMemo, FormEvent, DragEvent } from 'react';
import { MaterialStockItem, MaterialCategory, OffcutItem } from '../types';
import { CATEGORY_LABELS } from '../data/initialStock';
import { getAvailableBarsCount, getReservedBarsCount } from '../utils/stockReservations';
import {
  readInventoryFromExcel,
  generateSampleInventoryExcel,
  exportInventoryToExcelFile
} from '../utils/excelInventoryHandler';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  MapPin,
  Trash2,
  CornerDownRight,
  Download,
  Upload,
  X,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  HelpCircle,
  FileDown,
  RefreshCw,
  Edit3,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Lock,
  Unlock
} from 'lucide-react';

interface InventoryViewProps {
  inventory: MaterialStockItem[];
  onUpdateInventory: (updated: MaterialStockItem[]) => void;
  onSelectForCubicacion?: (materialId: string) => void;
}

export const InventoryView = ({
  inventory,
  onUpdateInventory
}: InventoryViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Material Details & Offcut Modal
  const [selectedMaterialForOffcut, setSelectedMaterialForOffcut] = useState<MaterialStockItem | null>(null);

  // New / Edit Material Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<MaterialStockItem>>({
    code: '',
    name: '',
    category: 'tubular_cuadrado',
    dimensions: '',
    grade: 'A36',
    theoreticalWeightPerMeter: 3.5,
    costPerMeter: 4000,
    standardBarLengthMm: 6000,
    standardBarsCount: 10,
    minStockBars: 4,
    location: 'Patio Perfiles - Rack 1'
  });

  // Offcut input fields
  const [newOffcutLength, setNewOffcutLength] = useState<number>(1500);
  const [newOffcutTag, setNewOffcutTag] = useState<string>('');
  const [newOffcutLocation, setNewOffcutLocation] = useState<string>('Rack Retazos A');
  const [newOffcutNotes, setNewOffcutNotes] = useState<string>('');

  // Reservation input fields (barras/planchas/unidades apartadas para otro proyecto)
  const [newReservationProject, setNewReservationProject] = useState<string>('');
  const [newReservationQty, setNewReservationQty] = useState<number>(1);
  const [newReservationNote, setNewReservationNote] = useState<string>('');

  // Excel Import State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelPreviewItems, setExcelPreviewItems] = useState<MaterialStockItem[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelImportMode, setExcelImportMode] = useState<'replace' | 'merge'>('replace');
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);

  // Quick adjust standard bars count
  const handleAdjustBars = (id: string, delta: number) => {
    const updated = inventory.map((item) => {
      if (item.id !== id) return item;
      const newCount = Math.max(0, item.standardBarsCount + delta);
      return { ...item, standardBarsCount: newCount, lastUpdated: new Date().toISOString() };
    });
    onUpdateInventory(updated);
  };

  // Add new offcut to a material
  const handleAddOffcut = () => {
    if (!selectedMaterialForOffcut || newOffcutLength <= 0) return;

    const newOffcut: OffcutItem = {
      id: `off-${Date.now()}`,
      lengthMm: newOffcutLength,
      location: newOffcutLocation || selectedMaterialForOffcut.location,
      tag: newOffcutTag || `RET-${Math.floor(100 + Math.random() * 900)}`,
      notes: newOffcutNotes,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = inventory.map((item) => {
      if (item.id !== selectedMaterialForOffcut.id) return item;
      return {
        ...item,
        offcuts: [...item.offcuts, newOffcut],
        lastUpdated: new Date().toISOString()
      };
    });

    onUpdateInventory(updated);
    setSelectedMaterialForOffcut(
      updated.find((m) => m.id === selectedMaterialForOffcut.id) || null
    );
    setNewOffcutLength(1500);
    setNewOffcutNotes('');
    setNewOffcutTag('');
  };

  // Remove offcut from a material
  const handleRemoveOffcut = (materialId: string, offcutId: string) => {
    const updated = inventory.map((item) => {
      if (item.id !== materialId) return item;
      return {
        ...item,
        offcuts: item.offcuts.filter((o) => o.id !== offcutId),
        lastUpdated: new Date().toISOString()
      };
    });

    onUpdateInventory(updated);
    if (selectedMaterialForOffcut?.id === materialId) {
      setSelectedMaterialForOffcut(updated.find((m) => m.id === materialId) || null);
    }
  };

  // Apartar una cantidad de barras/planchas/unidades para otro proyecto
  const handleAddReservation = () => {
    if (!selectedMaterialForOffcut || !newReservationProject.trim() || newReservationQty <= 0) return;

    const newReservation = {
      id: `res-${Date.now()}`,
      projectName: newReservationProject.trim(),
      quantity: newReservationQty,
      note: newReservationNote.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = inventory.map((item) => {
      if (item.id !== selectedMaterialForOffcut.id) return item;
      return {
        ...item,
        reservations: [...(item.reservations || []), newReservation],
        lastUpdated: new Date().toISOString()
      };
    });

    onUpdateInventory(updated);
    setSelectedMaterialForOffcut(
      updated.find((m) => m.id === selectedMaterialForOffcut.id) || null
    );
    setNewReservationProject('');
    setNewReservationQty(1);
    setNewReservationNote('');
  };

  // Liberar una reserva (el material vuelve a estar disponible)
  const handleRemoveReservation = (materialId: string, reservationId: string) => {
    const updated = inventory.map((item) => {
      if (item.id !== materialId) return item;
      return {
        ...item,
        reservations: (item.reservations || []).filter((r) => r.id !== reservationId),
        lastUpdated: new Date().toISOString()
      };
    });

    onUpdateInventory(updated);
    if (selectedMaterialForOffcut?.id === materialId) {
      setSelectedMaterialForOffcut(updated.find((m) => m.id === materialId) || null);
    }
  };

  // Marcar/liberar un retazo puntual como reservado para otro proyecto
  const handleToggleOffcutReservation = (materialId: string, offcutId: string) => {
    const material = inventory.find((m) => m.id === materialId);
    const offcut = material?.offcuts.find((o) => o.id === offcutId);
    if (!material || !offcut) return;

    let projectName: string | undefined;
    if (!offcut.reservedForProject) {
      const input = window.prompt('¿Para qué proyecto se aparta este retazo?');
      if (!input || !input.trim()) return;
      projectName = input.trim();
    }

    const updated = inventory.map((item) => {
      if (item.id !== materialId) return item;
      return {
        ...item,
        offcuts: item.offcuts.map((o) =>
          o.id !== offcutId ? o : { ...o, reservedForProject: projectName }
        ),
        lastUpdated: new Date().toISOString()
      };
    });

    onUpdateInventory(updated);
    if (selectedMaterialForOffcut?.id === materialId) {
      setSelectedMaterialForOffcut(updated.find((m) => m.id === materialId) || null);
    }
  };

  // Delete profile from catalog
  const handleDeleteMaterial = (id: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este perfil del inventario?')) {
      onUpdateInventory(inventory.filter((m) => m.id !== id));
    }
  };

  // Open Edit Material
  const handleOpenEdit = (item: MaterialStockItem) => {
    setEditingMaterialId(item.id);
    setNewMaterial({ ...item });
    setShowAddModal(true);
  };

  // Create or Update profile in catalog
  const handleSaveMaterial = (e: FormEvent) => {
    e.preventDefault();
    if (!newMaterial.name || !newMaterial.code) {
      alert('Por favor ingresa al menos el código y nombre del perfil.');
      return;
    }

    if (editingMaterialId) {
      // Edit existing
      const updated = inventory.map((item) => {
        if (item.id !== editingMaterialId) return item;
        return {
          ...item,
          code: newMaterial.code || item.code,
          name: newMaterial.name || item.name,
          category: (newMaterial.category as MaterialCategory) || item.category,
          dimensions: newMaterial.dimensions || item.dimensions,
          grade: newMaterial.grade || item.grade,
          theoreticalWeightPerMeter: Number(newMaterial.theoreticalWeightPerMeter) || item.theoreticalWeightPerMeter,
          costPerMeter: Number(newMaterial.costPerMeter) || item.costPerMeter,
          standardBarLengthMm: Number(newMaterial.standardBarLengthMm) || item.standardBarLengthMm,
          standardBarsCount: Number(newMaterial.standardBarsCount) || item.standardBarsCount,
          minStockBars: Number(newMaterial.minStockBars) || item.minStockBars,
          location: newMaterial.location || item.location,
          alternateBarLengthsMm: newMaterial.alternateBarLengthsMm,
          lastUpdated: new Date().toISOString()
        };
      });
      onUpdateInventory(updated);
      setEditingMaterialId(null);
    } else {
      // Create new
      const itemToAdd: MaterialStockItem = {
        id: `mat-${Date.now()}`,
        code: newMaterial.code || `MAT-${Date.now()}`,
        name: newMaterial.name || 'Nuevo Perfil',
        category: (newMaterial.category as MaterialCategory) || 'tubular_cuadrado',
        dimensions: newMaterial.dimensions || '50x50x2 mm',
        grade: newMaterial.grade || 'A36',
        theoreticalWeightPerMeter: Number(newMaterial.theoreticalWeightPerMeter) || 3.0,
        costPerMeter: Number(newMaterial.costPerMeter) || 3500,
        standardBarLengthMm: Number(newMaterial.standardBarLengthMm) || 6000,
        standardBarsCount: Number(newMaterial.standardBarsCount) || 0,
        minStockBars: Number(newMaterial.minStockBars) || 3,
        location: newMaterial.location || 'Bodega Principal',
        lastUpdated: new Date().toISOString(),
        offcuts: [],
        alternateBarLengthsMm: newMaterial.alternateBarLengthsMm
      };
      onUpdateInventory([itemToAdd, ...inventory]);
    }

    setShowAddModal(false);
  };

  // Process Excel File Selection
  const handleProcessExcelFile = async (file: File) => {
    setExcelLoading(true);
    setExcelErrorMsg(null);
    try {
      setExcelFileName(file.name);
      const result = await readInventoryFromExcel(file);
      if (result.items.length === 0) {
        setExcelErrorMsg('No se detectaron perfiles válidos en la planilla. Verifica los encabezados de columna.');
        setExcelPreviewItems([]);
      } else {
        setExcelPreviewItems(result.items);
      }
    } catch (err: any) {
      setExcelErrorMsg(err.message || 'Error al procesar el archivo Excel.');
      setExcelPreviewItems([]);
    } finally {
      setExcelLoading(false);
    }
  };

  const handleExcelDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyExcelImport = () => {
    if (excelPreviewItems.length === 0) return;

    if (excelImportMode === 'replace') {
      onUpdateInventory(excelPreviewItems);
    } else {
      // Merge mode: update existing with same code/name and append new
      const merged = [...inventory];
      excelPreviewItems.forEach((newItem) => {
        const existingIdx = merged.findIndex(
          (m) =>
            m.code.trim().toUpperCase() === newItem.code.trim().toUpperCase() ||
            m.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()
        );
        if (existingIdx >= 0) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            ...newItem,
            id: merged[existingIdx].id, // preserve existing id
            offcuts: [...merged[existingIdx].offcuts, ...newItem.offcuts]
          };
        } else {
          merged.push(newItem);
        }
      });
      onUpdateInventory(merged);
    }

    setShowExcelModal(false);
    setExcelPreviewItems([]);
    setExcelFileName('');
  };

  // Export JSON backup
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(inventory, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-maestranza-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered inventory
  const filteredList = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.dimensions.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        categoryFilter === 'todos' || item.category === categoryFilter;

      const matchLowStock = !showLowStockOnly || item.standardBarsCount <= item.minStockBars;

      return matchSearch && matchCategory && matchLowStock;
    });
  }, [inventory, searchTerm, categoryFilter, showLowStockOnly]);

  const categories = Object.keys(CATEGORY_LABELS);

  const totalBarsInStock = useMemo(() => {
    return inventory.reduce((sum, item) => sum + item.standardBarsCount, 0);
  }, [inventory]);

  const totalOffcutsInStock = useMemo(() => {
    return inventory.reduce((sum, item) => sum + item.offcuts.length, 0);
  }, [inventory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header with Search and Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Módulo 5
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                <span>Base de Datos de Bodega (Inventario en Tiempo Real)</span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Catálogo de perfiles estructurales, stock de barras comerciales y registro exacto de retazos útiles.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Guide Button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-colors font-medium ${
                showGuide
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>¿Cómo ingresar datos?</span>
            </button>

            {/* Download Excel Template */}
            <button
              onClick={generateSampleInventoryExcel}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl border border-emerald-300 flex items-center gap-1.5 transition-colors font-semibold"
              title="Descarga una plantilla de Excel con las columnas requeridas y ejemplos"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Descargar Plantilla Excel</span>
            </button>

            {/* Upload Excel */}
            <button
              onClick={() => {
                setShowExcelModal(true);
                setExcelPreviewItems([]);
                setExcelErrorMsg(null);
              }}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-2 rounded-xl border border-blue-300 flex items-center gap-1.5 transition-colors font-bold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Cargar Excel / CSV</span>
            </button>

            {/* Export Options */}
            <button
              onClick={() => exportInventoryToExcelFile(inventory)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors"
              title="Exportar inventario actual a archivo Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            {/* New Manual Material */}
            <button
              id="add-material-modal-btn"
              onClick={() => {
                setEditingMaterialId(null);
                setNewMaterial({
                  code: '',
                  name: '',
                  category: 'perfil_abierto_c',
                  dimensions: '',
                  grade: 'A36',
                  theoreticalWeightPerMeter: 3.5,
                  costPerMeter: 4000,
                  standardBarLengthMm: 6000,
                  standardBarsCount: 10,
                  minStockBars: 4,
                  location: 'Patio Perfiles - Rack 1'
                });
                setShowAddModal(true);
              }}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Perfil</span>
            </button>
          </div>
        </div>

        {/* Global Summary Stats Pill */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 flex-wrap text-xs text-slate-600">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Perfiles en Catálogo: <strong className="text-slate-900 font-bold">{inventory.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total Barras Completas: <strong className="text-slate-900 font-bold">{totalBarsInStock}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
            <CornerDownRight className="w-3.5 h-3.5 text-amber-600" />
            <span>Total Retazos Registrados: <strong className="text-slate-900 font-bold">{totalOffcutsInStock} pzas</strong></span>
          </div>
        </div>

        {/* Interactive Step-by-Step Guide Panel */}
        {showGuide && (
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-5 text-xs text-slate-800 animate-fadeIn">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  Guía: Cómo ingresar o actualizar la Base de Datos de tu Bodega
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white/80 border border-blue-100 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">1</span>
                  <span>Descarga la Plantilla</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Haz clic en <strong className="text-emerald-700">"Descargar Plantilla Excel"</strong>. Te entregará un archivo <code>.xlsx</code> con las columnas oficiales listas para rellenar (Código, Nombre, Largo, Stock de Barras, Retazos, etc.).
                </p>
              </div>

              <div className="bg-white/80 border border-blue-100 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">2</span>
                  <span>Completa tus Existencias</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Escribe en Excel tus códigos (ej: <code>C250X50X4</code>, <code>CA200X2-AMCS</code>, <code>D12</code>, <code>L50X50X3</code>, <code>L65X3</code>). En la columna <em>Retazos</em> puedes ingresar largos separados por comas (ej: <code>2100, 1850</code>).
                </p>
              </div>

              <div className="bg-white/80 border border-blue-100 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">3</span>
                  <span>Sube el Archivo Excel</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Haz clic en <strong className="text-blue-700">"Cargar Excel / CSV"</strong> y arrastra tu archivo. Podrás previsualizar los perfiles antes de confirmar y elegir si deseas <em>reemplazar</em> o <em>fusionar</em> con lo existente.
                </p>
              </div>
            </div>

            <div className="mt-3 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2 text-[11px] text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Tip de Vinculación:</strong> Cuando importes una planilla de cubicación en el Módulo 1, el sistema cruzará automáticamente los nombres y códigos de los perfiles con este inventario para calcular qué tienes en bodega y qué barras debes comprar.
              </span>
            </div>
          </div>
        )}

        {/* Search and Category Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código (C250, D12, L50, CA200), nombre, medida o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="todos">Todas las Categorías</option>
              {categories.map((catKey) => (
                <option key={catKey} value={catKey}>
                  {CATEGORY_LABELS[catKey]}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`text-xs px-3 py-2.5 rounded-xl border flex items-center gap-1.5 transition-colors ${
                showLowStockOnly
                  ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                  : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Stock Crítico</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Items List */}
      <div className="grid grid-cols-1 gap-3.5">
        {filteredList.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
            <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-600 text-sm font-medium">No se encontraron materiales con los filtros aplicados.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('todos');
                setShowLowStockOnly(false);
              }}
              className="mt-3 text-xs text-blue-600 font-bold hover:underline"
            >
              Limpiar filtros de búsqueda
            </button>
          </div>
        ) : (
          filteredList.map((item) => {
            const isLowStock = item.standardBarsCount <= item.minStockBars;
            const offcutsTotalM = Number(
              (item.offcuts.reduce((s, o) => s + o.lengthMm, 0) / 1000).toFixed(2)
            );

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 transition-all hover:border-slate-300 shadow-2xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-blue-800 text-xs bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        {item.code}
                      </span>
                      <span className="text-xs text-slate-600 font-medium px-2 py-0.5 rounded bg-slate-100">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                      {isLowStock && (
                        <span className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Stock Bajo (Mín: {item.minStockBars})</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900">{item.name}</h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span>Dimensión: <strong className="text-slate-800">{item.dimensions}</strong></span>
                      <span>Calidad: <strong className="text-slate-800">{item.grade}</strong></span>
                      <span>Peso: <strong className="text-slate-800">{item.theoreticalWeightPerMeter} kg/m</strong></span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <strong className="text-slate-700">{item.location}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Stock Counters & Quick Actions */}
                  <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {/* Standard Bars Counter */}
                    <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-center min-w-[130px]">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                        Barras ({item.standardBarLengthMm / 1000}m)
                      </span>
                      <div className="flex items-center justify-center gap-2 mt-0.5">
                        <button
                          onClick={() => handleAdjustBars(item.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold flex items-center justify-center transition-colors"
                          title="Restar 1 barra"
                        >
                          -
                        </button>
                        <span className="text-lg font-black text-slate-900 font-mono px-1">
                          {item.standardBarsCount}
                        </span>
                        <button
                          onClick={() => handleAdjustBars(item.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold flex items-center justify-center transition-colors"
                          title="Sumar 1 barra"
                        >
                          +
                        </button>
                      </div>
                      {getReservedBarsCount(item) > 0 && (
                        <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-amber-700">
                          <Lock className="w-3 h-3" />
                          <span>{getAvailableBarsCount(item)} disponibles ({getReservedBarsCount(item)} reservadas)</span>
                        </div>
                      )}
                    </div>

                    {/* Offcuts Count and Trigger */}
                    <button
                      onClick={() => setSelectedMaterialForOffcut(item)}
                      className="bg-amber-50 hover:bg-amber-100/80 px-3.5 py-2 rounded-xl border border-amber-200 text-left min-w-[130px] transition-all"
                    >
                      <span className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider block">
                        Retazos en Bodega
                      </span>
                      <div className="text-sm sm:text-base font-bold text-amber-900 mt-0.5 flex items-center gap-1.5">
                        <span>{item.offcuts.length} pzas</span>
                        <span className="text-xs font-normal text-amber-700 font-mono">({offcutsTotalM}m)</span>
                      </div>
                    </button>

                    {/* Actions menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar perfil"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(item.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar del inventario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Offcuts list preview strip */}
                {item.offcuts.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-xs">
                    <CornerDownRight className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="text-slate-500 text-[11px] font-medium">Retazos en patio:</span>
                    {item.offcuts.slice(0, 8).map((off) => (
                      <span
                        key={off.id}
                        className="bg-amber-50 border border-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold"
                      >
                        {off.lengthMm} mm {off.tag ? `[${off.tag}]` : ''}
                      </span>
                    ))}
                    {item.offcuts.length > 8 && (
                      <span className="text-slate-400 text-[11px]">+{item.offcuts.length - 8} más...</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Excel Upload Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Cargar Inventario de Perfiles desde Excel (.xlsx / .xls / .csv)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Carga masiva de existencias de barras y retazos para tu taller de maestranza.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingExcel(true);
                }}
                onDragLeave={() => setIsDraggingExcel(false)}
                onDrop={handleExcelDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isDraggingExcel
                    ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessExcelFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="excel-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Arrastra tu archivo Excel aquí o haz clic para explorar
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Soporta archivos <strong>.xlsx, .xls y .csv</strong> con columnas como Código, Nombre, Largo, Stock, Retazos, etc.
                  </div>
                </label>
              </div>

              {/* Download Sample Template Reminder */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-700">
                    ¿No tienes el formato? Descarga la planilla de ejemplo preconfigurada:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={generateSampleInventoryExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla .XLSX</span>
                </button>
              </div>

              {/* Loading indicator */}
              {excelLoading && (
                <div className="py-6 text-center text-blue-600 font-bold flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Procesando planilla Excel...</span>
                </div>
              )}

              {/* Error message */}
              {excelErrorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{excelErrorMsg}</span>
                </div>
              )}

              {/* Preview Table of Detected Items */}
              {excelPreviewItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{excelPreviewItems.length} perfiles detectados en "{excelFileName}"</span>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <span className="font-bold text-slate-800 block">¿Cómo deseas importar estos datos?</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          excelImportMode === 'replace'
                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          checked={excelImportMode === 'replace'}
                          onChange={() => setExcelImportMode('replace')}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <strong className="block font-bold">Reemplazar todo el inventario</strong>
                          <span className="text-[10px] text-slate-500">
                            Borra el inventario anterior y deja exactamente lo que viene en el Excel.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          excelImportMode === 'merge'
                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          checked={excelImportMode === 'merge'}
                          onChange={() => setExcelImportMode('merge')}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <strong className="block font-bold">Fusionar y Actualizar</strong>
                          <span className="text-[10px] text-slate-500">
                            Actualiza los perfiles coincidentes por código y añade los nuevos.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2">Código</th>
                          <th className="p-2">Nombre</th>
                          <th className="p-2">Categoría</th>
                          <th className="p-2 text-right">Largo</th>
                          <th className="p-2 text-right">Barras</th>
                          <th className="p-2 text-right">Retazos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelPreviewItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-mono font-bold text-blue-700">{item.code}</td>
                            <td className="p-2 font-medium text-slate-900">{item.name}</td>
                            <td className="p-2 text-slate-600">{CATEGORY_LABELS[item.category] || item.category}</td>
                            <td className="p-2 text-right font-mono">{item.standardBarLengthMm} mm</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">{item.standardBarsCount}</td>
                            <td className="p-2 text-right font-mono text-amber-700">
                              {item.offcuts.length > 0 ? `${item.offcuts.length} (${item.offcuts.map((o) => o.lengthMm).join(', ')} mm)` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={excelPreviewItems.length === 0}
                onClick={handleApplyExcelImport}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
              >
                <span>Confirmar e Importar {excelPreviewItems.length > 0 ? `(${excelPreviewItems.length} perfiles)` : ''}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offcuts Management Modal */}
      {selectedMaterialForOffcut && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                  Gestión de Despuntes & Retazos
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedMaterialForOffcut.name} ({selectedMaterialForOffcut.code})
                </h3>
              </div>
              <button
                onClick={() => setSelectedMaterialForOffcut(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ingresar Nuevo Retazo al Inventario</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Largo Exacto (mm)</label>
                    <input
                      type="number"
                      value={newOffcutLength}
                      onChange={(e) => setNewOffcutLength(parseInt(e.target.value, 10) || 0)}
                      placeholder="1850"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Etiqueta / Tag</label>
                    <input
                      type="text"
                      value={newOffcutTag}
                      onChange={(e) => setNewOffcutTag(e.target.value)}
                      placeholder="Ej: RET-09"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Ubicación Bodega</label>
                    <input
                      type="text"
                      value={newOffcutLocation}
                      onChange={(e) => setNewOffcutLocation(e.target.value)}
                      placeholder="Rack Retazos A"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={handleAddOffcut}
                    className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Guardar Retazo</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Retazos Actuales en Stock ({selectedMaterialForOffcut.offcuts.length})
                </h4>

                {selectedMaterialForOffcut.offcuts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No hay retazos registrados para este material.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedMaterialForOffcut.offcuts.map((off) => (
                      <div
                        key={off.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 text-sm">
                              {off.lengthMm} mm
                            </span>
                            {off.tag && (
                              <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                                {off.tag}
                              </span>
                            )}
                            {off.reservedForProject && (
                              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Reservado: {off.reservedForProject}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Ubicación: {off.location || 'Bodega'}</span>
                            {off.notes && <span>• {off.notes}</span>}
                            <span>• Ingresado: {off.createdAt}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleToggleOffcutReservation(selectedMaterialForOffcut.id, off.id)
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              off.reservedForProject
                                ? 'text-amber-600 hover:text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={off.reservedForProject ? 'Liberar retazo (ya no está reservado)' : 'Reservar este retazo para otro proyecto'}
                          >
                            {off.reservedForProject ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() =>
                              handleRemoveOffcut(selectedMaterialForOffcut.id, off.id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Eliminar retazo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reservas para Otros Proyectos</span>
                </h4>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Aparta una cantidad de barras/planchas/unidades para un proyecto específico — el Pre-Anidado de cubicaciones nuevas no las ofrecerá como disponibles, aunque sigan físicamente en bodega.
                </p>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Proyecto</label>
                    <input
                      type="text"
                      value={newReservationProject}
                      onChange={(e) => setNewReservationProject(e.target.value)}
                      placeholder="Ej: Proyecto Costanera"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-1">Cantidad</label>
                    <input
                      type="number"
                      step={selectedMaterialForOffcut.unitType === 'plancha' ? '0.01' : '1'}
                      value={newReservationQty}
                      onChange={(e) => setNewReservationQty(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddReservation}
                      className="w-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Reservar</span>
                    </button>
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newReservationNote}
                      onChange={(e) => setNewReservationNote(e.target.value)}
                      placeholder="Nota (opcional, ej: OC-1234)"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>

                {(selectedMaterialForOffcut.reservations || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    No hay reservas activas para este material.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2.5">
                    {(selectedMaterialForOffcut.reservations || []).map((res) => (
                      <div
                        key={res.id}
                        className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-900 text-sm">{res.projectName}</span>
                            <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                              {res.quantity} {selectedMaterialForOffcut.unitType === 'plancha' ? 'planchas' : 'u.'}
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            {res.note && <span>{res.note} • </span>}
                            <span>Desde: {res.createdAt}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveReservation(selectedMaterialForOffcut.id, res.id)}
                          className="p-1.5 rounded-lg text-amber-600 hover:text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Liberar reserva"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingMaterialId ? <Edit3 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                <span>{editingMaterialId ? 'Editar Perfil Estructural' : 'Agregar Nuevo Perfil al Catálogo de Maestranza'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Código / Perfil</label>
                  <input
                    type="text"
                    required
                    value={newMaterial.code || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, code: e.target.value })}
                    placeholder="Ej: C250X50X4"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Categoría</label>
                  <select
                    value={newMaterial.category || 'tubular_cuadrado'}
                    onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value as MaterialCategory })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                  >
                    {categories.map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {CATEGORY_LABELS[catKey]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newMaterial.name || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                  placeholder="Ej: Canal Estructural C250X50X4 mm"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Dimensiones</label>
                  <input
                    type="text"
                    value={newMaterial.dimensions || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, dimensions: e.target.value })}
                    placeholder="Ej: 250x50x4.0 mm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Calidad Acero</label>
                  <input
                    type="text"
                    value={newMaterial.grade || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, grade: e.target.value })}
                    placeholder="Ej: A36 / A270ES"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Largo Estándar (mm)</label>
                  <input
                    type="number"
                    value={newMaterial.standardBarLengthMm || 6000}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, standardBarLengthMm: parseInt(e.target.value, 10) || 6000 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Barras en Stock</label>
                  <input
                    type="number"
                    value={newMaterial.standardBarsCount ?? 0}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, standardBarsCount: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Peso Teórico (kg/m)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMaterial.theoreticalWeightPerMeter || 0}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, theoreticalWeightPerMeter: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Largo Comercial Alternativo (mm) — opcional
                </label>
                <input
                  type="number"
                  value={newMaterial.alternateBarLengthsMm?.[0] || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setNewMaterial({
                      ...newMaterial,
                      alternateBarLengthsMm: val > 0 ? [val] : undefined
                    });
                  }}
                  placeholder="Ej: 12000 (si además del largo estándar se puede comprar de 12m)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Si lo defines, el Pre-Anidado comparará automáticamente "comprar esta barra más grande" vs. "empalmar" para piezas que excedan el largo estándar.
                </p>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Ubicación en Patio / Bodega</label>
                <input
                  type="text"
                  value={newMaterial.location || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, location: e.target.value })}
                  placeholder="Ej: Patio Vigas - Rack 2B"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                >
                  {editingMaterialId ? 'Guardar Cambios' : 'Crear Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
