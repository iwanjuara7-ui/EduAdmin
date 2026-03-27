import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { 
  Search, Download, Upload, Plus, Users, 
  Edit2, Trash2, X 
} from 'lucide-react';
import { cn } from '../utils';
import { Input } from './Common';

export default function SiswaModule({ token, addToast, refreshStats, students, setStudents, fetchStudents }: { token: string, addToast: any, refreshStats: any, students: any[], setStudents: any, fetchStudents: any }) {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newStudent, setNewStudent] = useState({ nis: '', name: '', className: 'X IPA 1' });
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const formattedData = jsonData.map((item: any) => {
          const normalizedItem: any = {};
          Object.keys(item).forEach(key => {
            normalizedItem[key.toLowerCase().trim()] = item[key];
          });

          return {
            nis: String(normalizedItem.nis || normalizedItem['nomor induk'] || normalizedItem['id'] || '').split('.')[0],
            name: String(normalizedItem.nama || normalizedItem.name || normalizedItem['nama lengkap'] || ''),
            className: String(normalizedItem.kelas || normalizedItem.class || normalizedItem.classname || 'X IPA 1')
          };
        }).filter(item => item.nis && item.name);

        if (formattedData.length === 0) {
          setLoading(false);
          return addToast('Format file tidak valid atau data kosong. Gunakan kolom: NIS, Nama, Kelas', 'error');
        }

        const res = await fetch('/api/students/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ students: formattedData })
        });

        if (res.ok) {
          addToast(`${formattedData.length} siswa berhasil diimpor`);
          setStudents((prev: any[]) => [...formattedData.map((s: any) => ({ ...s, nama: s.name, kelas: s.className })), ...prev]);
          refreshStats();
        } else {
          const errData = await res.json();
          addToast(errData.error || 'Gagal mengimpor data siswa', 'error');
        }
      } catch (err) {
        console.error('Bulk upload error:', err);
        addToast('Terjadi kesalahan saat membaca file', 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const templateData = [
      { NIS: '12345678', Nama: 'Budi Santoso', Kelas: 'X IPA 1' },
      { NIS: '87654321', Nama: 'Siti Aminah', Kelas: 'X IPA 2' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "Template_Tambah_Siswa.xlsx");
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ...newStudent, nis: String(newStudent.nis).split('.')[0] })
    });
    if (res.ok) {
      addToast('Siswa berhasil ditambahkan');
      setIsModalOpen(false);
      setNewStudent({ nis: '', name: '', className: 'X IPA 1' });
      setStudents((prev: any[]) => [{ nis: String(newStudent.nis).split('.')[0], nama: newStudent.name, kelas: newStudent.className }, ...prev]);
      refreshStats();
    } else {
      addToast('Gagal menambahkan siswa (NIS mungkin sudah ada)', 'error');
    }
  };

  const handleEdit = async (e: any) => {
    e.preventDefault();
    const res = await fetch(`/api/students/${editingStudent.nis}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editingStudent.name, className: editingStudent.class })
    });
    if (res.ok) {
      addToast('Data siswa berhasil diperbarui');
      setIsEditModalOpen(false);
      setStudents((prev: any[]) => prev.map(s => s.nis === editingStudent.nis ? { ...s, nama: editingStudent.name, kelas: editingStudent.class } : s));
      setEditingStudent(null);
    } else {
      addToast('Gagal memperbarui data siswa', 'error');
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    setLoading(true);
    const res = await fetch(`/api/students/${studentToDelete}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      addToast('Siswa berhasil dihapus');
      setIsDeleteModalOpen(false);
      setStudents((prev: any[]) => prev.filter(s => s.nis !== studentToDelete));
      setStudentToDelete(null);
      refreshStats();
    } else {
      addToast('Gagal menghapus siswa', 'error');
    }
    setLoading(false);
  };

  const filtered = React.useMemo(() => {
    return students.filter(s => 
      ((s?.nama?.toLowerCase() || '').includes(search.toLowerCase()) || 
      (s?.nis?.toString() || '').includes(search)) &&
      (selectedClass === 'Semua Kelas' || s.kelas === selectedClass)
    );
  }, [students, search, selectedClass]);

  const uniqueClasses = Array.from(new Set(students.map(s => s.kelas).filter(Boolean))).sort();
  const defaultClasses = ['X IPA 1', 'X IPA 2', 'X IPS 1', 'XI IPA 1', 'XI IPS 1', 'XII IPA 1'];
  const allClassSuggestions = Array.from(new Set([...defaultClasses, ...uniqueClasses])).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              placeholder="Cari nama atau NIS..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500/50 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <select 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500/50 text-sm appearance-none"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="Semua Kelas" className="bg-slate-900">Semua Kelas</option>
              {allClassSuggestions.map(c => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleBulkUpload}
          />
          <button 
            onClick={downloadTemplate}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-medium text-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-medium text-sm transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {loading ? 'Mengimpor...' : 'Import Excel'}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 text-sm hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" /> Tambah Siswa
          </button>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">NIS</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Nama Lengkap</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Kelas</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length > 0 ? (
                filtered.slice(0, displayLimit).map((s, idx) => (
                  <tr key={s.id || s.nis || idx} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-5 font-mono text-xs text-slate-400">{String(s?.nis || '').split('.')[0]}</td>
                    <td className="px-8 py-5 font-semibold text-sm">{s?.nama || 'Unknown'}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                          {s?.kelas || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingStudent({
                              nis: s.nis,
                              name: s.nama,
                              class: s.kelas
                            });
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Edit Siswa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setStudentToDelete(s.nis);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                          title="Hapus Siswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-500">
                      <Users className="w-12 h-12 opacity-10" />
                      <p className="text-sm italic">Belum ada data siswa. Tambahkan siswa pertama Anda.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingStudent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingStudent(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Edit Siswa</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleEdit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">NIS (Tidak dapat diubah)</label>
                  <input 
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-slate-500 text-sm cursor-not-allowed"
                    value={String(editingStudent.nis).split('.')[0]}
                  />
                </div>
                <Input 
                  label="Nama Lengkap" 
                  placeholder="Budi Santoso" 
                  value={editingStudent.name} 
                  onChange={(e: any) => setEditingStudent({...editingStudent, name: e.target.value})} 
                  required 
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Kelas</label>
                  <input 
                    list="class-suggestions-edit"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                    value={editingStudent.class}
                    onChange={(e: any) => setEditingStudent({...editingStudent, class: e.target.value})}
                    placeholder="Contoh: X IPA 1"
                    required
                  />
                  <datalist id="class-suggestions-edit">
                    {allClassSuggestions.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
                >
                  Simpan Perubahan
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
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
              <h3 className="text-xl font-bold mb-2">Hapus Siswa?</h3>
              <p className="text-slate-400 text-sm mb-8">Tindakan ini tidak dapat dibatalkan. Seluruh data nilai siswa ini juga mungkin terpengaruh.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 font-bold text-sm transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 rounded-xl font-bold text-white shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {filtered.length > displayLimit && (
        <div className="flex justify-center pt-8">
          <button 
            onClick={() => setDisplayLimit(prev => prev + 15)}
            className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-sm font-bold transition-all"
          >
            Muat Lebih Banyak
          </button>
        </div>
      )}

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
              className="w-full max-w-md glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Tambah / Replace Siswa</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-6">
                <Input label="NIS" placeholder="12345678" value={newStudent.nis} onChange={(e: any) => setNewStudent({...newStudent, nis: e.target.value})} required />
                <Input label="Nama Lengkap" placeholder="Budi Santoso" value={newStudent.name} onChange={(e: any) => setNewStudent({...newStudent, name: e.target.value})} required />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Kelas</label>
                  <input 
                    list="class-suggestions-add"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                    value={newStudent.className}
                    onChange={(e: any) => setNewStudent({...newStudent, className: e.target.value})}
                    placeholder="Contoh: X IPA 1"
                    required
                  />
                  <datalist id="class-suggestions-add">
                    {allClassSuggestions.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <button className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all mt-4">
                  Simpan Data Siswa
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
