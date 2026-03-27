import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, HelpCircle, Wand2, Loader2, Download, 
  FileText, X, Plus, Trash2, File as FileIcon, FileUp
} from 'lucide-react';
import { cn, renderMarkdownToHtml } from '../utils';
import { Input } from './Common';
import { generateExamQuestions, generateFromFile } from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const QuestionCard = React.memo(({ q, onDownload }: { q: any; onDownload: (q: any, format: 'pdf' | 'doc') => void }) => {
  const [showFull, setShowFull] = React.useState(false);
  const isLong = q.content.length > 1000;

  return (
    <div className="glass rounded-3xl p-8 border border-white/5">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-lg">{q.type}</h4>
            <p className="text-xs text-slate-500">Dibuat pada {new Date(q.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onDownload(q, 'pdf')}
            title="Download PDF"
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-rose-400 hover:text-rose-300 transition-colors"
          >
            <FileText className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onDownload(q, 'doc')}
            title="Download DOC"
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <FileIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className={cn(
        "prose prose-invert prose-sm max-w-none bg-white/5 p-6 rounded-2xl border border-white/10 relative overflow-hidden",
        !showFull && isLong && "max-h-[500px]"
      )}>
        <ReactMarkdown 
          remarkPlugins={[remarkMath, remarkGfm]} 
          rehypePlugins={[rehypeKatex]}
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 custom-scrollbar">
                <table className="min-w-full">{children}</table>
              </div>
            ),
            img: ({ src, alt, ...props }) => {
              if (!src) return null;
              return (
                <div className="my-6 flex flex-col items-center">
                  <div className="relative group overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl transition-all hover:border-purple-500/50">
                    <img 
                      src={src} 
                      alt={alt || "Gambar Soal"} 
                      className="max-w-full h-auto object-contain max-h-[400px] transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('div');
                          errorMsg.className = 'p-8 text-center text-slate-500 text-xs italic flex flex-col items-center gap-2';
                          errorMsg.innerHTML = '<svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Gambar tidak dapat dimuat</span>';
                          parent.appendChild(errorMsg);
                        }
                      }}
                      {...props} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-purple-500/80 px-3 py-1 rounded-full backdrop-blur-sm">Klik untuk memperbesar</span>
                    </div>
                  </div>
                  {alt && (
                    <p className="mt-3 text-[10px] font-medium text-slate-500 italic uppercase tracking-wider">
                      {alt}
                    </p>
                  )}
                </div>
              );
            }
          }}
        >
          {!showFull && isLong ? q.content.substring(0, 1000) + '...' : q.content}
        </ReactMarkdown>
        {!showFull && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900 to-transparent flex items-end justify-center pb-4">
            <button 
              onClick={() => setShowFull(true)}
              className="px-6 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-400 transition-all"
            >
              Lihat Selengkapnya
            </button>
          </div>
        )}
      </div>
      {showFull && isLong && (
        <div className="mt-4 flex justify-center">
          <button 
            onClick={() => setShowFull(false)}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-400 transition-all"
          >
            Tampilkan Lebih Sedikit
          </button>
        </div>
      )}
    </div>
  );
});

