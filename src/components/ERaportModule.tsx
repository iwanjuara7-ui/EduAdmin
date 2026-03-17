import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, Plus, BookOpen, TrendingUp, Users, 
  Trash2, X, Download 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../utils';
import { Input } from './Common';

export default function ERaportModule({ token, addToast, students, fetchStudents }: { token: string, addToast: any, students: any[], fetchStudents: any }) {
  const [grades, setGrades] = useState<any[]>([]);
  const [kkm, setKkm] = useState<number>(75);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKkmModalOpen, setIsKkmModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState<number | null>(null);
  const [newGrade, setNewGrade] = useState({ 
    student_nis: '', 
    score: 0, 
    semester: 'Ganjil',
    tugas1: 0,
    tugas2: 0,
    formatif1: 0,
    formatif2: 0,
    pts: 0,
    uas: 0
  });
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || '{}'));

  const fetchData = async () => {
    try {
      const [gradesRes, kkmRes] = await Promise.all([
        fetch('/api/eraport', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/kkm', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const gradesData = await gradesRes.json();
      const kkmData = await kkmRes.json();
      
      setGrades(gradesData);
      
      const subjectKkm = kkmData.find((k: any) => k.subject === user.subject);
      if (subjectKkm) setKkm(subjectKkm.value);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchStudents();
  }, []);

  const handleAddGrade = async (e: any) => {
    e.preventDefault();
    if (!newGrade.student_nis) return addToast('Pilih siswa terlebih dahulu', 'error');
    
    const avgFormative = (newGrade.tugas1 + newGrade.tugas2 + newGrade.formatif1 + newGrade.formatif2) / 4;
    const finalScore = Math.round((avgFormative * 2 + newGrade.pts + newGrade.uas) / 4);

    setLoading(true);
    try {
      const res = await fetch('/api/eraport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...newGrade, score: finalScore, subject: user.subject })
      });
      if (res.ok) {
        addToast('Nilai berhasil disimpan');
        setIsModalOpen(false);
        setNewGrade({ 
          student_nis: '', score: 0, semester: 'Ganjil',
          tugas1: 0, tugas2: 0, formatif1: 0, formatif2: 0, pts: 0, uas: 0 
        });
        fetchData();
      }
    } catch (e) {
      addToast('Gagal menyimpan nilai', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateKkm = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/kkm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subject: user.subject, value: kkm })
      });
      if (res.ok) {
        addToast('KKM berhasil diperbarui');
        setIsKkmModalOpen(false);
        fetchData();
      }
    } catch (e) {
      addToast('Gagal memperbarui KKM', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGrade = async () => {
    if (gradeToDelete === null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/eraport/${gradeToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Nilai berhasil dihapus');
        setIsDeleteModalOpen(false);
        setGradeToDelete(null);
        fetchData();
      }
    } catch (e) {
      addToast('Gagal menghapus nilai', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (grades.length === 0) return addToast('Tidak ada data untuk diekspor', 'error');
    
    const exportData = grades.map(g => ({
      'Nama Siswa': g.student_name,
      'NIS': String(g.student_nis).split('.')[0],
      'Semester': g.semester,
      'Mata Pelajaran': g.subject,
      'Tugas 1': g.tugas1,
      'Tugas 2': g.tugas2,
      'Formatif 1': g.formatif1,
      'Formatif 2': g.formatif2,
      'PTS': g.pts,
      'UAS': g.uas,
      'Nilai Akhir': g.score,
      'KKM': kkm,
      'Status': g.score >= kkm ? 'Tuntas' : 'Remedial'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "E-Raport");
    XLSX.writeFile(wb, `E-Raport_${user.subject}_${new Date().toLocaleDateString()}.xlsx`);
    addToast('Data berhasil diekspor ke Excel');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">E-Raport Digital</h1>
          <p className="text-slate-400 mt-1">Input nilai dan kelola KKM mata pelajaran {user.subject}.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-2xl border border-emerald-500/20 font-bold text-sm text-emerald-400 transition-all"
          >
            <Download className="w-4 h-4" /> Download Excel
          </button>
          <button 
            onClick={() => setIsKkmModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-bold text-sm transition-all"
          >
            <Settings className="w-4 h-4" /> Atur KKM ({kkm})
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" /> Input Nilai Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-slate-400 text-sm">Mata Pelajaran</p>
          <h4 className="text-xl font-bold">{user.subject}</h4>
        </div>
        <div className="glass rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-slate-400 text-sm">KKM Saat Ini</p>
          <h4 className="text-xl font-bold">{kkm}</h4>
        </div>
        <div className="glass rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-slate-400 text-sm">Siswa Terinput</p>
          <h4 className="text-xl font-bold">{grades.length}</h4>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Siswa</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">T1</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">T2</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">F1</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">F2</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">PTS</th>
                <th className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">UAS</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Akhir</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {grades.map(g => (
                <tr key={g.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-semibold text-sm">{g.student_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{String(g.student_nis).split('.')[0]} • {g.semester}</div>
                  </td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.tugas1}</td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.tugas2}</td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.formatif1}</td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.formatif2}</td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.pts}</td>
                  <td className="px-4 py-5 text-xs text-slate-400">{g.uas}</td>
                  <td className="px-6 py-5 font-bold text-lg text-white">{g.score}</td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                      g.score >= kkm 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {g.score >= kkm ? 'Tuntas' : 'Remedial'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => {
                        setGradeToDelete(g.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Nilai Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl glass rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Input Nilai Siswa</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddGrade} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Pilih Siswa</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={newGrade.student_nis}
                      onChange={(e: any) => setNewGrade({...newGrade, student_nis: e.target.value})}
                      required
                    >
                      <option value="" className="bg-slate-900">-- Pilih Siswa --</option>
                      {students.map(s => (
                        <option key={s.nis} value={s.nis} className="bg-slate-900">{s.nama} ({String(s.nis).split('.')[0]})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Semester</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={newGrade.semester}
                      onChange={(e: any) => setNewGrade({...newGrade, semester: e.target.value})}
                    >
                      <option value="Ganjil" className="bg-slate-900">Ganjil</option>
                      <option value="Genap" className="bg-slate-900">Genap</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input label="Tugas 1" type="number" value={newGrade.tugas1} onChange={(e: any) => setNewGrade({...newGrade, tugas1: Number(e.target.value)})} />
                  <Input label="Tugas 2" type="number" value={newGrade.tugas2} onChange={(e: any) => setNewGrade({...newGrade, tugas2: Number(e.target.value)})} />
                  <Input label="Formatif 1" type="number" value={newGrade.formatif1} onChange={(e: any) => setNewGrade({...newGrade, formatif1: Number(e.target.value)})} />
                  <Input label="Formatif 2" type="number" value={newGrade.formatif2} onChange={(e: any) => setNewGrade({...newGrade, formatif2: Number(e.target.value)})} />
                  <Input label="Nilai PTS" type="number" value={newGrade.pts} onChange={(e: any) => setNewGrade({...newGrade, pts: Number(e.target.value)})} />
                  <Input label="Nilai UAS" type="number" value={newGrade.uas} onChange={(e: any) => setNewGrade({...newGrade, uas: Number(e.target.value)})} />
                </div>

                <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <p className="text-xs text-slate-400 mb-1">Estimasi Nilai Akhir</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {Math.round((( (newGrade.tugas1 + newGrade.tugas2 + newGrade.formatif1 + newGrade.formatif2) / 4 ) * 2 + newGrade.pts + newGrade.uas) / 4)}
                  </p>
                </div>

                <button className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all">
                  Simpan Nilai Raport
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KKM Modal */}
      <AnimatePresence>
        {isKkmModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsKkmModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm glass rounded-[2rem] p-8 shadow-2xl relative z-10"
            >
              <h3 className="text-xl font-bold mb-6">Atur KKM {user.subject}</h3>
              <form onSubmit={handleUpdateKkm} className="space-y-6">
                <Input label="Nilai KKM" type="number" value={kkm} onChange={(e: any) => setKkm(Number(e.target.value))} required />
                <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all">
                  Perbarui KKM
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm glass rounded-[2rem] p-8 shadow-2xl relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Hapus Nilai?</h3>
              <p className="text-slate-400 text-sm mb-8">Data nilai ini akan dihapus permanen dari sistem.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold">Batal</button>
                <button onClick={handleDeleteGrade} className="flex-1 py-3 bg-rose-500 rounded-xl font-bold text-white">Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
