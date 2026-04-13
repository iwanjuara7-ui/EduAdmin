import express from 'express';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (SUPABASE_URL) {
  console.log('Supabase URL detected:', SUPABASE_URL);
} else {
  console.warn('SUPABASE_URL is missing. Using local mock database.');
}

// Initialize Supabase only if credentials are provided to avoid crashing on startup
let supabase: any;

const STORAGE_BUCKET = 'EduAdmin';

// Helper to get Supabase client with user context if available
function getSupabaseClient(token?: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return supabase;
  
  if (token) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
  }
  return supabase;
}

async function uploadToSupabase(file: any, folder: string = 'uploads', userId: string, userToken?: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase.storage) {
    return `/uploads/${file.filename}`;
  }

  try {
    const fileExt = path.extname(file.originalname);
    const fileName = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
    const fileBuffer = fs.readFileSync(file.path);

    const client = getSupabaseClient(userToken);
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return `/uploads/${file.filename}`; // Fallback to local
    }

    const { data: { publicUrl } } = client.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error('Upload to Supabase failed:', err);
    return `/uploads/${file.filename}`;
  }
}

let inMemoryStore: any = {};
const DB_FILE = 'mock-db.json';

const saveToDB = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryStore, null, 2));
  } catch (err) {
    console.error('Failed to save mock DB:', err);
  }
};

const loadFromDB = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      inMemoryStore = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load mock DB:', err);
  }
};

loadFromDB();

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn('Supabase credentials missing. Using persistent local fallback.');
    
    const createHandler = (tableName: string) => {
      const handler: any = {
        _data: [...(inMemoryStore[tableName] || [])],
        _head: false,
        _error: null,
        then: function(onfulfilled: any) {
          const result = { 
            data: this._head ? null : this._data, 
            error: this._error,
            count: this._data.length 
          };
          return Promise.resolve(result).then(onfulfilled);
        },
        select: function(columns: string = '*', options?: any) {
          if (options?.head) this._head = true;
          
          // Basic join mock for eraport and absensi_siswa
          if (columns.includes('siswa')) {
            this._data = this._data.map((item: any) => {
              const student = inMemoryStore['siswa']?.find((s: any) => String(s.nis) === String(item.nis));
              return { ...item, siswa: student || { nama: 'Unknown' } };
            });
          }
          
          return this;
        },
        eq: function(column: string, value: any) {
          const before = this._data.length;
          this._data = this._data.filter((item: any) => item && String(item[column]) === String(value));
          console.log(`Mock DB eq: ${tableName}.${column} == ${value} | Size: ${before} -> ${this._data.length}`);
          return this;
        },
        gte: function(column: string, value: any) {
          this._data = this._data.filter((item: any) => item[column] >= value);
          return this;
        },
        lte: function(column: string, value: any) {
          this._data = this._data.filter((item: any) => item[column] <= value);
          return this;
        },
        single: function() {
          const originalThen = this.then.bind(this);
          this.then = (onfulfilled: any) => {
            return originalThen((res: any) => {
              onfulfilled({ data: (res.data && res.data[0]) || null, error: res.error });
            });
          };
          return this;
        },
        order: function() { return this; },
        limit: function() { return this; },
        insert: function(values: any | any[]) {
          const items = Array.isArray(values) ? values : [values];
          const newItems = items.map(item => ({ ...item, id: item.id || `mock-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}` }));
          if (!inMemoryStore[tableName]) inMemoryStore[tableName] = [];
          inMemoryStore[tableName].push(...newItems);
          saveToDB();
          this._data = Array.isArray(values) ? newItems : [newItems[0]];
          return this;
        },
        upsert: function(values: any | any[], options?: any) {
          const items = Array.isArray(values) ? values : [values];
          const onConflict = options?.onConflict || 'id';
          const conflictKeys = onConflict.split(',');

          if (!inMemoryStore[tableName]) inMemoryStore[tableName] = [];
          
          items.forEach(newItem => {
            const index = inMemoryStore[tableName].findIndex(existing => 
              conflictKeys.every(key => String(existing[key.trim()]) === String(newItem[key.trim()]))
            );
            if (index !== -1) {
              inMemoryStore[tableName][index] = { ...inMemoryStore[tableName][index], ...newItem };
            } else {
              inMemoryStore[tableName].push({ ...newItem, id: newItem.id || `mock-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}` });
            }
          });
          saveToDB();
          this._data = items;
          return this;
        },
        update: function(values: any) {
          const tableName_ = tableName;
          this._updateValues = values;
          
          // Lazy update: apply when then() or select() is called
          const originalThen = this.then.bind(this);
          this.then = (onfulfilled: any) => {
            const currentData = this._data;
            if (inMemoryStore[tableName_]) {
              inMemoryStore[tableName_] = inMemoryStore[tableName_].map(item => {
                if (!item) return item;
                const shouldUpdate = currentData.some((d: any) => d && String(d.id) === String(item.id));
                return shouldUpdate ? { ...item, ...values } : item;
              });
              saveToDB();
              this._data = this._data.map(item => item ? ({ ...item, ...values }) : item);
            }
            return originalThen(onfulfilled);
          };
          return this;
        },
        delete: function() {
          const tableName_ = tableName;
          const currentData = this._data;
          if (inMemoryStore[tableName_]) {
            inMemoryStore[tableName_] = inMemoryStore[tableName_].filter(item => {
              return !currentData.some((d: any) => d && d.id === item.id);
            });
            saveToDB();
          }
          this._data = [];
          return this;
        }
      };
      return handler;
    };

    supabase = {
      from: (tableName: string) => createHandler(tableName),
      storage: null,
      auth: {
        signUp: async ({ email, password }: any) => {
          const existing = inMemoryStore['users']?.find(u => u.email === email);
          if (existing) return { data: { user: null }, error: { message: 'User already exists' } };
          const id = Math.floor(Math.random() * 1000000);
          return { data: { user: { id, email } }, error: null };
        },
        signInWithPassword: async ({ email, password }: any) => {
          const user = inMemoryStore['users']?.find(u => u.email === email);
          if (user && bcrypt.compareSync(password, user.password)) {
            return { data: { user }, error: null };
          }
          return { data: { user: null }, error: { message: 'Invalid credentials' } };
        }
      }
    };
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

