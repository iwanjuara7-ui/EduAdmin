import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Plus, FileText, Calendar, 
  Download, FileUp, X, Wand2, Loader2,
  FileJson, File as FileIcon
} from 'lucide-react';
import { cn, renderMarkdownToHtml } from '../utils';
import { Input } from './Common';
import { generateEducationDocument, generateFromFile } from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const DocCard = React.memo(({ doc, onSelect, onDownload }: { doc: any; onSelect: (doc: any) => void; onDownload: (doc: any, format: 'pdf' | 'doc') => void }) => {
  return (
    <div className="glass rounded-3xl p-8 flex flex-col border border-white/5">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
          <FileText className="w-6 h-6" />
        </div>
        <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
          {doc.type}
        </span>
      </div>
      <div className="prose prose-invert prose-sm max-w-none line-clamp-[10] mb-6 overflow-hidden">
        <ReactMarkdown 
          remarkPlugins={[remarkMath, remarkGfm]} 
          rehypePlugins={[rehypeKatex]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 custom-scrollbar rounded-xl border border-white/10">
                <table className="min-w-full">{children}</table>
              </div>
            ),
            img: ({ src, ...props }) => {
              if (!src) return null;
              return <img src={src} {...props} />;
            }
          }}
        >
          {doc.content.length > 500 ? doc.content.substring(0, 500) + '...' : doc.content}
        </ReactMarkdown>
      </div>
      <div className="mt-auto flex gap-2 pt-4 border-t border-white/5">
        <button 
          onClick={() => onSelect(doc)}
          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold transition-colors"
        >
          Lihat Detail
        </button>
        <div className="flex gap-1">
          <button 
            onClick={() => onDownload(doc, 'pdf')}
            title="Download PDF"
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-rose-400 hover:text-rose-300 transition-colors"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDownload(doc, 'doc')}
            title="Download DOC"
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <FileIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function AIDocModule({ token, addToast, docs, setDocs }: { token: string; addToast: any; docs: any[]; setDocs: any }) {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [params, setParams] = useState({
    type: 'RPP (Rencana Pelaksanaan Pembelajaran)',
    subject: 'Matematika',
    className: 'X IPA 1',
    topic: '',
    objectives: '',
    duration: '2 x 45 Menit',
    semester: 'Ganjil',
    academicCalendar: ''
  });

  const [displayLimit, setDisplayLimit] = useState(6);

  const handleGenerate = async (e: any) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const content = await generateEducationDocument(params);
      
      const res = await fetch('/api/ai-documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: params.type,
          content: content,
          pdf_url: null
        })
      });

      if (res.ok) {
        const newDoc = await res.json();
        // Immediate state update for better UX and reliability
        setDocs(prev => [newDoc, ...prev]);
        addToast('Dokumen AI berhasil dibuat');
        setIsModalOpen(false);
        // Reset params
        setParams({
          ...params,
          topic: '',
          objectives: ''
        });
      }
    } catch (e) {
      addToast('Gagal membuat dokumen AI', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromFile = async (e: any) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast('Harap pilih file terlebih dahulu', 'error');
      return;
    }

    setGenerating(true);
    try {
      const content = await generateFromFile(uploadFile, {
        type: params.type,
        subject: params.subject,
        className: params.className,
        duration: params.duration
      });

      const res = await fetch('/api/ai-documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: params.type,
          content: content,
          pdf_url: null
        })
      });

      if (res.ok) {
        const newDoc = await res.json();
        // Immediate state update for better UX and reliability
        setDocs(prev => [newDoc, ...prev]);
        addToast('Dokumen AI berhasil dibuat dari file');
        setIsUploadModalOpen(false);
        setUploadFile(null);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan dokumen');
      }
    } catch (e: any) {
      addToast(e.message || 'Gagal membuat dokumen AI dari file', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (doc: any, format: 'pdf' | 'doc') => {
    const contentElement = document.createElement('div');
    contentElement.style.padding = '50px';
    contentElement.style.width = '800px';
    contentElement.style.background = 'white';
    contentElement.style.color = 'black';
    contentElement.style.fontFamily = '"Times New Roman", Times, serif';
    contentElement.style.lineHeight = '1.5';
    
    const htmlContent = renderMarkdownToHtml(doc.content);
    
    contentElement.innerHTML = `
      <div style="margin-bottom: 30px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <h1 style="margin: 0; font-size: 20pt; text-transform: uppercase;">DOKUMEN PENDIDIKAN AI</h1>
        <p style="margin: 5px 0; font-size: 12pt;">Dihasilkan oleh: AI Guru Juara</p>
      </div>
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; font-size: 11pt; border-collapse: collapse;">
          <tr>
            <td style="width: 120px; font-weight: bold; padding: 3px 0;">Jenis Dokumen</td>
            <td style="width: 20px;">:</td>
            <td>${doc.type}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 3px 0;">Tanggal Buat</td>
            <td>:</td>
            <td>${new Date(doc.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      <div id="markdown-content" style="text-align: justify;">
        ${htmlContent}
      </div>
      <div style="margin-top: 50px; text-align: right; font-size: 10pt; color: #666;">
        <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
      </div>
    `;
    
    document.body.appendChild(contentElement);
    
    if (format === 'pdf') {
      try {
        addToast('Sedang menyiapkan PDF...', 'info');
        const canvas = await html2canvas(contentElement, { 
          scale: 2,
          useCORS: true,
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // Handle multiple pages if needed
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`${doc.type.replace(/\//g, '-')}.pdf`);
        addToast('PDF berhasil didownload');
      } catch (err) {
        console.error('PDF Error:', err);
        addToast('Gagal membuat PDF', 'error');
      }
    } else {
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word</title><style>body { font-family: 'Times New Roman', serif; }</style></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + contentElement.innerHTML + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileLink = document.createElement("a");
      document.body.appendChild(fileLink);
      fileLink.href = source;
      fileLink.download = `${doc.type.replace(/\//g, '-')}.doc`;
      fileLink.click();
      document.body.removeChild(fileLink);
      addToast('DOC berhasil didownload');
    }
    
    document.body.removeChild(contentElement);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Document Generator</h1>
          <p className="text-slate-400 mt-1">Gunakan kecerdasan buatan untuk membuat RPP, Modul, dan Materi Ajar.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
          >
            <Wand2 className="w-4 h-4" /> Buat Dokumen Baru
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-white border border-white/10 shadow-lg transition-all"
          >
            <FileUp className="w-4 h-4" /> Generate dari File
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {docs.slice(0, displayLimit).map((doc, idx) => (
          <DocCard 
            key={doc.id || `doc-${idx}`} 
            doc={doc} 
            onSelect={setSelectedDoc} 
            onDownload={handleDownload} 
          />
        ))}
        {docs.length === 0 && (
          <div className="col-span-full py-32 glass rounded-3xl flex flex-col items-center justify-center text-slate-500 gap-4 border-dashed border-2 border-white/5">
            <Sparkles className="w-12 h-12 opacity-10" />
            <p className="italic text-center px-4">Belum ada dokumen AI. Klik "Buat Dokumen Baru" untuk memulai.</p>
          </div>
        )}
      </div>

      {docs.length > displayLimit && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setDisplayLimit(prev => prev + 6)}
            className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-sm font-bold transition-all"
          >
            Muat Lebih Banyak
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold">{selectedDoc.type}</h3>
                  <p className="text-slate-400 text-sm">Dibuat pada {new Date(selectedDoc.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownload(selectedDoc, 'pdf')}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 text-rose-400 transition-colors text-xs font-bold"
                  >
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button 
                    onClick={() => handleDownload(selectedDoc, 'doc')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 text-blue-400 transition-colors text-xs font-bold"
                  >
                    <FileIcon className="w-4 h-4" /> DOC
                  </button>
                  <button onClick={() => setSelectedDoc(null)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div className="prose prose-invert prose-lg max-w-none bg-white/5 p-10 rounded-[2rem] border border-white/10">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath, remarkGfm]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-8 custom-scrollbar rounded-2xl border border-white/10 shadow-2xl">
                          <table className="min-w-full">{children}</table>
                        </div>
                      ),
                      img: ({ src, ...props }) => {
                        if (!src) return null;
                        return <img src={src} {...props} />;
                      }
                    }}
                  >
                    {selectedDoc.content}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </div>
        )}

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
              className="w-full max-w-2xl glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">AI Document Generator</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Jenis Dokumen</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.type}
                      onChange={(e: any) => setParams({...params, type: e.target.value})}
                    >
                      <option value="RPP (Rencana Pelaksanaan Pembelajaran)" className="bg-slate-900">RPP (Kurikulum Merdeka)</option>
                      <option value="Modul Ajar" className="bg-slate-900">Modul Ajar</option>
                      <option value="Program Tahunan (ProTa)" className="bg-slate-900">Program Tahunan (ProTa)</option>
                      <option value="Program Semester (ProSem)" className="bg-slate-900">Program Semester (ProSem)</option>
                      <option value="Materi Pembelajaran" className="bg-slate-900">Materi Pembelajaran</option>
                      <option value="Lembar Kerja Siswa (LKS)" className="bg-slate-900">Lembar Kerja Siswa (LKS)</option>
                    </select>
                  </div>
                  <Input label="Topik / Judul Materi" placeholder="Contoh: Trigonometri Dasar" value={params.topic} onChange={(e: any) => setParams({...params, topic: e.target.value})} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Mata Pelajaran" placeholder="Contoh: Matematika" value={params.subject} onChange={(e: any) => setParams({...params, subject: e.target.value})} required />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Semester</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.semester}
                      onChange={(e: any) => setParams({...params, semester: e.target.value})}
                    >
                      <option value="Ganjil" className="bg-slate-900">Ganjil</option>
                      <option value="Genap" className="bg-slate-900">Genap</option>
                    </select>
                  </div>
                </div>

                {(params.type.includes('ProSem') || params.type.includes('ProTa')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Informasi Minggu Efektif (Opsional)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm min-h-[100px]"
                      placeholder="Contoh: Juli (Mg 1-2 Libur), Agustus (Mg 1-4 Efektif), dst."
                      value={params.academicCalendar}
                      onChange={(e: any) => setParams({...params, academicCalendar: e.target.value})}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tujuan Pembelajaran</label>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm min-h-[100px]"
                    placeholder="Siswa dapat memahami konsep sin, cos, tan..."
                    value={params.objectives}
                    onChange={(e: any) => setParams({...params, objectives: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Kelas" placeholder="X IPA 1" value={params.className} onChange={(e: any) => setParams({...params, className: e.target.value})} required />
                  <Input label="Durasi" placeholder="2 x 45 Menit" value={params.duration} onChange={(e: any) => setParams({...params, duration: e.target.value})} required />
                </div>
                <button 
                  disabled={generating}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {generating ? 'Sedang Merangkai Kata...' : 'Generate dengan AI'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Generate dari File (PDF/DOC)</h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerateFromFile} className="space-y-6">
                <div className="p-6 border-2 border-dashed border-white/10 rounded-3xl text-center hover:border-purple-500/50 transition-colors relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.docx" 
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileUp className="w-12 h-12 text-slate-500 mx-auto mb-4 group-hover:text-purple-400 transition-colors" />
                  <p className="text-sm font-medium text-slate-300">
                    {uploadFile ? uploadFile.name : 'Klik atau seret file PDF/DOCX ke sini'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Maksimal 50MB</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Jenis Dokumen</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.type}
                      onChange={(e: any) => setParams({...params, type: e.target.value})}
                    >
                      <option value="RPP (Rencana Pelaksanaan Pembelajaran)" className="bg-slate-900">RPP (Kurikulum Merdeka)</option>
                      <option value="Modul Ajar" className="bg-slate-900">Modul Ajar</option>
                      <option value="Program Tahunan (ProTa)" className="bg-slate-900">Program Tahunan (ProTa)</option>
                      <option value="Program Semester (ProSem)" className="bg-slate-900">Program Semester (ProSem)</option>
                      <option value="Materi Pembelajaran" className="bg-slate-900">Materi Pembelajaran</option>
                      <option value="Lembar Kerja Siswa (LKS)" className="bg-slate-900">Lembar Kerja Siswa (LKS)</option>
                    </select>
                  </div>
                  <Input label="Mata Pelajaran" placeholder="Contoh: Matematika" value={params.subject} onChange={(e: any) => setParams({...params, subject: e.target.value})} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Kelas" placeholder="X IPA 1" value={params.className} onChange={(e: any) => setParams({...params, className: e.target.value})} required />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Semester</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.semester}
                      onChange={(e: any) => setParams({...params, semester: e.target.value})}
                    >
                      <option value="Ganjil" className="bg-slate-900">Ganjil</option>
                      <option value="Genap" className="bg-slate-900">Genap</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Durasi" placeholder="2 x 45 Menit" value={params.duration} onChange={(e: any) => setParams({...params, duration: e.target.value})} required />
                </div>

                {(params.type.includes('ProSem') || params.type.includes('ProTa')) && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Informasi Minggu Efektif (Opsional)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm min-h-[100px]"
                      placeholder="Contoh: Juli (Mg 1-2 Libur), Agustus (Mg 1-4 Efektif), dst."
                      value={params.academicCalendar}
                      onChange={(e: any) => setParams({...params, academicCalendar: e.target.value})}
                    />
                  </div>
                )}
                
                <button 
                  disabled={generating || !uploadFile}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {generating ? 'Sedang Memproses File...' : 'Proses File dengan AI'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
