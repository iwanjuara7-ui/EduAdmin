import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, FileText, ClipboardList, Calendar, 
  Download, X 
} from 'lucide-react';
import { cn } from '../utils';
import { Input } from './Common';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export default function DocumentModule({ type, token, addToast }: { type: 'agenda' | 'report', token: string, addToast: any }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({ 
    title: '', 
    date: new Date().toISOString().split('T')[0], 
    content: '',
    reportType: 'Piket' 
  });

  const fetchDocs = async () => {
    const endpoint = type === 'agenda' ? '/api/agenda' : '/api/reports';
    const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    setDocs(data);
  };

  useEffect(() => { fetchDocs(); }, [type]);

  const handleDownloadPDF = async () => {
    if (docs.length === 0) return addToast('Tidak ada data untuk diunduh', 'error');

    const contentElement = document.createElement('div');
    contentElement.style.padding = '40px';
    contentElement.style.width = '800px';
    contentElement.style.background = 'white';
    contentElement.style.color = 'black';
    contentElement.style.fontFamily = 'Arial, sans-serif';

    const title = type === 'agenda' ? 'AGENDA GURU' : 'LAPORAN ADMINISTRASI';
    
    contentElement.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px;">
        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
        <p style="margin: 5px 0; color: #666;">Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px;">No</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px;">Tanggal</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px;">Judul</th>
            ${type === 'report' ? '<th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px;">Jenis</th>' : ''}
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 12px;">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${docs.map((doc, idx) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${idx + 1}</td>
              <td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${doc.tanggal || doc.date}</td>
              <td style="border: 1px solid #ddd; padding: 10px; font-size: 11px; font-weight: bold;">${doc.judul || doc.title}</td>
              ${type === 'report' ? `<td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${doc.type || '-'}</td>` : ''}
              <td style="border: 1px solid #ddd; padding: 10px; font-size: 11px;">${doc.content || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.body.appendChild(contentElement);
    setLoading(true);
    try {
      addToast('Menyiapkan PDF...', 'info');
      const canvas = await html2canvas(contentElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
      addToast('PDF berhasil diunduh');
    } catch (err) {
      addToast('Gagal mengunduh PDF', 'error');
    } finally {
      document.body.removeChild(contentElement);
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/manual', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          title: manualData.title,
          date: manualData.date,
          content: manualData.content,
          type: type === 'agenda' ? 'agenda' : manualData.reportType
        })
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocs(prev => [newDoc, ...prev]);
        addToast('Data berhasil disimpan secara manual');
        setIsManualModalOpen(false);
        setManualData({ ...manualData, title: '', content: '' });
      }
    } catch (e) {
      addToast('Gagal menyimpan data', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{type === 'agenda' ? 'Agenda Guru' : 'Laporan Administrasi'}</h1>
          <p className="text-slate-400 mt-1">Kelola dokumen format PDF atau input manual di sini.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Input Manual
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {loading ? 'Memproses...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {docs.map((doc, idx) => (
          <div key={doc.id || `doc-${idx}`} className="glass glass-hover rounded-3xl p-6 flex flex-col group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                {doc.file_path ? <FileText className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
              </div>
              {doc.type && doc.type !== 'agenda' && (
                <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                  {doc.type}
                </span>
              )}
            </div>
            <h4 className="font-bold text-lg mb-1 line-clamp-1">{doc.judul || doc.title}</h4>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
              <Calendar className="w-3 h-3" /> {doc.tanggal || doc.date}
            </p>
            {doc.content && (
              <p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-1 italic">
                "{doc.content}"
              </p>
            )}
            <div className="mt-auto flex gap-2 pt-4 border-t border-white/5">
              <button className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold transition-colors">Lihat</button>
              {(doc.file_pdf || doc.file_path) && (
                <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors"><Download className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        ))}
        {docs.length === 0 && !loading && (
          <div className="col-span-full py-32 glass rounded-3xl flex flex-col items-center justify-center text-slate-500 gap-4 border-dashed border-2 border-white/5">
            <ClipboardList className="w-12 h-12 opacity-10" />
            <p className="italic">Belum ada data yang tersedia.</p>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg glass rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Input Manual</h3>
                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleManualSubmit} className="space-y-6">
                {type === 'report' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Jenis Laporan</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={manualData.reportType}
                      onChange={(e: any) => setManualData({...manualData, reportType: e.target.value})}
                    >
                      <option value="Piket" className="bg-slate-900">Laporan Piket</option>
                      <option value="Wali Kelas" className="bg-slate-900">Laporan Wali Kelas</option>
                    </select>
                  </div>
                )}
                <Input label="Judul Dokumen" placeholder="Contoh: Agenda Harian 15 Maret" value={manualData.title} onChange={(e: any) => setManualData({...manualData, title: e.target.value})} required />
                <Input label="Tanggal" type="date" value={manualData.date} onChange={(e: any) => setManualData({...manualData, date: e.target.value})} required />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Konten / Ringkasan</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm min-h-[150px]"
                    placeholder="Tuliskan ringkasan agenda atau laporan di sini..."
                    value={manualData.content}
                    onChange={(e: any) => setManualData({...manualData, content: e.target.value})}
                    required
                  />
                </div>
                <button className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all">
                  Simpan Data
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