const JWT_SECRET = process.env.JWT_SECRET || 'edu-admin-secret-key-2026';

// Configure multer storage to preserve extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const UPLOADS_DIR = path.resolve('uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err || !user) return res.sendStatus(403);
      req.user = user;
      req.supabaseToken = user.supabase_token; // Store Supabase token if available
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, subject } = req.body;
    
    try {
      // 1. Register with Supabase Auth if available
      let authUserId = null;
      if (supabase.auth && typeof supabase.auth.signUp === 'function' && SUPABASE_URL) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            return res.status(400).json({ error: 'Email sudah terdaftar. Silakan login.' });
          }
          console.error('Supabase Auth SignUp Error:', authError);
          return res.status(400).json({ error: authError.message });
        }
        authUserId = authData.user?.id;
      }

      // 2. Insert into users table (profile)
      const userData = { 
        id: authUserId || `mock-${Math.random().toString(36).substring(2, 10)}`,
        email, 
        name, 
        subject 
      };

      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error || !data) {
        console.error('Database Insert Error:', error?.message || error);
        return res.status(400).json({ 
          error: 'Registrasi gagal di database.',
          details: error?.message || 'Gagal menyimpan profil.'
        });
      }
      res.json({ id: data.id });
    } catch (err: any) {
      console.error('Registration Exception:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
      let user = null;
      let supabaseToken = null;

      // 1. Try Supabase Auth first if available
      if (supabase.auth && typeof supabase.auth.signInWithPassword === 'function' && SUPABASE_URL) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError && authData.user) {
          supabaseToken = authData.session?.access_token;
          
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
          
          if (profile) {
            user = profile;
          } else {
            user = { 
              id: authData.user.id, 
              email: authData.user.email, 
              name: authData.user.user_metadata?.name || email.split('@')[0],
              subject: 'Guru'
            };
          }
        }
      }

      // 2. Fallback to manual check (for mock)
      if (!user && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
        const mockUser = inMemoryStore['users']?.find(u => u.email === email && bcrypt.compareSync(password, u.password));
        if (mockUser) user = mockUser;
      }

      if (user) {
        const token = jwt.sign({ 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          subject: user.subject, 
          photo_url: user.photo_url,
          supabase_token: supabaseToken
        }, JWT_SECRET);
        
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            subject: user.subject, 
            photo_url: user.photo_url 
          } 
        });
      } else {
        res.status(401).json({ error: 'Email atau password salah' });
      }
    } catch (err: any) {
      console.error('Login Exception:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
    const { name, subject, photo_url } = req.body;
    
    try {
      // Use update instead of upsert to avoid NOT NULL constraint errors on password
      const updateData = { 
        name, 
        subject, 
        photo_url
      };

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', req.user.id)
        .select()
        .single();

      if (error || !data) {
        console.error('Settings update error:', error?.message || error, error?.code, error?.details);
        console.log('Target user ID:', req.user.id);
        console.log('Update data:', updateData);
        
        return res.status(400).json({ 
          error: 'Gagal memperbarui profil.',
          details: error ? error.message : 'User not found'
        });
      }
      
      const token = jwt.sign({ id: data.id, email: data.email, name: data.name, subject: data.subject, photo_url: data.photo_url }, JWT_SECRET);
      res.json({ token, user: { id: data.id, email: data.email, name: data.name, subject: data.subject, photo_url: data.photo_url } });
    } catch (err: any) {
      console.error('Settings update exception:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/upload-photo', authenticateToken, (req: any, res: any) => {
    upload.single('photo')(req, res, async (err: any) => {
      try {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const photoUrl = await uploadToSupabase(req.file, 'profiles', req.user.id, req.supabaseToken);
        
        const { data, error } = await getSupabaseClient(req.supabaseToken)
          .from('users')
          .update({ photo_url: photoUrl })
          .eq('id', req.user.id)
          .select()
          .single();

        if (error) return res.status(400).json({ error: error.message });
        
        const token = jwt.sign({ 
          id: data.id, 
          email: data.email, 
          name: data.name, 
          subject: data.subject, 
          photo_url: data.photo_url,
          supabase_token: req.supabaseToken
        }, JWT_SECRET);
        
        res.json({ token, user: { id: data.id, email: data.email, name: data.name, subject: data.subject, photo_url: data.photo_url } });
      } catch (dbErr: any) {
        res.status(500).json({ error: dbErr.message });
      }
    });
  });

  // Student Routes
  app.get('/api/students', authenticateToken, async (req: any, res) => {
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('siswa')
      .select('*')
      .eq('created_by', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/students', authenticateToken, async (req: any, res) => {
    const { nis, name, className } = req.body;
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('siswa')
      .upsert({ nis, nama: name, kelas: className, created_by: req.user.id }, { onConflict: 'nis' });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  app.post('/api/students/bulk', authenticateToken, async (req: any, res) => {
    try {
      const { students } = req.body;
      if (!Array.isArray(students)) return res.status(400).json({ error: 'Invalid data format' });

      const studentsToInsert = students.map(s => ({
        nis: String(s.nis),
        nama: String(s.name),
        kelas: String(s.className || s.class),
        created_by: req.user.id
      }));

      const { error } = await getSupabaseClient(req.supabaseToken)
        .from('siswa')
        .upsert(studentsToInsert, { onConflict: 'nis' });

      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/students/:nis', authenticateToken, async (req: any, res) => {
    const { name, className } = req.body;
    const { nis } = req.params;
    
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('siswa')
      .update({ nama: name, kelas: className })
      .eq('nis', nis)
      .eq('created_by', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete('/api/students/:nis', authenticateToken, async (req: any, res) => {
    const { nis } = req.params;
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('siswa')
      .delete()
      .eq('nis', nis)
      .eq('created_by', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Agenda & Reports
  app.get('/api/agenda', authenticateToken, async (req: any, res) => {
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('agenda_guru')
      .select('*')
      .eq('uploaded_by', req.user.id)
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get('/api/reports', authenticateToken, async (req: any, res) => {
    const client = getSupabaseClient(req.supabaseToken);
    const [piket, walikelas] = await Promise.all([
      client.from('laporan_piket').select('*').eq('teacher_id', req.user.id),
      client.from('laporan_walikelas').select('*').eq('teacher_id', req.user.id)
    ]);
    
    // Use a unique ID for the frontend by prefixing with type
    const combined = [
      ...(piket.data || []).map(d => ({ ...d, type: 'Piket', original_id: d.id, id: `piket-${d.id}` })),
      ...(walikelas.data || []).map(d => ({ ...d, type: 'Wali Kelas', original_id: d.id, id: `wk-${d.id}` }))
    ].sort((a, b) => b.original_id - a.original_id);

    res.json(combined);
  });

  app.post('/api/upload', authenticateToken, (req: any, res: any) => {
    upload.single('file')(req, res, async (err: any) => {
      try {
        if (err) return res.status(400).json({ error: err.message });

        const { title, date, type } = req.body;
        const filePath = req.file ? await uploadToSupabase(req.file, 'documents', req.user.id, req.supabaseToken) : null;
        
        let error, data;
        const client = getSupabaseClient(req.supabaseToken);
        if (type === 'agenda') {
          const result = await client
            .from('agenda_guru')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, uploaded_by: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
        } else if (type === 'Piket') {
          const result = await client
            .from('laporan_piket')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, teacher_id: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
          if (data) data = { ...data, type: 'Piket', original_id: data.id, id: `piket-${data.id}` };
        } else {
          const result = await client
            .from('laporan_walikelas')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, teacher_id: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
          if (data) data = { ...data, type: 'Wali Kelas', original_id: data.id, id: `wk-${data.id}` };
        }

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  });

  app.post('/api/manual', authenticateToken, async (req: any, res) => {
    const { title, date, type, content } = req.body;
    
    let error, data;
    const client = getSupabaseClient(req.supabaseToken);
    if (type === 'agenda') {
      const result = await client
        .from('agenda_guru')
        .insert([{ judul: title, tanggal: date, content, uploaded_by: req.user.id }])
        .select()
        .single();
      error = result.error;
      data = result.data;
    } else if (type === 'Piket') {
      const result = await client
        .from('laporan_piket')
        .insert([{ judul: title, tanggal: date, content, teacher_id: req.user.id }])
        .select()
        .single();
      error = result.error;
      data = result.data;
      if (data) data = { ...data, type: 'Piket', original_id: data.id, id: `piket-${data.id}` };
    } else {
      const result = await client
        .from('laporan_walikelas')
        .insert([{ judul: title, tanggal: date, content, teacher_id: req.user.id }])
        .select()
        .single();
      error = result.error;
      data = result.data;
      if (data) data = { ...data, type: 'Wali Kelas', original_id: data.id, id: `wk-${data.id}` };
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // E-Raport Routes
  app.get('/api/eraport', authenticateToken, async (req: any, res) => {
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('eraport')
      .select(`
        *,
        siswa!inner(nama)
      `)
      .eq('teacher_id', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Flatten the student name
    const formattedData = (data || []).map((item: any) => ({
      ...item,
      student_name: item.siswa?.nama || 'Unknown',
      student_nis: item.nis,
      score: item.nilai,
      subject: item.mapel
    }));
    
    res.json(formattedData);
  });

  app.post('/api/eraport', authenticateToken, async (req: any, res) => {
    const { student_nis, subject, score, semester, tugas1, tugas2, formatif1, formatif2, pts, uas } = req.body;
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('eraport')
      .insert([{
        nis: student_nis, mapel: subject, nilai: score, semester, teacher_id: req.user.id,
        tugas1: tugas1 || 0, tugas2: tugas2 || 0, formatif1: formatif1 || 0, formatif2: formatif2 || 0, pts: pts || 0, uas: uas || 0
      }]);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete('/api/eraport/:id', authenticateToken, async (req: any, res) => {
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('eraport')
      .delete()
      .eq('id', req.params.id)
      .eq('teacher_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // KKM Routes
  app.get('/api/kkm', authenticateToken, async (req: any, res) => {
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('kkm')
      .select('*')
      .eq('teacher_id', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/kkm', authenticateToken, async (req: any, res) => {
    const { subject, value } = req.body;
    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('kkm')
      .upsert({ subject, value, teacher_id: req.user.id }, { onConflict: 'subject,teacher_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Stats
  app.get('/api/stats', authenticateToken, async (req: any, res) => {
    const client = getSupabaseClient(req.supabaseToken);
    const [
      { count: studentsCount },
      { count: agendaCount },
      { count: piketCount },
      { count: waliCount },
      { count: eraportCount }
    ] = await Promise.all([
      client.from('siswa').select('*', { count: 'exact', head: true }).eq('created_by', req.user.id),
      client.from('agenda_guru').select('*', { count: 'exact', head: true }).eq('uploaded_by', req.user.id),
      client.from('laporan_piket').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id),
      client.from('laporan_walikelas').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id),
      client.from('eraport').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id)
    ]);

    res.json({
      students: studentsCount || 0,
      agenda: agendaCount || 0,
      reports: (piketCount || 0) + (waliCount || 0),
      eraport: eraportCount || 0
    });
  });

  // Attendance Routes
  app.get('/api/attendance', authenticateToken, async (req: any, res) => {
    const { date, startDate, endDate } = req.query;
    let query = getSupabaseClient(req.supabaseToken)
      .from('absensi_siswa')
      .select('*')
      .eq('teacher_id', req.user.id);

    if (date) {
      query = query.eq('tanggal', date);
    } else if (startDate && endDate) {
      query = query.gte('tanggal', startDate).lte('tanggal', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) return res.status(500).json({ error: error.message });
    
    // Map back to frontend format
    const formatted = (data || []).map((d: any) => ({
      ...d,
      student_nis: d.nis,
      date: d.tanggal
    }));
    
    res.json(formatted);
  });

  app.post('/api/attendance', authenticateToken, async (req: any, res) => {
    const { attendance } = req.body; // Array of { student_nis, date, status }
    if (!Array.isArray(attendance)) return res.status(400).json({ error: 'Invalid data format' });

    const attendanceToInsert = attendance.map(a => ({
      nis: a.student_nis,
      tanggal: a.date,
      status: a.status,
      teacher_id: req.user.id
    }));

    const { error } = await getSupabaseClient(req.supabaseToken)
      .from('absensi_siswa')
      .upsert(attendanceToInsert, { onConflict: 'nis,tanggal,teacher_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // AI Documents Routes
  app.get('/api/ai-documents', authenticateToken, async (req: any, res) => {
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('ai_documents')
      .select('*')
      .eq('created_by', req.user.id)
      .order('id', { ascending: false })
      .limit(50);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/ai-documents', authenticateToken, async (req: any, res) => {
    const { type, content, pdf_url } = req.body;
    const { data, error } = await getSupabaseClient(req.supabaseToken)
      .from('ai_documents')
      .insert([{ type, content, pdf_url, created_by: req.user.id }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Global error handler for API routes
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
