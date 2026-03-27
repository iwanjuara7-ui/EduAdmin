import React, { useState } from 'react';
import { User, Shield, Bell, Database, Globe, LogOut, Camera, Trash2, Save, Loader2 } from 'lucide-react';
import { Input } from './Common';

export default function SettingsModule({ user, setUser, setToken, token, addToast, onLogout }: { user: any, setUser: any, setToken: any, token: string, addToast: any, onLogout: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    subject: user?.subject || '',
    photo_url: user?.photo_url || ''
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        addToast('Profil berhasil diperbarui');
      } else {
        const errorData = await res.json();
        addToast(errorData.error || 'Gagal memperbarui profil', 'error');
      }
    } catch (e) {
      addToast('Terjadi kesalahan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/auth/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setFormData(prev => ({ ...prev, photo_url: data.user.photo_url }));
        addToast('Foto profil berhasil diunggah');
      } else {
        const errorData = await res.json();
        addToast(errorData.error || 'Gagal mengunggah foto', 'error');
      }
    } catch (e) {
      addToast('Terjadi kesalahan saat mengunggah', 'error');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo_url: '' });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-slate-400 mt-1">Kelola akun dan preferensi aplikasi Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="glass rounded-3xl p-6 border border-white/5">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-xl mb-4 p-1 relative group">
                <div className="w-full h-full rounded-full bg-[#0f172a] flex items-center justify-center overflow-hidden">
                  {formData.photo_url ? (
                    <img src={formData.photo_url || null} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-10 h-10 text-slate-300" />
                  )}
                </div>
                <button 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                <input 
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <h3 className="text-xl font-bold">{user?.name}</h3>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <div className="mt-4 px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-widest border border-purple-500/20">
                {user?.subject} Teacher
              </div>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold text-sm hover:bg-rose-500/20 transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            Keluar dari Akun
          </button>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 bg-white/5">
              <h4 className="font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" /> Profil Pengguna
              </h4>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Nama Lengkap" 
                    value={formData.name} 
                    onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} 
                    required 
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Mata Pelajaran</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={formData.subject}
                      onChange={(e: any) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    >
                      {['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia', 'Bahasa Inggris', 'Sejarah', 'Informatika', 'Geografi', 'Ekonomi', 'Sosiologi', 'Pendidikan Agama Islam', 'Pendidikan Agama Katolik', 'Pendidikan Agama Protestan', 'Pendidikan Agama Hindu', 'Pendidikan Agama Budha', 'Bahasa Jepang', 'PKWU', 'Seni Budaya', 'PJOK', 'Antropologi', 'Bahasa Mandarin', 'Bahasa Jerman', 'Bahasa Perancis', 'Bahasa Arab'].map(s => (
                        <option key={s} value={s} className="bg-slate-900">{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Atau Gunakan URL Foto</label>
                  <div className="flex gap-2">
                    <input 
                      id="photo-input"
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-purple-500/50 transition-colors text-sm"
                      value={formData.photo_url}
                      onChange={(e: any) => setFormData({ ...formData, photo_url: e.target.value })}
                    />
                    {formData.photo_url && (
                      <button 
                        type="button"
                        onClick={removePhoto}
                        className="p-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl hover:bg-rose-500/20 transition-all"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 ml-1">Gunakan URL gambar publik (misal: dari Unsplash atau Imgur).</p>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl font-bold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Simpan Perubahan
                </button>
              </form>
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 bg-white/5">
              <h4 className="font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" /> Keamanan & Privasi
              </h4>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Ubah Kata Sandi</p>
                  <p className="text-xs text-slate-500">Perbarui kata sandi akun Anda secara berkala.</p>
                </div>
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold transition-all">Ubah</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
