import { useState } from 'react';
import { BOMProfileGroup, MaterialStockItem } from '../types';
import {
  ShoppingCart,
  Printer,
  Share2,
  Download,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';

interface PurchaseOrderViewProps {
  groups: BOMProfileGroup[];
  inventory: MaterialStockItem[];
  onDeductFromInventory: () => void;
  isDeducted: boolean;
}

export const PurchaseOrderView = ({
  groups,
  inventory,
  onDeductFromInventory,
  isDeducted
}: PurchaseOrderViewProps) => {
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  const profilesToBuy = groups
    .filter((g) => (g.stockComparison?.barsToBuy || 0) > 0)
    .map((g) => ({
      profileName: g.profileName,
      cleanCode: g.cleanProfileCode,
      grade: g.pieces[0]?.grade || 'A36',
      commercialLengthM: (g.commercialBarLengthMm / 1000).toFixed(0),
      barsToBuy: g.stockComparison?.barsToBuy || 0,
      metersToBuy: g.stockComparison?.metersToBuy || 0,
      weightKg: g.stockComparison?.weightToBuyKg || 0,
      barsFromStock: g.stockComparison?.barsFromStock || 0,
      offcutsFromStock: g.stockComparison?.offcutsFromStock || 0
    }));

  const totalBarsToBuy = profilesToBuy.reduce((s, p) => s + p.barsToBuy, 0);
  const totalMetersToBuy = profilesToBuy.reduce((s, p) => s + p.metersToBuy, 0);
  const totalWeightToBuy = profilesToBuy.reduce((s, p) => s + p.weightKg, 0);

  const handleCopyWhatsApp = () => {
    let text = `*📋 ORDEN DE COMPRA DE ACERO - MAESTRANZA*\n`;
    text += `*Fecha:* ${new Date().toLocaleDateString('es-CL')}\n\n`;
    text += `*MATERIALES A COMPRAR / COTIZAR:*\n`;

    if (profilesToBuy.length === 0) {
      text += `✅ No se requieren compras. Todo el material está disponible en bodega.\n`;
    } else {
      profilesToBuy.forEach((p) => {
        text += `• *${p.cleanCode}* (${p.grade}): ${p.barsToBuy} barras de ${p.commercialLengthM}m (${p.metersToBuy.toFixed(1)} m / ~${p.weightKg.toFixed(1)} kg)\n`;
      });
      text += `\n*TOTALES A COMPRAR:*\n`;
      text += `Total Barras: ${totalBarsToBuy}\n`;
      text += `Metros Lineales: ${totalMetersToBuy.toFixed(1)} m\n`;
      text += `Peso Total Estimado: ${totalWeightToBuy.toFixed(1)} kg\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 3000);
  };

  const handleExportCSV = () => {
    let csv = `Perfil,Calidad,Largo Comercial (m),Barras a Comprar,Metros a Comprar,Peso Estimado (kg),Barras de Stock,Retazos Usados\n`;
    groups.forEach((g) => {
      const comp = g.stockComparison;
      csv += `"${g.cleanProfileCode}","${g.pieces[0]?.grade || 'A36'}",${(g.commercialBarLengthMm / 1000).toFixed(0)},${comp?.barsToBuy || 0},${(comp?.metersToBuy || 0).toFixed(2)},${(comp?.weightToBuyKg || 0).toFixed(2)},${comp?.barsFromStock || 0},${comp?.offcutsFromStock || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Orden_Compra_Acero_${Date.now()}.csv`;
    link.click();
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xs">
        <ShoppingCart className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No hay planilla cargada</h3>
        <p className="text-sm text-slate-500 mt-1">
          Primero importa una planilla de cubicación para generar la orden de compra.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Paso 4 de 4
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
                <span>Orden de Compra Consolidada & Plan de Taller</span>
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              Resumen de acero a cotizar/comprar y reporte de consumo de bodega para maestranza.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopyWhatsApp}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedNotice ? '¡Copiado al Portapapeles!' : 'Copiar para WhatsApp'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm border border-slate-300 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-200">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 block">
              Total Barras a Comprar
            </span>
            <div className="text-3xl font-black text-rose-950 mt-1">
              {totalBarsToBuy} barras
            </div>
            <span className="text-xs text-rose-700">
              {totalMetersToBuy.toFixed(1)} metros lineales
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 block">
              Peso Total Acero a Comprar
            </span>
            <div className="text-3xl font-black text-blue-950 mt-1">
              {totalWeightToBuy.toFixed(1)} kg
            </div>
            <span className="text-xs text-blue-700">
              {(totalWeightToBuy / 1000).toFixed(2)} toneladas aprox.
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
              Ahorro de Stock en Bodega
            </span>
            <div className="text-3xl font-black text-emerald-950 mt-1">
              {groups.reduce((s, g) => s + (g.stockComparison?.barsFromStock || 0), 0)} barras
            </div>
            <span className="text-xs text-emerald-700">
              + {groups.reduce((s, g) => s + (g.stockComparison?.offcutsFromStock || 0), 0)} retazos aprovechados
            </span>
          </div>
        </div>
      </div>

      {/* Table: Purchase Items List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span>Detalle Consolidado de Materiales a Comprar ({profilesToBuy.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            Listo para enviar a proveedores (CAP, Gerdau, Cintac, etc.)
          </span>
        </div>

        {profilesToBuy.length === 0 ? (
          <div className="text-center py-10 text-emerald-800 bg-emerald-50/50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-bold text-base">¡Todo el material está en Bodega!</h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              No se requiere comprar barras adicionales para este proyecto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Perfil Estructural</th>
                  <th className="px-4 py-3">Calidad</th>
                  <th className="px-4 py-3">Largo Comercial</th>
                  <th className="px-4 py-3 bg-rose-50 text-rose-900">Barras a Comprar</th>
                  <th className="px-4 py-3 bg-rose-50 text-rose-900">Metros a Comprar</th>
                  <th className="px-4 py-3 bg-blue-50 text-blue-900">Peso Est. (kg)</th>
                  <th className="px-4 py-3 bg-emerald-50 text-emerald-900">Sale de Bodega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-mono">
                {profilesToBuy.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-sans font-bold text-slate-900">{p.cleanCode}</td>
                    <td className="px-4 py-3 font-sans text-slate-600">{p.grade}</td>
                    <td className="px-4 py-3 font-bold">{p.commercialLengthM} metros</td>
                    <td className="px-4 py-3 font-black text-rose-700 text-sm bg-rose-50/30">
                      {p.barsToBuy} barras
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-800 bg-rose-50/30">
                      {p.metersToBuy.toFixed(2)} m
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-800 bg-blue-50/30">
                      {p.weightKg.toFixed(2)} kg
                    </td>
                    <td className="px-4 py-3 text-emerald-800 bg-emerald-50/30 font-sans">
                      {p.barsFromStock} b. + {p.offcutsFromStock} ret.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Deduct from Inventory Action Box */}
        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl">
          <div className="space-y-0.5 text-xs text-slate-600">
            <span className="font-bold text-slate-900 block text-sm">
              Control de Existencias en Bodega
            </span>
            <span>
              Al iniciar la fabricación, descuenta las barras utilizadas y registra los nuevos retazos aprovechables en el inventario.
            </span>
          </div>

          <button
            disabled={isDeducted}
            onClick={onDeductFromInventory}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-colors shrink-0 ${
              isDeducted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>{isDeducted ? '✅ Stock Descontado en Bodega' : 'Descontar de Bodega & Guardar Retazos'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