export default function AISoalModule({ token, addToast, questions, setQuestions }: { token: string; addToast: any; questions: any[]; setQuestions: any }) {
  const [generating, setGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [params, setParams] = useState({
    subject: 'Matematika',
    level: 'X',
    topic: '',
    withImages: false,
    config: [
      { type: 'Pilihan Ganda Biasa', count: 5, difficulty: 'MOTS' },
      { type: 'Essay', count: 2, difficulty: 'HOTS' }
    ]
  });

  const [displayLimit, setDisplayLimit] = useState(5);

  const handleGenerateFromFile = async (e: any) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast('Harap pilih file terlebih dahulu', 'error');
      return;
    }

    setGenerating(true);
    const docType = `Soal ${params.subject} Kelas ${params.level}${params.topic ? ` - ${params.topic}` : ''}`;
    
    try {
      const content = await generateFromFile(uploadFile, {
        type: docType,
        subject: params.subject,
        className: params.level,
        level: params.level,
        config: params.config
      });

      const res = await fetch('/api/ai-documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: docType,
          content: content,
          pdf_url: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(prev => [data, ...prev]);
        addToast('Soal AI berhasil dibuat dari file');
        setIsUploadModalOpen(false);
        setUploadFile(null);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan soal');
      }
    } catch (e: any) {
      addToast(e.message || 'Gagal membuat soal AI dari file', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (q: any, format: 'pdf' | 'doc') => {
    const contentElement = document.createElement('div');
    contentElement.style.padding = '50px';
    contentElement.style.width = '800px';
    contentElement.style.background = 'white';
    contentElement.style.color = 'black';
    contentElement.style.fontFamily = '"Times New Roman", Times, serif';
    contentElement.style.lineHeight = '1.5';
    
    const htmlContent = renderMarkdownToHtml(q.content);
    
    contentElement.innerHTML = `
      <div style="margin-bottom: 30px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <h1 style="margin: 0; font-size: 20pt; text-transform: uppercase;">SOAL UJIAN AI</h1>
        <p style="margin: 5px 0; font-size: 12pt;">Dihasilkan oleh: AI Guru Juara</p>
      </div>
      <div style="margin-bottom: 20px;">
        <table style="width: 100%; font-size: 11pt; border-collapse: collapse;">
          <tr>
            <td style="width: 120px; font-weight: bold; padding: 3px 0;">Mata Pelajaran</td>
            <td style="width: 20px;">:</td>
            <td>${params.subject}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 3px 0;">Kelas / Level</td>
            <td>:</td>
            <td>${params.level}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 3px 0;">Topik</td>
            <td>:</td>
            <td>${params.topic || q.type}</td>
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
        
        // Handle multiple pages
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

        pdf.save(`${q.type.replace(/\//g, '-')}.pdf`);
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
      fileLink.download = `${q.type.replace(/\//g, '-')}.doc`;
      fileLink.click();
      document.body.removeChild(fileLink);
      addToast('DOC berhasil didownload');
    }
    
    document.body.removeChild(contentElement);
  };

  const handleGenerate = async (e: any) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const content = await generateExamQuestions(params);
      
      const res = await fetch('/api/ai-documents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: `Soal ${params.subject} Kelas ${params.level}${params.topic ? ` - ${params.topic}` : ''}`,
          content: content,
          pdf_url: null
        })
      });

      if (res.ok) {
        addToast('Soal AI berhasil dibuat');
        setIsModalOpen(false);
        const data = await res.json();
        setQuestions(prev => [data, ...prev]);
      }
    } catch (e) {
      addToast('Gagal membuat soal AI', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Question Generator</h1>
          <p className="text-slate-400 mt-1">Buat soal ujian otomatis dengan berbagai tingkat kesulitan.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
          >
            <HelpCircle className="w-4 h-4" /> Buat Soal Baru
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-white border border-white/10 shadow-lg transition-all"
          >
            <FileUp className="w-4 h-4" /> Generate dari File
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {questions.slice(0, displayLimit).map((q, idx) => (
          <QuestionCard 
            key={q.id || `q-${idx}`} 
            q={q} 
            onDownload={handleDownload} 
          />
        ))}
        {questions.length === 0 && (
          <div className="py-32 glass rounded-3xl flex flex-col items-center justify-center text-slate-500 gap-4 border-dashed border-2 border-white/5">
            <Sparkles className="w-12 h-12 opacity-10" />
            <p className="italic">Belum ada soal yang dibuat.</p>
          </div>
        )}
      </div>

      {questions.length > displayLimit && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setDisplayLimit(prev => prev + 5)}
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
              className="w-full max-w-lg glass rounded-[2.5rem] p-10 shadow-2xl relative z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-8 flex-shrink-0">
                <h3 className="text-2xl font-bold">Generator Soal AI</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerate} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Mata Pelajaran</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.subject}
                      onChange={(e: any) => setParams({...params, subject: e.target.value})}
                    >
                      <option value="Matematika" className="bg-slate-900">Matematika</option>
                      <option value="Bahasa Indonesia" className="bg-slate-900">Bahasa Indonesia</option>
                      <option value="Bahasa Inggris" className="bg-slate-900">Bahasa Inggris</option>
                      <option value="Fisika" className="bg-slate-900">Fisika</option>
                      <option value="Biologi" className="bg-slate-900">Biologi</option>
                      <option value="Kimia" className="bg-slate-900">Kimia</option>
                      <option value="Ekonomi" className="bg-slate-900">Ekonomi</option>
                      <option value="Geografi" className="bg-slate-900">Geografi</option>
                      <option value="Sosiologi" className="bg-slate-900">Sosiologi</option>
                      <option value="Sejarah" className="bg-slate-900">Sejarah</option>
                      <option value="Pendidikan Agama Islam" className="bg-slate-900">Pendidikan Agama Islam</option>
                      <option value="Pendidikan Agama Katolik" className="bg-slate-900">Pendidikan Agama Katolik</option>
                      <option value="Pendidikan Agama Protestan" className="bg-slate-900">Pendidikan Agama Protestan</option>
                      <option value="Pendidikan Agama Hindu" className="bg-slate-900">Pendidikan Agama Hindu</option>
                      <option value="Pendidikan Agama Budha" className="bg-slate-900">Pendidikan Agama Budha</option>
                      <option value="Bahasa Jepang" className="bg-slate-900">Bahasa Jepang</option>
                      <option value="PKWU" className="bg-slate-900">PKWU</option>
                      <option value="Pendidikan Pancasila" className="bg-slate-900">Pendidikan Pancasila</option>
                      <option value="Seni Budaya" className="bg-slate-900">Seni Budaya</option>
                      <option value="PJOK" className="bg-slate-900">PJOK</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tingkat Kelas</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.level}
                      onChange={(e: any) => setParams({...params, level: e.target.value})}
                    >
                      <option value="X" className="bg-slate-900">Kelas X</option>
                      <option value="XI" className="bg-slate-900">Kelas XI</option>
                      <option value="XII" className="bg-slate-900">Kelas XII</option>
                    </select>
                  </div>
                </div>

                <Input 
                  label="Topik Pelajaran" 
                  placeholder="Contoh: Trigonometri, Fotosintesis, dll" 
                  value={params.topic} 
                  onChange={(e: any) => setParams({...params, topic: e.target.value})} 
                  required 
                />

                <div className="flex items-center gap-3 p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <input 
                    type="checkbox" 
                    id="withImages"
                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                    checked={params.withImages}
                    onChange={(e) => setParams({...params, withImages: e.target.checked})}
                  />
                  <label htmlFor="withImages" className="text-sm font-medium text-slate-200 cursor-pointer">
                    Sertakan Gambar (Visual Question Mode)
                  </label>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Konfigurasi Soal</p>
                  {params.config.map((c, idx) => (
                    <div key={idx} className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 relative">
                      <div className="flex items-center gap-3">
                        <select 
                          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none"
                          value={c.type}
                          onChange={(e) => {
                            const newConfig = [...params.config];
                            newConfig[idx].type = e.target.value;
                            setParams({...params, config: newConfig});
                          }}
                        >
                          <option value="Pilihan Ganda Biasa" className="bg-slate-900">Pilihan Ganda Biasa</option>
                          <option value="Pilihan Ganda Komplek" className="bg-slate-900">Pilihan Ganda Komplek</option>
                          <option value="Pilihan Ganda Berbasis Kasus" className="bg-slate-900">Pilihan Ganda Berbasis Kasus</option>
                          <option value="Essay" className="bg-slate-900">Essay</option>
                          <option value="Isian Singkat" className="bg-slate-900">Isian Singkat</option>
                          <option value="Menjodohkan" className="bg-slate-900">Menjodohkan</option>
                        </select>
                        <input 
                          type="number"
                          className="w-20 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none"
                          value={c.count}
                          onChange={(e) => {
                            const newConfig = [...params.config];
                            newConfig[idx].count = Number(e.target.value);
                            setParams({...params, config: newConfig});
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const newConfig = params.config.filter((_, i) => i !== idx);
                            setParams({...params, config: newConfig});
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest min-w-[80px]">Kesulitan:</label>
                        <select 
                          className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none"
                          value={c.difficulty || 'MOTS'}
                          onChange={(e) => {
                            const newConfig = [...params.config];
                            newConfig[idx].difficulty = e.target.value;
                            setParams({...params, config: newConfig});
                          }}
                        >
                          <option value="LOTS" className="bg-slate-900">LOTS (Mudah)</option>
                          <option value="MOTS" className="bg-slate-900">MOTS (Sedang)</option>
                          <option value="HOTS" className="bg-slate-900">HOTS (Sulit)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setParams({...params, config: [...params.config, { type: 'Pilihan Ganda Biasa', count: 5, difficulty: 'MOTS' }]})}
                    className="w-full py-2 border border-dashed border-white/10 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Tambah Jenis Soal
                  </button>
                </div>

                <button 
                  disabled={generating}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                  {generating ? 'Sedang Merumuskan Soal...' : 'Generate Soal AI'}
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
              className="w-full max-w-2xl glass rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Generate Soal dari File</h3>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Mata Pelajaran</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.subject}
                      onChange={(e: any) => setParams({...params, subject: e.target.value})}
                    >
                      <option value="Matematika" className="bg-slate-900">Matematika</option>
                      <option value="Bahasa Indonesia" className="bg-slate-900">Bahasa Indonesia</option>
                      <option value="Bahasa Inggris" className="bg-slate-900">Bahasa Inggris</option>
                      <option value="Fisika" className="bg-slate-900">Fisika</option>
                      <option value="Biologi" className="bg-slate-900">Biologi</option>
                      <option value="Kimia" className="bg-slate-900">Kimia</option>
                      <option value="Ekonomi" className="bg-slate-900">Ekonomi</option>
                      <option value="Geografi" className="bg-slate-900">Geografi</option>
                      <option value="Sosiologi" className="bg-slate-900">Sosiologi</option>
                      <option value="Sejarah" className="bg-slate-900">Sejarah</option>
                      <option value="Pendidikan Agama Islam" className="bg-slate-900">Pendidikan Agama Islam</option>
                      <option value="Pendidikan Agama Katolik" className="bg-slate-900">Pendidikan Agama Katolik</option>
                      <option value="Pendidikan Agama Protestan" className="bg-slate-900">Pendidikan Agama Protestan</option>
                      <option value="Pendidikan Agama Hindu" className="bg-slate-900">Pendidikan Agama Hindu</option>
                      <option value="Pendidikan Agama Budha" className="bg-slate-900">Pendidikan Agama Budha</option>
                      <option value="Bahasa Jepang" className="bg-slate-900">Bahasa Jepang</option>
                      <option value="PKWU" className="bg-slate-900">PKWU</option>
                      <option value="Pendidikan Pancasila" className="bg-slate-900">Pendidikan Pancasila</option>
                      <option value="Seni Budaya" className="bg-slate-900">Seni Budaya</option>
                      <option value="PJOK" className="bg-slate-900">PJOK</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tingkat Kelas</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={params.level}
                      onChange={(e: any) => setParams({...params, level: e.target.value})}
                    >
                      <option value="X" className="bg-slate-900">Kelas X</option>
                      <option value="XI" className="bg-slate-900">Kelas XI</option>
                      <option value="XII" className="bg-slate-900">Kelas XII</option>
                    </select>
                  </div>
                </div>

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
