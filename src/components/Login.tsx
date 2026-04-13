import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import { Input } from './Common';

export default function Login({ onLogin, onBack }: any) {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', subject: 'Matematika' });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            subject: formData.subject
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registrasi gagal');
        
        setError('Registrasi berhasil! Silakan masuk.');
        setIsRegister(false);
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login gagal');
        
        if (data.token && data.user) {
          onLogin(data.token, data.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memproses permintaan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f172a]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden z-10"
      >
        <button 
          onClick={onBack}
          className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-slate-300"
          title="Kembali ke Beranda"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500"></div>
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-500/20">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold neon-text tracking-tight">EduAdmin SMA</h1>
          <p className="text-slate-400 mt-2 font-medium">{isRegister ? 'Buat akun guru Anda' : 'Selamat datang kembali, Guru'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {isRegister && (
            <>
              <Input label="Nama Lengkap" placeholder="Dr. Jane Doe" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} required />
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Mata Pelajaran</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                  value={formData.subject}
                  onChange={(e: any) => setFormData({...formData, subject: e.target.value})}
                >
                  {['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia', 'Bahasa Inggris', 'Sejarah', 'Informatika', 'Geografi', 'Ekonomi', 'Sosiologi', 'Pendidikan Agama Islam', 'Pendidikan Agama Katolik', 'Pendidikan Agama Protestan', 'Pendidikan Agama Hindu', 'Pendidikan Agama Budha', 'Bahasa Jepang', 'PKWU', 'Seni Budaya', 'PJOK', 'Antropologi', 'Bahasa Mandarin', 'Bahasa Jerman', 'Bahasa Perancis', 'Bahasa Arab'].map(s => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <Input label="Email" type="email" placeholder="nama@sekolah.sch.id" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} required />
          <Input label="Password" type="password" placeholder="••••••••" value={formData.password} onChange={(e: any) => setFormData({...formData, password: e.target.value})} required />
          
          <button 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
          >
            {loading ? 'Memproses...' : (isRegister ? 'Daftar Sekarang' : 'Masuk Dashboard')}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-slate-500">
          {isRegister ? 'Sudah punya akun?' : "Belum punya akun?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)} className="text-purple-400 font-bold hover:underline transition-colors">
            {isRegister ? 'Masuk' : 'Daftar'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
