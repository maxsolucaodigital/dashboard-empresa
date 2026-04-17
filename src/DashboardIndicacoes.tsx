import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList } from 'recharts';
import { Upload, BarChart3, Info, ShoppingBag, TrendingUp, Printer, User, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ModalityStats {
    total: number;
    breakdown: Record<string, number>;
}

interface IndicacaoData {
    Funcionário: string;
    Ano: number;
    Mês: string;
    fechamentos: ModalityStats;
    apenasUm: ModalityStats;
    positivacoes: ModalityStats;
    naoIndicaram: ModalityStats;
    certificados: number;
}

const MODALITIES = [
    { key: 'ACC_MAX', label: 'ACC MAX', color: '#4f46e5' },
    { key: 'PI', label: 'PI', color: '#db2777' },
    { key: 'ACC', label: 'ACC', color: '#10b981' },
    { key: 'PA', label: 'PA', color: '#f59e0b' },
    { key: 'LOTES', label: 'LOTES', color: '#475569' }
];

const DashboardIndicacoes = () => {
    const [data, setData] = useState<IndicacaoData[]>([]);
    const [selectedFunc, setSelectedFunc] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [compareYear, setCompareYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>('Todos');

    const handlePrint = () => window.print();

    const parseCell = (val: any): ModalityStats => {
        const text = String(val || '').trim();
        if (!text || text === '0') return { total: 0, breakdown: {} };
        const breakdown: Record<string, number> = {};
        let totalCapturado = 0;
        const regex = /(\d+)\s*(ACC\s*MAX|PI|ACC|PA|LOTES)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const count = parseInt(match[1]);
            let mod = match[2].toUpperCase().trim();
            if (mod === 'ACCMAX') mod = 'ACC MAX';
            breakdown[mod] = (breakdown[mod] || 0) + count;
            totalCapturado += count;
        }
        return { total: totalCapturado || parseInt(text) || 0, breakdown };
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const funcionarioNome = file.name.split('.')[0];
            let novasLinhas: IndicacaoData[] = [];
            wb.SheetNames.forEach(abaNome => {
                const matchAno = abaNome.match(/\d{4}/);
                const ano = matchAno ? parseInt(matchAno[0]) : null;
                if (ano) {
                    const ws = wb.Sheets[abaNome];
                    const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
                    jsonData.forEach(row => {
                        if (row['Mês'] || row['mês']) {
                            novasLinhas.push({
                                Funcionário: funcionarioNome,
                                Ano: ano,
                                Mês: String(row['Mês'] || row['mês']).trim(),
                                fechamentos: parseCell(row['quantidade_de_fechamentos']),
                                apenasUm: parseCell(row['indicaram_apenas_um']),
                                positivacoes: parseCell(row['positivacoes']),
                                naoIndicaram: parseCell(row['nao_indicaram']),
                                certificados: Number(row['total_de_certificados'] || 0)
                            });
                        }
                    });
                }
            });
            setData(novasLinhas);
            setSelectedFunc(funcionarioNome);
        };
        reader.readAsBinaryString(file);
    };

    const { chartData, stats, availableYears, availableMonths } = useMemo(() => {
        const ordemMeses: Record<string, number> = { 'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12 };
        const years = Array.from(new Set(data.map(d => d.Ano))).sort((a, b) => b - a);
        
        const baseFilter = data.filter(d => d.Ano === selectedYear && (selectedMonth === 'Todos' || d.Mês === selectedMonth));
        const compFilter = compareYear ? data.filter(d => d.Ano === compareYear && (selectedMonth === 'Todos' || d.Mês === selectedMonth)) : [];

        const formatted = baseFilter.map(b => {
            const c = compFilter.find(item => item.Mês === b.Mês);
            const row: any = { 
                Mês: b.Mês, 
                naoIndicaram: b.naoIndicaram.total, 
                apenasUm: b.apenasUm.total, 
                positivacoes: b.positivacoes.total,
                zeroComp: c?.naoIndicaram.total || 0,
                umComp: c?.apenasUm.total || 0,
                posComp: c?.positivacoes.total || 0
            };
            MODALITIES.forEach(m => {
                row[`base_${m.label}`] = (b.fechamentos.breakdown[m.label] || 0);
                row[`comp_${m.label}`] = c ? (c.fechamentos.breakdown[m.label] || 0) : 0;
            });
            return row;
        }).sort((a, b) => (ordemMeses[a.Mês] || 0) - (ordemMeses[b.Mês] || 0));

        const getSummary = (list: IndicacaoData[]) => {
            const s = { certs: 0, posTotal: 0, umTotal: 0, zeroTotal: 0, fechTotal: 0, posBr: {} as any };
            list.forEach(d => {
                s.certs += d.certificados;
                s.posTotal += d.positivacoes.total;
                s.umTotal += d.apenasUm.total;
                s.zeroTotal += d.naoIndicaram.total;
                s.fechTotal += d.fechamentos.total;
                Object.entries(d.positivacoes.breakdown).forEach(([m, v]) => { s.posBr[m] = (s.posBr[m] || 0) + v; });
            });
            return s;
        };

        return { 
            chartData: formatted, 
            stats: { base: getSummary(baseFilter), comp: getSummary(compFilter), hasComparison: !!compareYear }, 
            availableYears: years, 
            availableMonths: ['Todos', ...Array.from(new Set(data.filter(d => d.Ano === selectedYear).map(d => d.Mês)))] 
        };
    }, [data, selectedYear, compareYear, selectedMonth]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; }
                    .print-header { display: flex !important; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .shadow-sm, .border { border: 1px solid #f1f5f9 !important; box-shadow: none !important; }
                }
                .print-header { display: none; }
            `}} />

            <div className="max-w-6xl mx-auto space-y-6">
                {/* CABEÇALHO PARA O PDF */}
                <div className="print-header flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Relatório Analítico de Performance</h1>
                        <div className="flex gap-4 mt-2 text-sm font-bold text-slate-600">
                            <span className="flex items-center gap-1"><User size={14}/> {selectedFunc}</span>
                            <span className="flex items-center gap-1"><Calendar size={14}/> {selectedYear} {compareYear && `vs ${compareYear}`}</span>
                        </div>
                    </div>
                </div>

                {/* HEADER TELA */}
                <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center no-print">
                    <h1 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                        <BarChart3 className="text-blue-600" /> Dashboard {selectedFunc && `- ${selectedFunc}`}
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 hover:bg-black transition-all">
                            <Printer size={16}/> Gerar PDF
                        </button>
                        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition-all">
                            <Upload size={16}/> Importar
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>

                {data.length > 0 && (
                    <div className="space-y-6">
                        {/* FILTROS NO-PRINT */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                            <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                                <p className="text-[10px] text-slate-400 uppercase font-black mb-2 tracking-widest">Ano Base</p>
                                <div className="flex gap-1 justify-center flex-wrap">
                                    {availableYears.map(y => (
                                        <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 rounded border text-[10px] font-black ${selectedYear === y ? 'bg-blue-600 text-white' : 'bg-white'}`}>{y}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                                <p className="text-[10px] text-orange-500 uppercase font-black mb-2 tracking-widest">Comparar</p>
                                <div className="flex gap-1 justify-center flex-wrap">
                                    <button onClick={() => setCompareYear(null)} className={`px-3 py-1 rounded border text-[10px] font-black ${compareYear === null ? 'bg-orange-500 text-white' : 'bg-white'}`}>OFF</button>
                                    {availableYears.filter(y => y !== selectedYear).map(y => (
                                        <button key={y} onClick={() => setCompareYear(y)} className={`px-3 py-1 rounded border text-[10px] font-black ${compareYear === y ? 'bg-orange-500 text-white' : 'bg-white'}`}>{y}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border shadow-sm text-center">
                                <p className="text-[10px] text-slate-400 uppercase font-black mb-2 tracking-widest">Mês</p>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full text-[10px] font-black border rounded p-1 uppercase">
                                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* INSIGHT CARD (O QUE TINHA SUMIDO) */}
                        {stats.hasComparison && (
                            <div className="bg-white p-6 rounded-xl border-l-8 border-blue-600 shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2"><TrendingUp className="text-blue-600" /> Insight Comparativo</h2>
                                    <div className={`px-4 py-2 rounded-lg flex items-center gap-2 font-black text-xl ${stats.base.certs >= stats.comp.certs ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        {stats.base.certs >= stats.comp.certs ? <ArrowUpRight /> : <ArrowDownRight />}
                                        {Math.abs(((stats.base.certs - stats.comp.certs) / (stats.comp.certs || 1) * 100)).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium">
                                    {stats.base.certs >= stats.comp.certs ? "Excelente! O volume total de certificados cresceu. " : "Atenção: Houve uma redução nas emissões em relação ao período anterior. "}
                                    {stats.base.posTotal >= stats.comp.posTotal ? "O aproveitamento em positivações está em alta. " : "O volume de positivações recuou. "}
                                    {Object.keys(stats.base.posBr).length > 0 && (
                                        <span className="font-bold text-blue-700">A modalidade destaque foi {Object.entries(stats.base.posBr).sort((a,b) => (b[1] as number) - (a[1] as number))[0][0]}.</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CARDS DE RESUMO */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Certificados', val: stats.base.certs, color: 'text-blue-600' },
                                { label: 'Fechamentos', val: stats.base.fechTotal, color: 'text-indigo-600' },
                                { label: 'Positivas', val: stats.base.posTotal, color: 'text-green-600' },
                                { label: 'Apenas Um', val: stats.base.umTotal, color: 'text-yellow-600' },
                                { label: 'Vezes Zero', val: stats.base.zeroTotal, color: 'text-red-600' }
                            ].map((card, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                                    <p className={`text-2xl font-black ${card.color}`}>{card.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* GRÁFICO 1: PERFORMANCE */}
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h3 className="text-[11px] font-black uppercase mb-6 flex items-center gap-2 border-b pb-2">
                                <Info size={16} className="text-blue-500" /> Frequência de Performance
                            </h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="Mês" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} />
                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
                                        
                                        <Bar dataKey="naoIndicaram" name={`Zero (${selectedYear})`} fill="#ef4444" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="naoIndicaram" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#ef4444' }} />
                                        </Bar>
                                        <Bar dataKey="apenasUm" name={`Um (${selectedYear})`} fill="#eab308" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="apenasUm" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#eab308' }} />
                                        </Bar>
                                        <Bar dataKey="positivacoes" name={`Positivas (${selectedYear})`} fill="#22c55e" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="positivacoes" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#22c55e' }} />
                                        </Bar>

                                        {stats.hasComparison && (
                                            <>
                                                <Bar dataKey="zeroComp" name={`Zero (${compareYear})`} fill="#fca5a5" radius={[4, 4, 0, 0]}>
                                                    <LabelList dataKey="zeroComp" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#fca5a5' }} />
                                                </Bar>
                                                <Bar dataKey="umComp" name={`Um (${compareYear})`} fill="#fef08a" radius={[4, 4, 0, 0]}>
                                                    <LabelList dataKey="umComp" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#fef08a' }} />
                                                </Bar>
                                                <Bar dataKey="posComp" name={`Positivas (${compareYear})`} fill="#bbf7d0" radius={[4, 4, 0, 0]}>
                                                    <LabelList dataKey="posComp" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#bbf7d0' }} />
                                                </Bar>
                                            </>
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* GRÁFICO 2: MIX PRODUTOS */}
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h3 className="text-[11px] font-black uppercase mb-6 flex items-center gap-2 border-b pb-2">
                                <ShoppingBag size={16} className="text-indigo-500"/> Mix de Produtos Detalhado
                            </h3>
                            <div className="h-[450px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="Mês" tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} />
                                        <YAxis tick={{fill: '#94a3b8', fontSize: 10}} allowDecimals={false} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} />
                                        <Legend wrapperStyle={{paddingTop: '20px', fontSize: '9px', fontWeight: 'bold'}} />
                                        
                                        {MODALITIES.map((m) => (
                                            <Bar key={`base_${m.key}`} dataKey={`base_${m.label}`} name={`${m.label} (${selectedYear})`} fill={m.color} radius={[2, 2, 0, 0]}>
                                                <LabelList dataKey={`base_${m.label}`} position="top" style={{ fontSize: '8px', fontWeight: 'bold', fill: m.color }} />
                                            </Bar>
                                        ))}

                                        {stats.hasComparison && MODALITIES.map((m) => (
                                            <Bar key={`comp_${m.key}`} dataKey={`comp_${m.label}`} name={`${m.label} (${compareYear})`} fill={m.color} fillOpacity={0.4} stroke={m.color} strokeWidth={1} radius={[2, 2, 0, 0]}>
                                                <LabelList dataKey={`comp_${m.label}`} position="top" style={{ fontSize: '8px', fontWeight: 'bold', fill: '#94a3b8' }} />
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