import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList } from 'recharts';
import { Upload, BarChart3, Info, ShoppingBag, TrendingUp, Printer, User, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// --- CONFIGURAÇÕES ---
const MODALITIES = [
    { key: 'ACC_MAX', label: 'ACC MAX', color: '#4f46e5' },
    { key: 'PI', label: 'PI', color: '#db2777' },
    { key: 'ACC', label: 'ACC', color: '#10b981' },
    { key: 'PA', label: 'PA', color: '#f59e0b' },
    { key: 'LOTES', label: 'LOTES', color: '#475569' }
];

// --- SUB-COMPONENTES ---

const StatCard = ({ label, value, color, breakdown, compareValue, hasComparison, isInverted }: any) => {
    const isImprovement = isInverted ? value < compareValue : value > compareValue;
    const isEqual = value === compareValue;

    return (
        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between h-full">
            <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                {hasComparison && !isEqual && (
                    <div className="flex items-center gap-1 mt-1 border-t pt-1">
                        <span className="text-[10px] font-bold text-slate-400">Ant: {compareValue}</span>
                        {isImprovement ? (
                            <ArrowUpRight size={12} strokeWidth={3} className="text-green-500" />
                        ) : (
                            <ArrowDownRight size={12} strokeWidth={3} className="text-red-500" />
                        )}
                    </div>
                )}
                {hasComparison && isEqual && (
                    <div className="mt-1 border-t pt-1 text-[10px] font-bold text-slate-300 uppercase italic">Estável</div>
                )}
            </div>
            {breakdown && Object.keys(breakdown).length > 0 && (
                <div className="mt-2 space-y-1 border-t pt-2 no-print">
                    {Object.entries(breakdown).map(([m, v]) => {
                        const val = v as number;
                        return val > 0 && (
                            <div key={m} className="flex justify-between text-[8px] font-bold text-slate-500 uppercase italic">
                                <span>{m}</span><span>{val}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const InsightCard = ({ stats }: any) => {
    if (!stats.hasComparison) return null;
    const certDiff = ((stats.base.certs - stats.comp.certs) / (stats.comp.certs || 1) * 100);
    const zeroDiff = stats.base.zeroTotal - stats.comp.zeroTotal;
    const isUp = stats.base.certs >= stats.comp.certs;

    return (
        <div className="bg-white p-6 rounded-xl border-l-8 border-blue-600 shadow-sm space-y-4 no-print">
            <div className="flex justify-between items-start">
                <h2 className="text-lg font-black uppercase flex items-center gap-2"><TrendingUp className="text-blue-600" /> Insight Comparativo</h2>
                <div className={`px-4 py-2 rounded-lg flex items-center gap-2 font-black text-xl ${isUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {isUp ? <ArrowUpRight size={20} strokeWidth={3} /> : <ArrowDownRight size={20} strokeWidth={3} />}
                    {Math.abs(certDiff).toFixed(1)}%
                </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 font-medium leading-relaxed">
                {isUp ? "Volume de emissões em crescimento. " : "Houve uma retração no volume de certificados. "}
                {zeroDiff < 0 ? `Excelente: O funcionário reduziu a inatividade. ` : zeroDiff > 0 ? `Atenção: O índice de Vezes Zero aumentou. ` : ""}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

const DashboardIndicacoes = () => {
    const [data, setData] = useState<any[]>([]);
    const [selectedFunc, setSelectedFunc] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [compareYear, setCompareYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState('Todos');

    const handlePrint = () => window.print();

    const parseCell = (val: any) => {
        const text = String(val || '').trim();
        if (!text || text === '0') return { total: 0, breakdown: {} };
        const breakdown: Record<string, number> = {};
        let totalCapturado = 0;
        const regex = /(\d+)\s*([a-zA-Z\s]+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const count = parseInt(match[1]);
            let modRaw = match[2].toUpperCase().trim();
            const found = MODALITIES.find(m => modRaw.includes(m.label.toUpperCase()) || m.label.toUpperCase().includes(modRaw));
            if (found) { breakdown[found.label] = (breakdown[found.label] || 0) + count; totalCapturado += count; }
        }
        return { total: totalCapturado || parseInt(text.match(/\d+/)?.[0] || '0'), breakdown };
    };

    const handleFileUpload = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt: any) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            let rows: any[] = [];
            wb.SheetNames.forEach(sheet => {
                const ano = parseInt(sheet.match(/\d{4}/)?.[0] || '0');
                if (ano) {
                    XLSX.utils.sheet_to_json(wb.Sheets[sheet]).forEach((row: any) => {
                        if (row['Mês']) rows.push({
                            Ano: ano, Mês: String(row['Mês']).trim(),
                            fech: parseCell(row['quantidade_de_fechamentos']),
                            um: parseCell(row['indicaram_apenas_um']),
                            pos: parseCell(row['positivacoes']),
                            zero: parseCell(row['nao_indicaram']),
                            certs: Number(row['total_de_certificados'] || 0)
                        });
                    });
                }
            });
            setData(rows);
            setSelectedFunc(file.name.split('.')[0]);
        };
        reader.readAsBinaryString(file);
    };

    const { chartData, stats, availableYears, availableMonths } = useMemo(() => {
        const ordem = { 'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12 };
        const baseFilter = data.filter(d => d.Ano === selectedYear);
        const compFilter = compareYear ? data.filter(d => d.Ano === compareYear) : [];
        const baseDisplay = baseFilter.filter(d => selectedMonth === 'Todos' || d.Mês === selectedMonth);
        const compDisplay = compFilter.filter(d => selectedMonth === 'Todos' || d.Mês === selectedMonth);

        const formatted = baseFilter.map(b => {
            const c = compFilter.find(item => item.Mês === b.Mês);
            const row: any = { Mês: b.Mês, zero: b.zero.total, um: b.um.total, pos: b.pos.total, zeroComp: c?.zero.total || 0, umComp: c?.um.total || 0, posComp: c?.pos.total || 0 };
            MODALITIES.forEach(m => { row[`base_${m.label}`] = b.fech.breakdown[m.label] || 0; row[`comp_${m.label}`] = c?.fech.breakdown[m.label] || 0; });
            return row;
        }).sort((a, b) => (ordem[a.Mês as keyof typeof ordem] || 0) - (ordem[b.Mês as keyof typeof ordem] || 0));

        const sum = (list: any[]) => {
            const s = { certs: 0, posTotal: 0, umTotal: 0, zeroTotal: 0, fechTotal: 0, posBr: {} as any, fechBr: {} as any };
            list.forEach(d => {
                s.certs += d.certs; s.posTotal += d.pos.total; s.umTotal += d.um.total; s.zeroTotal += d.zero.total; s.fechTotal += d.fech.total;
                Object.entries(d.pos.breakdown).forEach(([m, v]) => { s.posBr[m] = (s.posBr[m] || 0) + (v as number); });
                Object.entries(d.fech.breakdown).forEach(([m, v]) => { s.fechBr[m] = (s.fechBr[m] || 0) + (v as number); });
            });
            return s;
        };

        return { 
            chartData: formatted, 
            stats: { base: sum(baseDisplay), comp: sum(compDisplay), hasComparison: !!compareYear },
            availableYears: Array.from(new Set(data.map(d => d.Ano))).sort((a, b) => b - a),
            availableMonths: ['Todos', ...Array.from(new Set(baseFilter.map(d => d.Mês)))]
        };
    }, [data, selectedYear, compareYear, selectedMonth]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans print:bg-white print:p-0">
            <style dangerouslySetInnerHTML={{ __html: `
                @page {
                    size: landscape;
                    margin: 10mm;
                }
                @media print { 
                    .no-print { display: none !important; } 
                    body { background: white !important; margin: 0; padding: 0; } 
                    .max-w-6xl { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
                    .bg-white { border: 1px solid #e2e8f0 !important; }
                    /* Garante que os gráficos não quebrem no meio da folha */
                    .print-section { page-break-inside: avoid; break-inside: avoid; }
                    /* Força o container do gráfico a ocupar a largura disponível sem overflow */
                    .recharts-responsive-container { width: 100% !important; height: 320px !important; }
                } 
                .print-header { display: none; }
                @media print { .print-header { display: flex !important; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px; } }
            ` }} />

            <div className="max-w-6xl mx-auto space-y-6">
                <div className="print-header flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Relatório Analítico: {selectedFunc}</h1>
                        <p className="text-sm font-bold text-slate-600">Referência: {selectedYear} {compareYear && `vs ${compareYear}`} | {selectedMonth}</p>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase text-right">
                        Gerado em: {new Date().toLocaleDateString('pt-BR')}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center no-print">
                    <h1 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><BarChart3 className="text-blue-600" /> Analítico - {selectedFunc}</h1>
                    <div className="flex gap-2 font-bold">
                        <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs uppercase flex items-center gap-2 hover:bg-black transition-all"><Printer size={16}/> Gerar PDF</button>
                        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs uppercase cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition-all">
                            <Upload size={16}/> Importar <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>

                {data.length > 0 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print font-black text-center text-xs">
                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                <p className="text-slate-400 uppercase mb-2">Ano Base</p>
                                <div className="flex gap-1 justify-center flex-wrap">
                                    {availableYears.map(y => <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 rounded border ${selectedYear === y ? 'bg-blue-600 text-white' : 'bg-white'}`}>{y}</button>)}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                <p className="text-orange-500 uppercase mb-2">Comparar</p>
                                <div className="flex gap-1 justify-center flex-wrap">
                                    <button onClick={() => setCompareYear(null)} className={`px-3 py-1 rounded border ${compareYear === null ? 'bg-orange-500 text-white' : 'bg-white'}`}>OFF</button>
                                    {availableYears.filter(y => y !== selectedYear).map(y => <button key={y} onClick={() => setCompareYear(y)} className={`px-3 py-1 rounded border ${compareYear === y ? 'bg-orange-500 text-white' : 'bg-white'}`}>{y}</button>)}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg border shadow-sm">
                                <p className="text-slate-400 uppercase mb-2">Mês</p>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full border rounded p-1 uppercase">{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
                            </div>
                        </div>

                        <InsightCard stats={stats} />

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <StatCard label="Certificados" value={stats.base.certs} compareValue={stats.comp.certs} hasComparison={stats.hasComparison} color="text-blue-600" />
                            <StatCard label="Fechamentos" value={stats.base.fechTotal} compareValue={stats.comp.fechTotal} hasComparison={stats.hasComparison} color="text-indigo-600" breakdown={stats.base.fechBr} />
                            <StatCard label="Positivas" value={stats.base.posTotal} compareValue={stats.comp.posTotal} hasComparison={stats.hasComparison} color="text-green-600" breakdown={stats.base.posBr} />
                            <StatCard label="Apenas Um" value={stats.base.umTotal} compareValue={stats.comp.umTotal} hasComparison={stats.hasComparison} color="text-yellow-600" />
                            <StatCard label="Vezes Zero" value={stats.base.zeroTotal} compareValue={stats.comp.zeroTotal} hasComparison={stats.hasComparison} color="text-red-600" isInverted={true} />
                        </div>

                        <div className="bg-white p-6 rounded-xl border shadow-sm print-section">
                            <h3 className="text-[11px] font-black uppercase mb-6 border-b pb-2 flex items-center gap-2"><Info size={16} className="text-blue-500" /> Performance Mensal</h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={stats.hasComparison ? 4 : 10} margin={{ top: 30, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="Mês" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} domain={[0, 'dataMax + 2']} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 'bold' }} />
                                        
                                        <Bar dataKey="zero" name={`Zero (${selectedYear})`} fill="#ef4444" radius={[2, 2, 0, 0]}><LabelList dataKey="zero" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#ef4444' }} /></Bar>
                                        <Bar dataKey="um" name={`Um (${selectedYear})`} fill="#eab308" radius={[2, 2, 0, 0]}><LabelList dataKey="um" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#eab308' }} /></Bar>
                                        <Bar dataKey="pos" name={`Positivas (${selectedYear})`} fill="#22c55e" radius={[2, 2, 0, 0]}><LabelList dataKey="pos" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#22c55e' }} /></Bar>

                                        {stats.hasComparison && (
                                            <>
                                                <Bar dataKey="zeroComp" name={`Zero (${compareYear})`} fill="#fca5a5" radius={[2, 2, 0, 0]}><LabelList dataKey="zeroComp" position="top" style={{ fontSize: '8px', fill: '#94a3b8' }} /></Bar>
                                                <Bar dataKey="umComp" name={`Um (${compareYear})`} fill="#fef08a" radius={[2, 2, 0, 0]}><LabelList dataKey="umComp" position="top" style={{ fontSize: '8px', fill: '#94a3b8' }} /></Bar>
                                                <Bar dataKey="posComp" name={`Positivas (${compareYear})`} fill="#bbf7d0" radius={[2, 2, 0, 0]}><LabelList dataKey="posComp" position="top" style={{ fontSize: '8px', fill: '#94a3b8' }} /></Bar>
                                            </>
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border shadow-sm print-section">
                            <h3 className="text-[11px] font-black uppercase mb-6 border-b pb-2 flex items-center gap-2"><ShoppingBag size={16} className="text-indigo-500"/> Mix de Produtos Detalhado</h3>
                            <div className="h-[450px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={stats.hasComparison ? 2 : 5} margin={{ top: 35, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="Mês" tick={{fill: '#64748b', fontSize: 9, fontWeight: 'bold'}} />
                                        <YAxis tick={{fill: '#94a3b8', fontSize: 10}} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} />
                                        <Legend wrapperStyle={{paddingTop: '20px', fontSize: '8px', fontWeight: 'bold'}} />
                                        
                                        {MODALITIES.map((m) => (
                                            <Bar key={`base_${m.key}`} dataKey={`base_${m.label}`} name={`${m.label} (${selectedYear})`} fill={m.color} radius={[2, 2, 0, 0]}>
                                                <LabelList dataKey={`base_${m.label}`} position="top" style={{ fontSize: '8px', fontWeight: 'bold', fill: m.color }} />
                                            </Bar>
                                        ))}

                                        {stats.hasComparison && MODALITIES.map((m) => (
                                            <Bar key={`comp_${m.key}`} dataKey={`comp_${m.label}`} name={`${m.label} (${compareYear})`} fill={m.color} fillOpacity={0.3} stroke={m.color} strokeWidth={1} radius={[2, 2, 0, 0]}>
                                                <LabelList dataKey={`comp_${m.label}`} position="top" style={{ fontSize: '7px', fill: '#94a3b8' }} />
                                            </Bar>
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardIndicacoes;