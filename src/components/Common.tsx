import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../utils';

export function Input({ label, ...props }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">{label}</label>
      <input 
        {...props}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-slate-600 text-sm"
      />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, color, trend }: any) {
  return (
    <div className="glass glass-hover rounded-3xl p-6 relative overflow-hidden group">
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-2xl bg-gradient-to-br", color)}></div>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg", color)}>
          <Icon className="text-white w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">{trend}</span>
      </div>
      <p className="text-slate-400 text-sm font-medium">{label}</p>
      <h4 className="text-3xl font-bold mt-1 tracking-tight">{value}</h4>
    </div>
  );
}

export function QuickAction({ icon: Icon, label, primary, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 font-medium group",
        primary 
          ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]" 
          : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 hover:border-white/10"
      )}
    >
      <div className={cn("p-2 rounded-xl transition-colors", primary ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10")}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm">{label}</span>
      <ChevronRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
