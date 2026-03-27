import React, { useState, useEffect } from 'react';
import { 
  Calendar, CheckCircle2, ClipboardList, Users, 
  BarChart3, PieChart, ChevronRight, Download,
  Filter, Search
} from 'lucide-react';
import { cn } from '../utils';

export default function AttendanceModule({ token, addToast, students }: { token: string, addToast: any, students: any[] }) {
  const [viewMode, setViewMode] = useState<'daily' | 'recap'>('daily');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  
  // Recap States
  const [recapType, setRecapType] = useState<'monthly' | 'semester'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState(new Date().getMonth() < 6 ? 2 : 1);
  const [recapData, setRecapData] = useState<any[]>([]);
  const [searchRecap, setSearchRecap] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?date=${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setAttendance(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecap = async () => {
    setLoading(true);
    let startDate, endDate;

    if (recapType === 'monthly') {
      startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`;
    } else {
      const year = selectedSemester === 1 ? selectedYear : selectedYear;
      startDate = selectedSemester === 1 ? `${year}-07-01` : `${year}-01-01`;
      endDate = selectedSemester === 1 ? `${year}-12-31` : `${year}-06-30`;
    }

    try {
      const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal memuat data' }));
        throw new Error(err.error || 'Gagal memuat data');
      }
      const data = await res.json();
      
      // Process data for recap
      const processed = students.map(student => {
        const studentAtt = data.filter((a: any) => a.student_nis === student.nis);
        const counts = {
          Hadir: studentAtt.filter((a: any) => a.status === 'Hadir').length,
          Izin: studentAtt.filter((a: any) => a.status === 'Izin').length,
          Sakit: studentAtt.filter((a: any) => a.status === 'Sakit').length,
          Alpa: studentAtt.filter((a: any) => a.status === 'Alpa').length,
          total: studentAtt.length
        };
        const percentage = counts.total > 0 ? Math.round((counts.Hadir / counts.total) * 100) : 0;
        
        return {
          ...student,
          ...counts,
          percentage,
          history: studentAtt.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
      });

      setRecapData(processed);
    } catch (e) {
      console.error(e);
      addToast('Gagal memuat rekapitulasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchAttendance();
    } else {
      fetchRecap();
    }
  }, [date, viewMode, selectedMonth, selectedYear, selectedSemester, recapType]);

  const handleStatusChange = (studentNis: string, status: string) => {
    setAttendance(prev => {
      const existing = prev.find(a => a.student_nis === studentNis);
      if (existing) {
        return prev.map(a => a.student_nis === studentNis ? { ...a, status } : a);
      } else {
        return [...prev, { student_nis: studentNis, date, status }];
      }
    });
  };

  const markAllPresent = () => {
    const newAttendance = students.map(s => ({
      student_nis: s.nis,
      date: date,
      status: 'Hadir'
    }));
    setAttendance(newAttendance);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ attendance })
      });
      if (res.ok) {
        addToast('Absensi berhasil disimpan');
      }
    } catch (e) {
      addToast('Gagal menyimpan absensi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (nis: string) => {
    return attendance.find(a => a.student_nis === nis)?.status || '';
  };

  const uniqueClasses = Array.from(new Set(students.map(s => s.kelas).filter(Boolean))).sort();

  const filteredStudents = React.useMemo(() => {
    return students.filter(s => 
      selectedClass === 'Semua Kelas' || s.kelas === selectedClass
    );
  }, [students, selectedClass]);

  const filteredRecap = React.useMemo(() => {
    return recapData.filter(s => 
      ((s.nama?.toLowerCase() || '').includes(searchRecap.toLowerCase()) || 
      (s.nis?.toString() || '').includes(searchRecap)) &&
      (selectedClass === 'Semua Kelas' || s.kelas === selectedClass)
    );
  }, [recapData, searchRecap, selectedClass]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Absensi Siswa</h1>
          <p className="text-slate-400 mt-1">Kelola kehadiran dan lihat rekapitulasi periodik.</p>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
          <button 
            onClick={() => setViewMode('daily')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              viewMode === 'daily' ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <Calendar className="w-4 h-4" /> Harian
          </button>
          <button 
            onClick={() => setViewMode('recap')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              viewMode === 'recap' ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <BarChart3 className="w-4 h-4" /> Rekapitulasi
          </button>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <>
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <Calendar className="w-4 h-4 ml-3 text-slate-500" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none px-3 py-2 text-sm focus:outline-none text-white"
                />
              </div>
              <div className="relative w-48">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Users className="w-4 h-4 text-slate-500" />
                </div>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 focus:outline-none focus:border-purple-500/50 text-sm appearance-none"
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                >
                  <option value="Semua Kelas" className="bg-slate-900">Semua Kelas</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={markAllPresent}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-bold text-sm transition-all text-purple-400 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Hadir Semua
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" /> {loading ? 'Menyimpan...' : 'Simpan Absensi'}
              </button>
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">NIS</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Nama Siswa</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Kelas</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(filteredStudents || []).map((student, idx) => {
                    const currentStatus = getStatus(student?.nis);
                    return (
                      <tr key={student?.nis || idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-5 text-sm font-mono text-slate-400">{String(student?.nis || '').split('.')[0]}</td>
                        <td className="px-8 py-5 text-sm font-semibold">{student?.nama || 'Unknown'}</td>
                        <td className="px-8 py-5 text-sm text-slate-400">{student?.kelas || '-'}</td>
                        <td className="px-8 py-5">
                          <div className="flex justify-center gap-2">
                            {['Hadir', 'Izin', 'Sakit', 'Alpa'].map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(student.nis, status)}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                  currentStatus === status
                                    ? status === 'Hadir' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                      : status === 'Izin' ? "bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                      : status === 'Sakit' ? "bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                                      : "bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                                    : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-300"
                                )}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {students.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Users className="w-12 h-12 opacity-10" />
                <p className="italic">Belum ada data siswa. Silakan tambah siswa terlebih dahulu.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => setRecapType('monthly')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    recapType === 'monthly' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Bulanan
                </button>
                <button 
                  onClick={() => setRecapType('semester')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    recapType === 'semester' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Semester
                </button>
              </div>

              <div className="relative w-48">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Users className="w-4 h-4 text-slate-500" />
                </div>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 focus:outline-none focus:border-purple-500/50 text-sm appearance-none"
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                >
                  <option value="Semua Kelas" className="bg-slate-900">Semua Kelas</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c} className="bg-slate-900">{c}</option>
                  ))}
                </select>
              </div>

              {recapType === 'monthly' ? (
                <div className="flex gap-2">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                      <option key={m} value={i + 1} className="bg-slate-900">{m}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y} className="bg-slate-900">{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select 
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value={1} className="bg-slate-900">Semester Ganjil (Jul-Des)</option>
                    <option value={2} className="bg-slate-900">Semester Genap (Jan-Jun)</option>
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y} className="bg-slate-900">{y}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                placeholder="Cari siswa..."
                value={searchRecap}
                onChange={(e) => setSearchRecap(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Siswa</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Hadir</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Izin</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Sakit</th>
                    <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Alpa</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">% Kehadiran</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRecap.map((s) => (
                    <tr key={s.nis} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-sm">{s.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{String(s.nis).split('.')[0]}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-emerald-400 font-bold">{s.Hadir}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-blue-400 font-bold">{s.Izin}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-orange-400 font-bold">{s.Sakit}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-rose-400 font-bold">{s.Alpa}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                            <div 
                              className={cn(
                                "h-full transition-all",
                                s.percentage > 90 ? "bg-emerald-500" : s.percentage > 75 ? "bg-blue-500" : "bg-rose-500"
                              )}
                              style={{ width: `${s.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{s.percentage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedStudent(s)}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Individual Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedStudent(null)} />
          <div className="w-full max-w-2xl glass rounded-[2.5rem] p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold">{selectedStudent.nama}</h3>
                <p className="text-slate-400 text-sm">Detail Kehadiran • {recapType === 'monthly' ? `Bulan ${selectedMonth}` : `Semester ${selectedSemester}`}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <ChevronRight className="w-6 h-6 rotate-90" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Hadir</p>
                <p className="text-2xl font-bold text-emerald-400">{selectedStudent.Hadir}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-blue-500 mb-1">Izin</p>
                <p className="text-2xl font-bold text-blue-400">{selectedStudent.Izin}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-orange-500 mb-1">Sakit</p>
                <p className="text-2xl font-bold text-orange-400">{selectedStudent.Sakit}</p>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-rose-500 mb-1">Alpa</p>
                <p className="text-2xl font-bold text-rose-400">{selectedStudent.Alpa}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-300 px-2">Riwayat Harian</h4>
              <div className="space-y-2">
                {selectedStudent.history.map((h: any) => (
                  <div key={h.date} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium">{new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      h.status === 'Hadir' ? "bg-emerald-500/20 text-emerald-400" :
                      h.status === 'Izin' ? "bg-blue-500/20 text-blue-400" :
                      h.status === 'Sakit' ? "bg-orange-500/20 text-orange-400" :
                      "bg-rose-500/20 text-rose-400"
                    )}>
                      {h.status}
                    </span>
                  </div>
                ))}
                {selectedStudent.history.length === 0 && (
                  <p className="text-center py-8 text-slate-500 italic text-sm">Tidak ada riwayat untuk periode ini.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
