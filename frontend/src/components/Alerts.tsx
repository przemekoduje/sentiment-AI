import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Zap, 
  Activity, 
  ShieldAlert, 
  ChevronRight, 
  ExternalLink,
  MessageSquare,
  Clock,
  RefreshCw,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertDetail {
  score?: number;
  label?: string;
  indicator?: string;
  value?: number;
  status?: string;
  potential?: number;
  decision_action?: string;
  decision_reasoning?: string;
  reasoning: string;
  breakdown?: Record<string, any>;
}

interface Alert {
  id: string;
  type: 'SENTIMENT' | 'INSIDER' | 'TECHNICAL' | 'POTENTIAL';
  ticker: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: string;
  details: AlertDetail;
}

interface AlertsProps {
  onTickerNavigate: (ticker: string) => void;
}

const Alerts = ({ onTickerNavigate }: AlertsProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');

  const fetchAlerts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/live/alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const filteredAlerts = alerts.filter(a => filter === 'ALL' || a.severity === filter);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SENTIMENT': return MessageSquare;
      case 'INSIDER': return ShieldAlert;
      case 'TECHNICAL': return Activity;
      case 'POTENTIAL': return Trophy;
      default: return Bell;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return "bg-red-500 text-white border-red-600 shadow-red-100";
      case 'HIGH': return "bg-orange-500 text-white border-orange-600 shadow-orange-100";
      case 'MEDIUM': return "bg-blue-500 text-white border-blue-600 shadow-blue-100";
      default: return "bg-zinc-500 text-white border-zinc-600 shadow-zinc-100";
    }
  };

  const getCardStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return "border-red-200 bg-red-50/30 hover:border-red-400";
      case 'HIGH': return "border-orange-200 bg-orange-50/30 hover:border-orange-400";
      case 'MEDIUM': return "border-blue-200 bg-blue-50/30 hover:border-blue-400";
      default: return "border-zinc-200 bg-zinc-50/30";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      {/* Header section with Triage controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Bell className="text-white w-5 h-5" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Signal Triage System</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900">
            Market <span className="text-indigo-600">Alerts</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Filtering 10,000+ data points for high-conviction events.</p>
        </div>

        <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-inner shrink-0">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                filter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
            <RefreshCw className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p className="font-bold uppercase tracking-widest text-xs">Synchronizing Alert Protocol...</p>
          </div>
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const Icon = getTypeIcon(alert.type);
            return (
              <div 
                key={alert.id} 
                className={cn(
                  "group relative overflow-hidden rounded-[2.5rem] border p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                  getCardStyles(alert.severity)
                )}
              >
                {/* Visual Flair */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 opacity-50 rounded-full -mr-32 -mt-32 blur-3xl" />
                
                <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                  {/* Left Column: ID & Status */}
                  <div className="flex flex-row lg:flex-col items-start justify-between lg:justify-start gap-4">
                    <div className={cn(
                      "w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg border-2",
                      getSeverityStyles(alert.severity)
                    )}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="text-right lg:text-left">
                      <p className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 mb-1">Source Index</p>
                      <span className="text-xs font-bold text-zinc-900 bg-white px-3 py-1 rounded-full border border-zinc-200">
                        {alert.type}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Message & Details */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="text-2xl font-black text-zinc-900 tracking-tight">{alert.ticker}</span>
                       <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                         alert.severity === 'CRITICAL' ? "text-red-600 bg-red-100" : 
                         alert.severity === 'HIGH' ? "text-orange-600 bg-orange-100" : 
                         "text-blue-600 bg-blue-100"
                       )}>
                         {alert.severity} PRIORITY
                       </span>
                    </div>
                    
                    <p className="text-xl font-bold text-zinc-800 leading-tight">
                      {alert.message}
                    </p>

                    <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">
                        <Zap className="w-3 h-3 fill-current" />
                        AI Attribution Reasoning
                      </div>
                      <p className="text-sm text-zinc-600 leading-relaxed font-medium italic">
                        "{alert.details.reasoning}"
                      </p>
                      {alert.details.decision_action && (
                        <div className="pt-4 border-t border-zinc-100 flex items-center gap-4">
                          <span className={cn(
                            "px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                            alert.details.decision_action === 'BUY' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                          )}>
                            ACTION: {alert.details.decision_action}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                            Ref: {alert.details.decision_reasoning}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions & Meta */}
                  <div className="lg:w-48 flex flex-col justify-between items-end gap-6 border-t lg:border-t-0 lg:border-l border-zinc-200/50 pt-6 lg:pt-0 lg:pl-6">
                    <div className="text-right w-full">
                      <div className="flex items-center justify-end gap-2 text-zinc-400 mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold tracking-tighter uppercase">{alert.timestamp}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => onTickerNavigate(alert.ticker)}
                      className="w-full flex items-center justify-between gap-3 px-6 py-4 rounded-2xl bg-zinc-900 text-white font-black text-xs uppercase tracking-widest hover:bg-zinc-800 hover:gap-5 transition-all group/btn shadow-xl shadow-zinc-200"
                    >
                      Analyze
                      <ExternalLink className="w-4 h-4 opacity-50 group-hover/btn:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-40 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-200">
             <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-100">
               <ShieldAlert className="w-10 h-10 text-zinc-200" />
             </div>
             <p className="text-zinc-900 font-black uppercase text-sm tracking-widest">Protocol Buffer Empty</p>
             <p className="text-zinc-400 text-xs font-medium mt-1">No high-conviction alerts meet current triage thresholds.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
