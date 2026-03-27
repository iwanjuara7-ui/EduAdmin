import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, BookOpen, FileText, ClipboardList, 
  Sparkles, HelpCircle, Settings, LogOut, Menu, User, Bell,
  CheckCircle2, AlertCircle, ArrowUp
} from 'lucide-react';
import { cn } from './utils';
import { useRef } from 'react';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SiswaModule from './components/SiswaModule';
import AttendanceModule from './components/AttendanceModule';
import DocumentModule from './components/DocumentModule';
import ERaportModule from './components/ERaportModule';
import AIDocModule from './components/AIDocModule';
import AISoalModule from './components/AISoalModule';
import SettingsModule from './components/SettingsModule';

// Types
type View = 'dashboard' | 'siswa' | 'absensi' | 'agenda' | 'laporan' | 'eraport' | 'ai-doc' | 'ai-soal' | 'settings';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ students: 0, agenda: 0, reports: 0, eraport: 0 });
  const [toasts, setToasts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [aiDocs, setAiDocs] = useState<any[]>([]);
  const [aiQuestions, setAiQuestions] = useState<any[]>([]);
  const [isLoadingAIData, setIsLoadingAIData] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initial Data Fetch
  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
      
      // Fetch initial data once
      fetchStats();
      fetchStudents();
      fetchAIData();
    }
  }, [token]);

  const fetchAIData = React.useCallback(async () => {
    if (!token) return;
    setIsLoadingAIData(true);
    try {
      const res = await fetch('/api/ai-documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAiDocs(data.filter((d: any) => !d.type.includes('Soal')));
        setAiQuestions(data.filter((d: any) => d.type.includes('Soal')));
      }
    } catch (e) {
      console.error('Fetch AI data error:', e);
    } finally {
      setIsLoadingAIData(false);
    }
  }, [token]);

  const addToast = React.useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const fetchStudents = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Fetch students error:', e);
    }
  }, [token]);

  const fetchStats = React.useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Fetch stats error:', e);
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowScrollTop(scrollTop > 400);
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!token) {
    return <Login onLogin={(t, u) => { 
      setToken(t); 
      setUser(u); 
      localStorage.setItem('token', t); 
      localStorage.setItem('user', JSON.stringify(u));
      addToast('Selamat datang kembali, ' + u.name);
    }} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="glass border-r border-white/10 flex flex-col z-50"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <span className="font-bold text-xl tracking-tight neon-text whitespace-nowrap">EduAdmin</span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} collapsed={!isSidebarOpen} />
          <NavItem icon={Users} label="Data Siswa" active={currentView === 'siswa'} onClick={() => setCurrentView('siswa')} collapsed={!isSidebarOpen} />
          <NavItem icon={CheckCircle2} label="Absensi Siswa" active={currentView === 'absensi'} onClick={() => setCurrentView('absensi')} collapsed={!isSidebarOpen} />
          <NavItem icon={BookOpen} label="Agenda Guru" active={currentView === 'agenda'} onClick={() => setCurrentView('agenda')} collapsed={!isSidebarOpen} />
          <NavItem icon={ClipboardList} label="Laporan" active={currentView === 'laporan'} onClick={() => setCurrentView('laporan')} collapsed={!isSidebarOpen} />
          <NavItem icon={FileText} label="E-Raport" active={currentView === 'eraport'} onClick={() => setCurrentView('eraport')} collapsed={!isSidebarOpen} />
          
          {isSidebarOpen && (
            <div className="pt-6 pb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Productivity</div>
          )}
          {!isSidebarOpen && <div className="h-px bg-white/10 my-4 mx-4" />}
          
          <NavItem icon={Sparkles} label="AI Doc Gen" active={currentView === 'ai-doc'} onClick={() => setCurrentView('ai-doc')} collapsed={!isSidebarOpen} />
          <NavItem icon={HelpCircle} label="AI Soal Gen" active={currentView === 'ai-soal'} onClick={() => setCurrentView('ai-soal')} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-white/10">
          <NavItem icon={Settings} label="Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} collapsed={!isSidebarOpen} />
          <NavItem icon={LogOut} label="Logout" onClick={handleLogout} collapsed={!isSidebarOpen} />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 glass border-b border-white/10 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-medium capitalize tracking-wide">{currentView.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Bell className="w-5 h-5 text-slate-400 cursor-pointer group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border-2 border-[#0f172a]"></span>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user?.name || 'Teacher'}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{user?.subject || 'Mapel'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center shadow-inner overflow-hidden">
                {user?.photo_url ? (
                  <img src={user.photo_url || null} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-5 h-5 text-slate-300" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-transparent"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {currentView === 'dashboard' && <Dashboard stats={stats} user={user} setView={setCurrentView} />}
              {currentView === 'siswa' && <SiswaModule token={token!} addToast={addToast} refreshStats={fetchStats} students={students} setStudents={setStudents} fetchStudents={fetchStudents} />}
              {currentView === 'absensi' && <AttendanceModule token={token!} addToast={addToast} students={students} />}
              {currentView === 'agenda' && <DocumentModule type="agenda" token={token!} addToast={addToast} />}
              {currentView === 'laporan' && <DocumentModule type="report" token={token!} addToast={addToast} />}
              {currentView === 'eraport' && <ERaportModule token={token!} addToast={addToast} students={students} fetchStudents={fetchStudents} />}
              {currentView === 'ai-doc' && (
                isLoadingAIData ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 animate-pulse">Memuat Dokumen AI...</p>
                  </div>
                ) : (
                  <AIDocModule token={token!} addToast={addToast} docs={aiDocs} setDocs={setAiDocs} />
                )
              )}
              {currentView === 'ai-soal' && (
                isLoadingAIData ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 animate-pulse">Memuat Soal AI...</p>
                  </div>
                ) : (
                  <AISoalModule token={token!} addToast={addToast} questions={aiQuestions} setQuestions={setAiQuestions} />
                )
              )}
              {currentView === 'settings' && <SettingsModule user={user} setUser={(u: any) => {
                setUser(u);
                localStorage.setItem('user', JSON.stringify(u));
              }} setToken={setToken} token={token!} addToast={addToast} onLogout={handleLogout} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Toast Notifications */}
        <div className="fixed bottom-8 right-8 z-[100] space-y-3">
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                onClick={scrollToTop}
                className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 hover:bg-purple-600 transition-all mb-4"
              >
                <ArrowUp className="w-6 h-6" />
              </motion.button>
            )}
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className={cn(
                  "px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] backdrop-blur-xl border",
                  toast.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/30 text-rose-400"
                )}
              >
                {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="font-medium">{toast.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, collapsed }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
        active 
          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]" 
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0", active ? "text-purple-400" : "group-hover:scale-110 transition-transform")} />
      {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
      {active && (
        <motion.div 
          layoutId="active-pill"
          className="absolute left-0 w-1 h-6 bg-purple-500 rounded-r-full"
        />
      )}
    </button>
  );
}
