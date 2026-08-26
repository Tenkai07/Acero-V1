import { useState, DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { BOMProfileGroup, MaterialStockItem } from '../types';
import { parseMultiProfileBOM, parseAbmMasterSheet } from '../utils/multiProfileBOMParser';
import { SAMPLE_USER_BOM_TEXT } from '../data/initialStock';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  ArrowRight,
  Trash2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileText,
  Plus
} from 'lucide-react';

interface BOMImportViewProps {
  groups: BOMProfileGroup[];
  onUpdateGroups: (groups: BOMProfileGroup[]) => void;
  inventory: MaterialStockItem[];
  onProceedToSplice: () => void;
  onProceedToPreNesting: () => void;
}

export const BOMImportView = ({
  groups,
  onUpdateGroups,
  inventory,
  onProceedToSplice,
  onProceedToPreNesting
}: BOMImportViewProps) => {
  const [inputText, setInputText] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleParse = (textToParse: string) => {
    if (!textToParse.trim()) {
      alert('Por favor pega los datos de la planilla o escribe los perfiles y piezas.');
      return;
    }

    const parsedGroups = parseMultiProfileBOM(textToParse, inventory);
    if (parsedGroups.length === 0) {
      alert(
        'No se detectaron perfiles ni piezas válidas. Asegúrate de incluir columnas como "Cantidad", "Nombre", "Calidad", "Longitud / mm" y filas de perfil como "Perfil : C250X50X4".'
      );
      return;
    }

    onUpdateGroups(parsedGroups);
    setStatusMessage(`¡Éxito! Se cargaron ${parsedGroups.length} perfiles con ${parsedGroups.reduce((s, g) => s + g.totalPiecesCount, 0)} piezas.`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleLoadSampleFromImage = () => {
    setInputText(SAMPLE_USER_BOM_TEXT);
    const parsed = parseMultiProfileBOM(SAMPLE_USER_BOM_TEXT, inventory);
    onUpdateGroups(parsed);
    setStatusMessage('¡Se cargó la planilla de ejemplo con los 5 perfiles estructurales de la imagen!');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleFileUpload = async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (isExcel) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Intenta primero el formato "Lista Avanzada de Materiales" (ABM/AMCS):
        // una hoja maestra con TODOS los tipos de perfil juntos. Es más
        // confiable que usar a ciegas la primera hoja del libro, porque un
        // libro con "una hoja de Excel por perfil" (ej. exportado desde
        // STRUMIS) dejaría afuera todos los perfiles menos el de esa primera
        // hoja si no se busca la hoja maestra primero.
        for (const sheetName of workbook.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
          const abmGroups = parseAbmMasterSheet(rows, inventory);
          if (abmGroups.length >= 2) {
            onUpdateGroups(abmGroups);
            setStatusMessage(
              `¡Éxito! Se detectó un listado ABM/AMCS en la hoja "${sheetName}" — se cargaron ${abmGroups.length} perfiles con ${abmGroups.reduce((s, g) => s + g.totalPiecesCount, 0)} piezas.`
            );
            setTimeout(() => setStatusMessage(null), 5000);
            return;
          }
        }

        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          const sheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });
          setInputText(csvText);
          handleParse(csvText);
        }
      } catch (err) {
        alert('Error al leer el archivo Excel de cubicación.');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setInputText(content);
          handleParse(content);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const totalPiecesAll = groups.reduce((s, g) => s + g.totalPiecesCount, 0);
  const totalMetersAll = (groups.reduce((s, g) => s + g.totalLengthMm, 0) / 1000).toFixed(2);
  const totalWeightAll = groups.reduce((s, g) => s + g.totalWeightKg, 0).toFixed(2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Explanatory Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Paso 1 de 4
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Importar Planilla de Cubicación (BOM)
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              Pega directamente las tablas desde Excel, Tekla Structures o AutoCAD con perfiles, marcas, largos y calidades.
            </p>
          </div>

          {/* Action quick buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleLoadSampleFromImage}
              className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm border border-blue-200 flex items-center gap-2 transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Cargar Planilla de la Imagen</span>
            </button>

            {groups.length > 0 && (
              <button
                onClick={() => onUpdateGroups([])}
                className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                title="Limpiar planilla cargada"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Input Section: Paste Area & File Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Pegar Datos de Planilla (Copiar de Excel / Tekla)</span>
            </label>
            <span className="text-xs text-slate-400">
              Formato compatible: Cantidad | Nombre | Calidad | Longitud mm | Peso | Área
            </span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ejemplo:
Cantidad  Nombre  Calidad  Longitud / mm  Peso / kg  Área / m2
1         Lim01   A36      98             1.03       0.07
2         Lim01   A36      2 936          30.9       1.99
Perfil : C250X50X4  9 Lim01  A36  18 577  195.56  12.6
12        CA01    A36      5 560          33.14      4.25
Perfil : CA200X2-AMCS  12 CA01  A36  66 720  397.74  50.98`}
            rows={10}
            className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={() => handleParse(inputText)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Procesar y Cargar Datos</span>
            </button>

            <button
              onClick={() => {
                setInputText('');
              }}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Limpiar texto
            </button>
          </div>
        </div>

        {/* Drag & Drop Card & Format Guide */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[170px] ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Arrastra un archivo Excel, CSV o TXT aquí
            </p>
            <p className="text-xs text-slate-500 mt-0.5">o presiona para seleccionarlo</p>
            <input
              type="file"
              accept=".csv,.txt,.tsv,.xlsx,.xls"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              Explorar Archivo
            </label>
          </div>

          <div className="bg-blue-50/70 border border-blue-200/70 rounded-2xl p-4 text-xs text-slate-700 space-y-2">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Detección Automática de Tekla / AutoCAD:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>Reconoce títulos como <code>Perfil : C250X50X4</code>, <code>Perfil : D12</code>, etc.</li>
              <li>Separa automáticamente números con espacios de miles (ej: <code>2 936</code> o <code>18 577</code>).</li>
              <li>Calcula automáticamente metros lineales netos, kilos y piezas por perfil.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Parsed Groups Display */}
      {groups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
          {/* Summary Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>Perfiles Estructurales Detectados ({groups.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Revisa los perfiles importados antes de pasar a la verificación de stock y empalmes.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
              <div>
                <span className="text-slate-500 block text-[10px]">TOTAL PIEZAS</span>
                <strong className="text-slate-900 font-bold text-sm">{totalPiecesAll} pzas</strong>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 block text-[10px]">METROS TOTALES</span>
                <strong className="text-blue-700 font-bold text-sm">{totalMetersAll} m</strong>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 block text-[10px]">PESO TOTAL</span>
                <strong className="text-slate-900 font-bold text-sm">{totalWeightAll} kg</strong>
              </div>
            </div>
          </div>

          {/* Groups List */}
          <div className="space-y-4">
            {groups.map((group, gIdx) => {
              const matchedMat = inventory.find((m) => m.id === group.matchedMaterialId);
              const inStockBars = matchedMat?.standardBarsCount || 0;
              const inStockOffcuts = matchedMat?.offcuts.length || 0;

              return (
                <div
                  key={group.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  {/* Group Header */}
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {gIdx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {group.profileName}
                          </span>
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                            {group.cleanProfileCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {group.totalPiecesCount} piezas • {(group.totalLengthMm / 1000).toFixed(2)} m lineales • {group.totalWeightKg.toFixed(2)} kg
                        </div>
                      </div>
                    </div>

                    {/* Stock quick status */}
                    <div className="flex items-center gap-2 text-xs">
                      {matchedMat ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Bodega: <strong>{inStockBars} b. de {(matchedMat.standardBarLengthMm / 1000)}m</strong> / <strong>{inStockOffcuts} retazos</strong></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>No está en catálogo de bodega (se usará barra estándar 6m)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pieces table */}
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-2">Cant</th>
                          <th className="px-4 py-2">Marca / Nombre</th>
                          <th className="px-4 py-2">Calidad</th>
                          <th className="px-4 py-2">Longitud (mm)</th>
                          <th className="px-4 py-2">Peso (kg)</th>
                          <th className="px-4 py-2">Área (m²)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                        {group.pieces.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-bold text-slate-900">{p.quantity}</td>
                            <td className="px-4 py-2 font-sans font-medium text-slate-800">{p.itemNumber}</td>
                            <td className="px-4 py-2 text-slate-500 font-sans">{p.grade}</td>
                            <td className="px-4 py-2 font-bold text-blue-700">{p.lengthMm} mm</td>
                            <td className="px-4 py-2 text-slate-600">{p.weightKg ? p.weightKg.toFixed(2) : '-'}</td>
                            <td className="px-4 py-2 text-slate-600">{p.areaM2 ? p.areaM2.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Workflow Action Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              ¿Hay piezas largas que requieran división o traslapo? Puedes configurarlas en el Paso 2 o ejecutar el Pre-Anidado directo.
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onProceedToSplice}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center justify-center gap-2 transition-colors"
              >
                <span>2. Ajustar Medidas & Empalmes</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onProceedToPreNesting}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>3. Ejecutar Pre-Anidado & Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
