import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Upload, BarChart3, Info, Download, ArrowUpRight, ArrowDownRight, Minus, Filter } from 'lucide-react';
import { toPng } from 'html-to-image';

interface IndicacaoData {
    Funcionário: string;
    Ano: number;
    Mês: string;
    zero: number;
    uma: number;
    mais: number;
    total: number;
}

const DashboardIndicacoes = () => {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<IndicacaoData[]>([]);
    const [selectedFunc, setSelectedFunc] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [compareYear, setCompareYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>('Todos');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const funcionarioNome = file.name.split('.')[0]; 
            let novasLinhas: IndicacaoData[] = [];

            wb.SheetNames.forEach(abaAno => {
                const ano = parseInt(abaAno);
                if (isNaN(ano)) return;
                const ws = wb.Sheets[abaAno];
                const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

                jsonData.forEach(row => {
                    if (row['Mês']) {
                        const z = Number(row['Ocorrências_Zero'] || 0);
                        const u = Number(row['Ocorrências_Um'] || 0);
                        const m = Number(row['Volume_Mais_Que_Um'] || 0);

                        novasLinhas.push({
                            Funcionário: funcionarioNome,
                            Ano: ano,
                            Mês: String(row['Mês']).trim(),
                            zero: z,
                            uma: u,
                            mais: m,
                            total: z + u + m
                        });
                    }
                });
            });

            setData(novasLinhas);
            setSelectedFunc(funcionarioNome);
            
            if (novasLinhas.length > 0) {
                const anos = Array.from(new Set(novasLinhas.map(d => d.Ano))).sort((a, b) => b - a);
                setSelectedYear(anos[0]);
                setCompareYear(null);
                setSelectedMonth('Todos');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; 
    };

    const exportDashboard = async () => {
        if (dashboardRef.current === null) return;
        try {
            const dataUrl = await toPng(dashboardRef.current, { 
                cacheBust: true, 
                backgroundColor: '#f8fafc',
                style: { width: '1200px', padding: '20px' }
            });
            const link = document.createElement('a');
            link.download = `relatorio-${selectedFunc}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Erro ao exportar:', err);
        }
    };

    const anosDisponiveis = useMemo(() => {
        return Array.from(new Set(data.map(item => item.Ano))).sort((a, b) => b - a);
    }, [data]);

    const mesesDisponiveis = useMemo(() => {
        const meses = data
            .filter(item => item.Ano === selectedYear)
            .map(item => item.Mês.charAt(0).toUpperCase() + item.Mês.slice(1).toLowerCase());
        return ['Todos', ...Array.from(new Set(meses))];
    }, [data, selectedYear]);

    const { chartData, comparisonStats } = useMemo(() => {
        const ordemMeses: { [key: string]: number } = {
            'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
            'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
        };

        const baseYearFiltered = data.filter(item => item.Ano === selectedYear);
        const compYearFiltered = compareYear ? data.filter(item => item.Ano === compareYear) : [];

        let mesesParaExibir = selectedMonth === 'Todos' 
            ? Object.keys(ordemMeses).filter(m => 
                baseYearFiltered.some(d => d.Mês.toLowerCase() === m.toLowerCase()) || 
                (compareYear && compYearFiltered.some(d => d.Mês.toLowerCase() === m.toLowerCase()))
              )
            : [selectedMonth];

        const formatted = mesesParaExibir.map(mes => {
            const base = baseYearFiltered.find(d => d.Mês.toLowerCase() === mes.toLowerCase());
            const comp = compYearFiltered.find(d => d.Mês.toLowerCase() === mes.toLowerCase());

            return {
                Mês: mes,
                zero: base?.zero || 0,
                uma: base?.uma || 0,
                mais: base?.mais || 0,
                totalBase: base?.total || 0,
                totalComp: comp?.total || 0
            };
        }).sort((a, b) => (ordemMeses[a.Mês] || 0) - (ordemMeses[b.Mês] || 0));

        const tBase = { 
            total: formatted.reduce((acc, cur) => acc + cur.totalBase, 0),
            z: formatted.reduce((acc, cur) => acc + cur.zero, 0),
            u: formatted.reduce((acc, cur) => acc + cur.uma, 0),
            m: formatted.reduce((acc, cur) => acc + cur.mais, 0)
        };
        const tComp = { 
            total: formatted.reduce((acc, cur) => acc + cur.totalComp, 0),
            z: formatted.reduce((acc, cur) => acc + (data.find(d => d.Mês === cur.Mês && d.Ano === compareYear)?.zero || 0), 0),
            u: formatted.reduce((acc, cur) => acc + (data.find(d => d.Mês === cur.Mês && d.Ano === compareYear)?.uma || 0), 0),
            m: formatted.reduce((acc, cur) => acc + (data.find(d => d.Mês === cur.Mês && d.Ano === compareYear)?.mais || 0), 0)
        };

        const diff = tBase.total - tComp.total;
        const percent = tComp.total !== 0 ? ((diff / tComp.total) * 100).toFixed(1) : '100';

        return { 
            chartData: formatted, 
            comparisonStats: { tBase, tComp, diff, percent, hasComparison: !!compareYear } 
        };
    }, [data, selectedYear, compareYear, selectedMonth]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900" ref={dashboardRef}>
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-2 uppercase">
                            <BarChart3 className="text-blue-600" /> Analítico de Indicações
                        </h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Controle de Performance</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportDashboard} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-black transition-all shadow-md flex items-center gap-2">
                            <Download size={16} /> PNG
                        </button>
                        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase cursor-pointer hover:bg-blue-700 transition-all shadow-md flex items-center gap-2">
                            <Upload size={16} /> Importar
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>

                {data.length > 0 && (
                    <>
                        {/* Filtros */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-black text-center">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center items-center">
                                <p className="text-[10px] text-slate-400 uppercase mb-1">Colaborador</p>
                                <p className="text-lg text-blue-600 uppercase">{selectedFunc}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-400 uppercase mb-2 text-center">Ano Base</p>
                                <div className="flex gap-1 flex-wrap justify-center">
                                    {anosDisponiveis.map(y => (
                                        <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 rounded border text-[10px] ${selectedYear === y ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>{y}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-orange-500 uppercase mb-2 text-center">Comparar Com</p>
                                <div className="flex gap-1 flex-wrap justify-center">
                                    <button onClick={() => setCompareYear(null)} className={`px-3 py-1 rounded border text-[10px] ${compareYear === null ? 'bg-orange-500 text-white' : 'bg-white'}`}>OFF</button>
                                    {anosDisponiveis.filter(y => y !== selectedYear).map(y => (
                                        <button key={y} onClick={() => setCompareYear(y)} className={`px-3 py-1 rounded border text-[10px] ${compareYear === y ? 'bg-orange-500 text-white' : 'bg-white'}`}>{y}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Mês */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex gap-2 flex-wrap">
                            {mesesDisponiveis.map(m => (
                                <button key={m} onClick={() => setSelectedMonth(m)} className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase transition-all ${selectedMonth === m ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                            ))}
                        </div>

                        {/* COMPARATIVO DETALHADO (CARD AZUL) */}
                        {comparisonStats.hasComparison && (
                            <div className="bg-white p-6 rounded-xl border-l-8 border-blue-600 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b pb-4 border-slate-100">
                                    <div>
                                        <h2 className="text-xl font-black uppercase tracking-tighter">
                                            {selectedMonth === 'Todos' ? `Relatório Anual: ${selectedYear} vs ${compareYear}` : `${selectedMonth}: ${selectedYear} vs ${compareYear}`}
                                        </h2>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Resumo Estatístico Comparativo</p>
                                    </div>
                                    <div className={`px-6 py-2 rounded-lg flex items-center gap-2 font-black text-xl ${comparisonStats.diff >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        {comparisonStats.diff >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                                        {Math.abs(Number(comparisonStats.percent))}%
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-bold">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-tighter">Impacto Total</p>
                                        <p className="text-sm">{selectedYear}: <span className="text-blue-600">{comparisonStats.tBase.total}</span></p>
                                        <p className="text-sm">{compareYear}: <span className="text-orange-500">{comparisonStats.tComp.total}</span></p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-bold">
                                        <p className="text-[9px] font-black uppercase text-red-400 mb-2 tracking-tighter">Vezes Zero</p>
                                        <p className="text-sm">{selectedYear}: {comparisonStats.tBase.z}</p>
                                        <p className="text-sm">{compareYear}: {comparisonStats.tComp.z}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-bold">
                                        <p className="text-[9px] font-black uppercase text-yellow-500 mb-2 tracking-tighter">Vezes Apenas 1</p>
                                        <p className="text-sm">{selectedYear}: {comparisonStats.tBase.u}</p>
                                        <p className="text-sm">{compareYear}: {comparisonStats.tComp.u}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-bold">
                                        <p className="text-[9px] font-black uppercase text-green-500 mb-2 tracking-tighter">Volume +1</p>
                                        <p className="text-sm">{selectedYear}: {comparisonStats.tBase.m}</p>
                                        <p className="text-sm">{compareYear}: {comparisonStats.tComp.m}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GRÁFICO (COM COMPARAÇÃO LADO A LADO) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-8 flex items-center gap-2">
                                <Info size={14} /> 
                                {compareYear ? `Volume Lado a Lado: ${selectedYear} vs ${compareYear}` : `Distribuição de Qualidade - ${selectedYear}`}
                            </h3>
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="Mês" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 'black'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} allowDecimals={false} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase'}} />
                                        
                                        {compareYear ? (
                                            <>
                                                {/* Quando comparar, mostra as barras de volume total lado a lado */}
                                                <Bar dataKey="totalBase" name={`Volume em ${selectedYear}`} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="totalComp" name={`Volume em ${compareYear}`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                            </>
                                        ) : (
                                            <>
                                                {/* Visão normal por cores de qualidade */}
                                                <Bar dataKey="zero" name="Zero" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="uma" name="Apenas 1" fill="#eab308" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="mais" name="Volume +1" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                            </>
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DashboardIndicacoes;