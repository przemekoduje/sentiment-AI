import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  Briefcase, 
  ChevronRight,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Settings,
  Save,
  DollarSign,
  Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Definitions for type safety
interface Position {
  ticker: string;
  qty: number;
  entry_price: number;
  entry_time: string;
  sl: number;
  tp: number;
}

interface Trade {
  ticker: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  qty: number;
  pnl: number;
  reason: string;
}

interface PortfolioData {
  cash: number;
  equity: number;
  involved: number;
  unrealized_pnl: number;
  risk_exposure: number;
  position_count: number;
  advice: string;
  positions: Record<string, Position>;
  trade_log: Trade[];
  equity_curve: any[];
}

const Portfolio = () => {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    initial_capital: 10000,
    risk_per_trade: 0.02
  });

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/portfolio');
      const json = await res.json();
      setData(json);
      if (json.settings) {
        setSettings(json.settings);
      }
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/portfolio/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert("Portfolio parameters synchronized successfully.");
        setIsSettingsOpen(false);
        fetchPortfolio(); // Refresh visuals
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Equity', value: `$${data?.equity.toLocaleString()}`, icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Unrealized P&L', value: `$${data?.unrealized_pnl.toLocaleString()}`, icon: TrendingUp, color: (data?.unrealized_pnl || 0) >= 0 ? 'text-emerald-600' : 'text-red-600', bg: (data?.unrealized_pnl || 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { label: 'Capital Involved', value: `$${data?.involved.toLocaleString()}`, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Risk Exposure', value: `$${data?.risk_exposure.toLocaleString()}`, icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header & Advice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900 flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
               <Briefcase className="text-white w-7 h-7" />
            </span>
            Portfolio <span className="text-indigo-600">Lab</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1 ml-15 flex items-center gap-4">
            Real-time simulation & risk management architecture
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200 text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              Trade Protocol Config
            </button>
          </p>
        </div>
        <div className="flex items-center gap-4 px-6 py-4 rounded-3xl bg-zinc-50 border border-zinc-200/50 max-w-2xl shadow-sm">
          <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0">
             <Lightbulb className="w-6 h-6 text-yellow-600" />
          </div>
          <p className="text-sm text-zinc-600 leading-relaxed">
            <span className="font-black text-xs uppercase tracking-widest text-yellow-600 block mb-1">AI Intelligence Agent</span>
            {data?.advice || "Analyzing market conditions for fresh protocol signals..."}
          </p>
        </div>
      </div>

      {/* Money Management Settings (Inline Modal/Toggle) */}
      {isSettingsOpen && (
        <div className="bg-white rounded-3xl border-2 border-indigo-500 p-8 shadow-2xl shadow-indigo-100 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2">
                <ShieldAlert className="text-indigo-600 w-6 h-6" />
                Money Management Protocol
              </h2>
              <p className="text-xs text-zinc-500 font-medium font-mono uppercase tracking-widest mt-1">CORE Financial Guardrail Settings</p>
            </div>
            <button 
              onClick={saveSettings}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              Sync Parameters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <DollarSign className="w-3 h-3" /> Initial Protocol Capital (USD)
              </label>
              <input 
                type="number" 
                value={settings.initial_capital}
                onChange={(e) => setSettings({...settings, initial_capital: parseFloat(e.target.value)})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 font-black text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <p className="text-[9px] text-zinc-400 font-medium italic">Base equity for ROI calculation and trade sizing.</p>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Percent className="w-3 h-3" /> Risk Per Trade (% of Capital)
              </label>
              <input 
                type="number" 
                step="0.01"
                value={settings.risk_per_trade * 100}
                onChange={(e) => setSettings({...settings, risk_per_trade: parseFloat(e.target.value) / 100})}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 font-black text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <p className="text-[9px] text-zinc-400 font-medium italic">Standardized risk amount per stop-loss event.</p>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className={`${stat.bg} p-4 rounded-2xl`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Positions */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="font-black flex items-center gap-2 text-zinc-900 text-sm uppercase tracking-tight">
              <Activity className="text-indigo-600 w-5 h-5" />
              Live Deployment Status
            </h3>
            <span className="text-[10px] bg-white border border-zinc-200 px-3 py-1.5 rounded-full text-zinc-600 font-black uppercase tracking-tighter shadow-sm">
              {data?.position_count || 0} ACTIVE_ASSETS
            </span>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(data?.positions || {}).map(([ticker, pos], i) => {
                return (
                  <div key={i} className="group p-5 rounded-3xl bg-zinc-50 border border-zinc-100 hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-indigo-100 border border-indigo-400/20">
                          {ticker}
                        </div>
                        <div>
                          <p className="text-lg font-black text-zinc-900">{ticker}</p>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Qty: {pos.qty} @ ${pos.entry_price.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black flex items-center justify-end gap-1 text-emerald-600`}>
                          <ArrowUpRight className="w-5 h-5" />
                          $--
                        </p>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter mt-1">{pos.entry_time.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                       <div className="flex justify-between text-[11px] font-black uppercase tracking-widest px-1">
                          <span className="text-red-500">Stop Loss: ${pos.sl.toFixed(2)}</span>
                          <span className="text-emerald-500">Take Profit: ${pos.tp.toFixed(2)}</span>
                       </div>
                       <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden border border-zinc-100 p-0.5">
                          <div className="h-full bg-indigo-500 rounded-full w-[45%]" />
                       </div>
                       <p className="text-[9px] text-center text-zinc-400 font-bold uppercase tracking-wider">Asset Lifespan Performance Index</p>
                    </div>
                  </div>
                );
              })}
              {(!data?.positions || Object.keys(data.positions).length === 0) && (
                <div className="text-center py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100">
                     <Activity className="w-10 h-10 text-zinc-200" />
                  </div>
                  <div>
                    <p className="text-zinc-900 font-black uppercase text-sm tracking-tight">No Active Deployments</p>
                    <p className="text-zinc-400 text-xs font-medium mt-1">Activate Auto-Pilot or execute manual strategy scan.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trade Log Snippet */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col h-fit overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="font-black flex items-center gap-2 text-zinc-900 text-sm uppercase tracking-tight">
              <RefreshCw className="text-purple-600 w-5 h-5" />
              Latest Closures
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {(data?.trade_log || []).slice(-5).reverse().map((trade, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-100 hover:bg-white hover:border-purple-200 transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm border",
                      trade.pnl >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                    )}>
                      {trade.ticker}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 line-clamp-1 group-hover:text-purple-600 transition-colors">{trade.reason}</span>
                      <span className="text-xs font-bold text-zinc-900">{trade.exit_time.split('T')[0]}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">USD</span>
                  </div>
                </div>
              ))}
              {(data?.trade_log || []).length === 0 && (
                <p className="text-center py-10 text-zinc-400 text-xs font-medium italic">Protocol history is currently empty.</p>
              )}
            </div>
            <button className="w-full mt-6 py-4 rounded-2xl border border-zinc-200 text-zinc-600 font-black text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center justify-center gap-2">
              Deep Analytics History
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
