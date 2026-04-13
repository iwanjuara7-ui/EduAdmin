import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Heart, BookOpen, Users, Star } from 'lucide-react';

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-500/5 blur-[100px] rounded-full"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 h-24 px-8 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight neon-text">EduAdmin SMA</span>
        </div>
        <button 
          onClick={onStart}
          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-sm font-bold transition-all hover:scale-105 active:scale-95"
        >
          Masuk
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-8">
              <Heart className="w-3 h-3" /> Dedikasi Untuk Guru Indonesia
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-8">
              Dukung Setiap Guru, Tingkatkan <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Kualitas Pendidikan</span>.
            </h1>
            
            <p className="text-xl text-slate-400 leading-relaxed mb-10 max-w-xl">
              Dedikasi Anda adalah inspirasi bagi para siswa. EduAdmin hadir untuk meringankan beban administrasi Anda, agar Anda bisa fokus pada hal yang paling berarti: <span className="text-white font-medium">Mendidik Generasi Penerus Bangsa.</span>
            </p>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={onStart}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-xl shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group"
              >
                Mulai Sekarang <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0f172a] bg-slate-800 flex items-center justify-center overflow-hidden">
                      <img src={`https://picsum.photos/seed/teacher${i}/100/100`} alt="Teacher" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                <div className="text-xs">
                  <p className="font-bold text-white">Dipercaya oleh 500+ Guru</p>
                  <p className="text-slate-500">SMA Unggulan di Indonesia</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 glass rounded-[3rem] p-8 border border-white/10 shadow-2xl">
              <div className="grid grid-cols-2 gap-6">
                <FeatureCard icon={BookOpen} title="Agenda Otomatis" desc="Kelola jadwal mengajar dengan mudah." color="purple" />
                <FeatureCard icon={Users} title="Data Siswa" desc="Pantau perkembangan setiap individu." color="cyan" />
                <FeatureCard icon={Sparkles} title="AI Generator" desc="Buat soal & dokumen dalam hitungan detik." color="indigo" />
                <FeatureCard icon={Star} title="E-Raport" desc="Penilaian transparan dan akuntabel." color="rose" />
              </div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 blur-[60px] rounded-full animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/20 blur-[60px] rounded-full animate-pulse delay-700"></div>
          </motion.div>
        </div>
      </main>

      {/* Footer Quote */}
      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <p className="text-slate-500 italic text-lg">
            "Guru adalah pahlawan tanpa tanda jasa, arsitek peradaban yang membangun fondasi masa depan."
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color }: any) {
  const colors: any = {
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20"
  };

  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
      <div className={`w-12 h-12 rounded-2xl ${colors[color]} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}
