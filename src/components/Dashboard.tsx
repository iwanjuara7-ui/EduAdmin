import React from 'react';
import { 
  Users, BookOpen, ClipboardList, FileText, 
  Calendar, TrendingUp, Plus, FileUp 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { StatCard, QuickAction } from './Common';

const CHART_DATA = [
  { name: 'Jan', docs: 4, students: 40 },
  { name: 'Feb', docs: 7, students: 42 },
  { name: 'Mar', docs: 12, students: 45 },
  { name: 'Apr', docs: 9, students: 45 },
  { name: 'May', docs: 15, students: 48 },
  { name: 'Jun', docs: 22, students: 50 },
];

export default function Dashboard({ stats, user, setView }: any) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Selamat Datang, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-400 mt-1">Berikut ringkasan administrasi Anda hari ini.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
          <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="pr-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Hari Ini</p>
            <p className="text-sm font-semibold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Total Siswa" value={stats.students} color="from-blue-500 to-cyan-500" trend="+2 bulan ini" />
        <StatCard icon={BookOpen} label="Agenda Guru" value={stats.agenda} color="from-purple-500 to-indigo-500" trend="Aktif" />
        <StatCard icon={ClipboardList} label="Laporan" value={stats.reports} color="from-emerald-500 to-teal-500" trend="Selesai" />
        <StatCard icon={FileText} label="E-Raport" value={stats.eraport} color="from-orange-500 to-pink-500" trend="Semester 1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Statistik Administrasi
            </h3>
            <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none">
              <option className="bg-slate-900">6 Bulan Terakhir</option>
              <option className="bg-slate-900">1 Tahun Terakhir</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA}>
                <defs>
                  <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="docs" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorDocs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6">Aksi Cepat</h3>
          <div className="space-y-4 flex-1">
            <QuickAction icon={Plus} label="Tambah Siswa Baru" onClick={() => setView('siswa')} />
            <QuickAction icon={FileUp} label="Upload Agenda PDF" onClick={() => setView('agenda')} />
            <QuickAction icon={ClipboardList} label="Buat Laporan Piket" onClick={() => setView('laporan')} />
            <QuickAction icon={Sparkles} label="AI Document Gen" primary onClick={() => setView('ai-doc')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkles(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
