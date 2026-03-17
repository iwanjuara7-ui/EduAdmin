import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, HelpCircle, Wand2, Loader2, Download, 
  FileText, X, Plus, Trash2, File as FileIcon
} from 'lucide-react';
import { cn } from '../utils';
import { Input } from './Common';
import { generateExamQuestions } from '../services/aiService';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export default function AISoalModule({ addToast }: { addToast: any }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [params, setParams] = useState({
    subject: 'Matematika',
    level: 'X',
    topic: '',
    difficulty: 'MOTS',
    config: [
      { type: 'Pilihan Ganda Biasa', count: 5 },
      { type: 'Essay', count: 2 }
    ]
  });
  const [token] = useState(localStorage.getItem('token'));

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/ai-documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setQuestions(data.filter((d: any) => d.type.startsWith('Soal')));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleDownload = async (q: any, format: 'pdf' | 'doc') => {
    const contentElement = document.createElement('div');
    contentElement.style.padding = '40px';
    contentElement.style.width = '800px';
    contentElement.style.background = 'white';
    contentElement.style.color = 'black';
    contentElement.className = 'prose prose-sm';
    contentElement.innerHTML = `
      <div style="font-family: sans-serif;">
        <h1 style="text-align: center; margin-bottom: 20px;">${q.type}</h1>
        <hr style="margin-bottom: 30px;" />
        <div id="markdown-content"></div>
      </div>
    `;
    
    document.body.appendChild(contentElement);
    
    const markdownDiv = contentElement.querySelector('#markdown-content');
    if (markdownDiv) {
      const safeContent = q.content || '';
      markdownDiv.innerHTML = safeContent
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/!\[(.*?)\]\((.*?)\)/gim, "<img alt='$1' src='$2' />")
        .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>")
        .replace(/\n$/gim, '<br />')
        .split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');
    }

    if (format === 'pdf') {
      try {
        const canvas = await html2canvas(contentElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${q.type}.pdf`);
        addToast('PDF berhasil didownload');
      } catch (err) {
        addToast('Gagal membuat PDF', 'error');
      }
    } else {
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
            "xmlns:w='urn:schemas-microsoft-com:office:word' "+
            "xmlns='http://www.w3.org/TR/REC-html40'>"+
            "<head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + contentElement.innerHTML + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileLink = document.createElement("a");
      document.body.appendChild(fileLink);
      fileLink.href = source;
      fileLink.download = `${q.type}.doc`;
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
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
        >
          <HelpCircle className="w-4 h-4" /> Buat Soal Baru
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {questions.map((q, idx) => (
          <div key={q.id || `q-${idx}`} className="glass rounded-3xl p-8 border border-white/5">
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
                  onClick={() => handleDownload(q, 'pdf')}
                  title="Download PDF"
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDownload(q, 'doc')}
                  title="Download DOC"
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <FileIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="prose prose-invert prose-sm max-w-none bg-white/5 p-6 rounded-2xl border border-white/10">
              <ReactMarkdown>{q.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <div className="py-32 glass rounded-3xl flex flex-col items-center justify-center text-slate-500 gap-4 border-dashed border-2 border-white/5">
            <Sparkles className="w-12 h-12 opacity-10" />
            <p className="italic">Belum ada soal yang dibuat.</p>
          </div>
        )}
      </div>

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
              className="w-full max-w-lg glass rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Generator Soal AI</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleGenerate} className="space-y-6">
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

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tingkat Kesulitan</label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                    value={params.difficulty}
                    onChange={(e: any) => setParams({...params, difficulty: e.target.value})}
                  >
                    <option value="LOTS" className="bg-slate-900">LOTS (Lower Order Thinking Skills)</option>
                    <option value="MOTS" className="bg-slate-900">MOTS (Middle Order Thinking Skills)</option>
                    <option value="HOTS" className="bg-slate-900">HOTS (Higher Order Thinking Skills)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Konfigurasi Soal</p>
                  {params.config.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <select 
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none"
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
                        className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none"
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
                  ))}
                  <button 
                    type="button"
                    onClick={() => setParams({...params, config: [...params.config, { type: 'Pilihan Ganda Biasa', count: 5 }]})}
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
      </AnimatePresence>
    </div>
  );
}
