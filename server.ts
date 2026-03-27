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

/**
 * SUPABASE SETUP GUIDE:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Get your URL and Anon Key from Project Settings > API
 * 3. Add them to the Secrets panel in AI Studio as SUPABASE_URL and SUPABASE_ANON_KEY
 * 4. Run this SQL in your Supabase SQL Editor to create the tables:
 * 
 * -- Create users table (profile)
 * create table public.users (
 *   id uuid references auth.users not null primary key,
 *   email text not null,
 *   name text,
 *   subject text,
 *   password text,
 *   photo_url text,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create siswa table
 * create table public.siswa (
 *   nis text primary key,
 *   nama text not null,
 *   kelas text,
 *   created_by uuid references auth.users,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create agenda_guru table
 * create table public.agenda_guru (
 *   id serial primary key,
 *   judul text not null,
 *   tanggal date not null,
 *   file_pdf text,
 *   content text,
 *   uploaded_by uuid references auth.users,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create laporan_piket table
 * create table public.laporan_piket (
 *   id serial primary key,
 *   judul text not null,
 *   tanggal date not null,
 *   file_pdf text,
 *   content text,
 *   teacher_id uuid references auth.users,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create laporan_walikelas table
 * create table public.laporan_walikelas (
 *   id serial primary key,
 *   judul text not null,
 *   tanggal date not null,
 *   file_pdf text,
 *   content text,
 *   teacher_id uuid references auth.users,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create eraport table
 * create table public.eraport (
 *   id serial primary key,
 *   nis text references public.siswa(nis),
 *   mapel text not null,
 *   nilai numeric not null,
 *   semester text not null,
 *   teacher_id uuid references auth.users,
 *   tugas1 numeric default 0,
 *   tugas2 numeric default 0,
 *   formatif1 numeric default 0,
 *   formatif2 numeric default 0,
 *   pts numeric default 0,
 *   uas numeric default 0,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Create kkm table
 * create table public.kkm (
 *   id serial primary key,
 *   subject text not null,
 *   value numeric not null,
 *   teacher_id uuid references auth.users,
 *   unique(subject, teacher_id)
 * );
 * 
 * -- Create absensi_siswa table
 * create table public.absensi_siswa (
 *   id serial primary key,
 *   nis text references public.siswa(nis),
 *   tanggal date not null,
 *   status text not null,
 *   teacher_id uuid references auth.users,
 *   unique(nis, tanggal, teacher_id)
 * );
 * 
 * -- Create ai_documents table
 * create table public.ai_documents (
 *   id serial primary key,
 *   type text not null,
 *   content text not null,
 *   pdf_url text,
 *   created_by uuid references auth.users,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * -- Disable "Email Confirmation" in Authentication > Settings if you want instant login.
 */
const DB_FILE = path.resolve('db.json');
let inMemoryStore: Record<string, any[]> = {
  users: [],
  siswa: [],
  agenda_guru: [],
  laporan_piket: [],
  laporan_walikelas: [],
  eraport: [],
  kkm: [],
  absensi_siswa: [],
  ai_documents: []
};

// Load data from file if exists
if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    inMemoryStore = JSON.parse(data);
    console.log('Data loaded from db.json');
  } catch (err) {
    console.error('Failed to load db.json:', err);
  }
}

function saveToDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryStore, null, 2));
  } catch (err) {
    console.error('Failed to save to db.json:', err);
  }
}

const STORAGE_BUCKET = 'EduAdmin';

async function uploadToSupabase(file: any, folder: string = 'uploads') {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !supabase.storage) {
    return `/uploads/${file.filename}`;
  }

  try {
    const fileExt = path.extname(file.originalname);
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
    const fileBuffer = fs.readFileSync(file.path);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase storage error:', error);
      if (error.message.includes('row-level security policy')) {
        console.error('FIX: You need to add a storage policy in Supabase to allow uploads to the "EduAdmin" bucket. See supabase_schema.sql for the SQL commands.');
      }
      return `/uploads/${file.filename}`; // Fallback to local
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error('Upload to Supabase failed:', err);
    return `/uploads/${file.filename}`;
  }
}

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
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, subject } = req.body;
    
    try {
      // 1. Check if email already exists in our users table (profile/fallback)
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (existingProfile) {
        return res.status(400).json({ error: 'Email sudah terdaftar. Silakan login.' });
      }

      // 2. Register with Supabase Auth if available
      let authUserId = null;
      if (supabase.auth && typeof supabase.auth.signUp === 'function' && SUPABASE_URL) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          // If user already registered in Auth but not in our table (ghost user)
          if (authError.message.includes('already registered')) {
            console.log('User already in Auth, attempting to recover profile...');
            // Try to sign in to get the ID
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (signInError) {
              return res.status(400).json({ error: 'Email sudah terdaftar di sistem. Silakan login.' });
            }
            authUserId = signInData.user?.id;
          } else {
            console.error('Supabase Auth SignUp Error:', authError);
            return res.status(400).json({ error: authError.message });
          }
        } else {
          authUserId = authData.user?.id;
        }
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      
      // 3. Insert into users table (profile profile)
      const userData = { 
        id: authUserId || `mock-${Math.random().toString(36).substring(2, 10)}`,
        email, 
        password: hashedPassword, 
        name, 
        subject 
      };

      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error || !data) {
        console.error('Database Insert Error:', error?.message || error, error?.code, error?.details);
        
        // If it's a "duplicate key" error, it means the profile was somehow created
        if (error?.code === '23505') {
           return res.status(400).json({ error: 'Profil sudah ada. Silakan login.' });
        }

        return res.status(400).json({ 
          error: 'Registrasi gagal di database. Silakan coba lagi.',
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

      // 1. Try Supabase Auth first if available
      if (supabase.auth && typeof supabase.auth.signInWithPassword === 'function' && SUPABASE_URL) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!authError && authData.user) {
          // Auth success, get profile from users table
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
          
          if (profile) {
            user = profile;
          } else {
            // If auth succeeded but profile missing (shouldn't happen with proper register)
            user = { 
              id: authData.user.id, 
              email: authData.user.email, 
              name: authData.user.user_metadata?.name || email.split('@')[0],
              subject: 'Guru'
            };
          }
        }
      }

      // 2. Fallback to manual check (for mock or legacy users)
      if (!user) {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email);

        if (!error && users) {
          const userList = Array.isArray(users) ? users : [users];
          user = userList.find(u => {
            try {
              return bcrypt.compareSync(password, u.password);
            } catch (e) {
              return false;
            }
          });
        }
      }

      if (user) {
        const token = jwt.sign({ 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          subject: user.subject, 
          photo_url: user.photo_url 
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
    console.log('Upload photo request received for user:', req.user.id);
    upload.single('photo')(req, res, async (err: any) => {
      try {
        if (err instanceof multer.MulterError) {
          console.error('Multer error:', err);
          return res.status(400).json({ error: `Multer error: ${err.message}` });
        } else if (err) {
          console.error('Unknown upload error:', err);
          return res.status(500).json({ error: `Unknown error: ${err.message}` });
        }

        if (!req.file) {
          console.error('No file uploaded in request');
          return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log('File uploaded to local storage:', req.file.path);
        const photoUrl = await uploadToSupabase(req.file, 'profiles');
        console.log('Photo URL generated:', photoUrl);
        
        // Ghost user recovery for mock environment
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          const userExists = inMemoryStore.users.some(u => 
            String(u.id) === String(req.user.id) || u.email === req.user.email
          );
          if (!userExists) {
            console.warn('Ghost user detected in mock, re-inserting from token:', req.user.id);
            inMemoryStore.users.push({
              id: Number(req.user.id) || req.user.id,
              email: req.user.email,
              name: req.user.name || req.user.email?.split('@')[0] || 'User',
              subject: req.user.subject || 'Guru',
              photo_url: req.user.photo_url,
              password: 'recovered-from-token'
            });
            saveToDB();
          }
        }

        // Use update instead of upsert to avoid NOT NULL constraint errors on password
        const updateData = { 
          photo_url: photoUrl,
          name: req.user.name || req.user.email?.split('@')[0] || 'User',
          subject: req.user.subject || 'Guru'
        };

        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', req.user.id)
          .select()
          .single();

        if (error || !data) {
          console.error('Database update error after upload:', error?.message || error, error?.code, error?.details);
          console.log('Target user ID:', req.user.id);
          console.log('Update data:', updateData);
          
          return res.status(400).json({ 
            error: 'Gagal memperbarui profil di database.',
            details: error ? error.message : 'User not found'
          });
        }
        
        console.log('User profile updated with new photo URL');
        const token = jwt.sign({ id: data.id, email: data.email, name: data.name, subject: data.subject, photo_url: data.photo_url }, JWT_SECRET);
        res.json({ token, user: { id: data.id, email: data.email, name: data.name, subject: data.subject, photo_url: data.photo_url } });
      } catch (dbErr: any) {
        console.error('Exception during upload processing:', dbErr);
        res.status(500).json({ error: dbErr.message || 'Internal server error during upload' });
      }
    });
  });

  // Student Routes
  app.get('/api/students', authenticateToken, async (req: any, res) => {
    const { data, error } = await supabase
      .from('siswa')
      .select('*')
      .eq('created_by', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/students', authenticateToken, async (req: any, res) => {
    const { nis, name, className } = req.body;
    const { error } = await supabase
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

      const { error } = await supabase
        .from('siswa')
        .upsert(studentsToInsert, { onConflict: 'nis' });

      if (error) {
        console.error('Supabase bulk upsert error:', error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('Bulk upload handler error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/students/:nis', authenticateToken, async (req: any, res) => {
    const { name, className } = req.body;
    const { nis } = req.params;
    
    const { error } = await supabase
      .from('siswa')
      .update({ nama: name, kelas: className })
      .eq('nis', nis)
      .eq('created_by', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete('/api/students/:nis', authenticateToken, async (req: any, res) => {
    const { nis } = req.params;
    const { error } = await supabase
      .from('siswa')
      .delete()
      .eq('nis', nis)
      .eq('created_by', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  // Agenda & Reports
  app.get('/api/agenda', authenticateToken, async (req: any, res) => {
    const { data, error } = await supabase
      .from('agenda_guru')
      .select('*')
      .eq('uploaded_by', req.user.id)
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get('/api/reports', authenticateToken, async (req: any, res) => {
    const [piket, walikelas] = await Promise.all([
      supabase.from('laporan_piket').select('*').eq('teacher_id', req.user.id),
      supabase.from('laporan_walikelas').select('*').eq('teacher_id', req.user.id)
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
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: `Multer error: ${err.message}` });
        } else if (err) {
          return res.status(500).json({ error: `Unknown error: ${err.message}` });
        }

        const { title, date, type } = req.body;
        const filePath = req.file ? await uploadToSupabase(req.file, 'documents') : null;
        
        let error, data;
        if (type === 'agenda') {
          const result = await supabase
            .from('agenda_guru')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, uploaded_by: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
        } else if (type === 'Piket') {
          const result = await supabase
            .from('laporan_piket')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, teacher_id: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
          if (data) data = { ...data, type: 'Piket', original_id: data.id, id: `piket-${data.id}` };
        } else {
          const result = await supabase
            .from('laporan_walikelas')
            .insert([{ judul: title, tanggal: date, file_pdf: filePath, teacher_id: req.user.id }])
            .select()
            .single();
          error = result.error;
          data = result.data;
          if (data) data = { ...data, type: 'Wali Kelas', original_id: data.id, id: `wk-${data.id}` };
        }

        if (error) {
          console.error('Database insert error during upload:', error);
          return res.status(500).json({ error: error.message });
        }
        res.json(data);
      } catch (e: any) {
        console.error('Exception during /api/upload processing:', e);
        res.status(500).json({ error: e.message || 'Internal server error during upload' });
      }
    });
  });

  app.post('/api/manual', authenticateToken, async (req: any, res) => {
    const { title, date, type, content } = req.body;
    
    let error, data;
    if (type === 'agenda') {
      const result = await supabase
        .from('agenda_guru')
        .insert([{ judul: title, tanggal: date, content, uploaded_by: req.user.id }])
        .select()
        .single();
      error = result.error;
      data = result.data;
    } else if (type === 'Piket') {
      const result = await supabase
        .from('laporan_piket')
        .insert([{ judul: title, tanggal: date, content, teacher_id: req.user.id }])
        .select()
        .single();
      error = result.error;
      data = result.data;
      if (data) data = { ...data, type: 'Piket', original_id: data.id, id: `piket-${data.id}` };
    } else {
      const result = await supabase
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
    const { data, error } = await supabase
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
    const { error } = await supabase
      .from('eraport')
      .insert([{
        nis: student_nis, mapel: subject, nilai: score, semester, teacher_id: req.user.id,
        tugas1: tugas1 || 0, tugas2: tugas2 || 0, formatif1: formatif1 || 0, formatif2: formatif2 || 0, pts: pts || 0, uas: uas || 0
      }]);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete('/api/eraport/:id', authenticateToken, async (req: any, res) => {
    const { error } = await supabase
      .from('eraport')
      .delete()
      .eq('id', req.params.id)
      .eq('teacher_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // KKM Routes
  app.get('/api/kkm', authenticateToken, async (req: any, res) => {
    const { data, error } = await supabase
      .from('kkm')
      .select('*')
      .eq('teacher_id', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/kkm', authenticateToken, async (req: any, res) => {
    const { subject, value } = req.body;
    const { error } = await supabase
      .from('kkm')
      .upsert({ subject, value, teacher_id: req.user.id }, { onConflict: 'subject,teacher_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Stats
  app.get('/api/stats', authenticateToken, async (req: any, res) => {
    const [
      { count: studentsCount },
      { count: agendaCount },
      { count: piketCount },
      { count: waliCount },
      { count: eraportCount }
    ] = await Promise.all([
      supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('created_by', req.user.id),
      supabase.from('agenda_guru').select('*', { count: 'exact', head: true }).eq('uploaded_by', req.user.id),
      supabase.from('laporan_piket').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id),
      supabase.from('laporan_walikelas').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id),
      supabase.from('eraport').select('*', { count: 'exact', head: true }).eq('teacher_id', req.user.id)
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
    let query = supabase
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
    const formatted = data.map((d: any) => ({
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

    const { error } = await supabase
      .from('absensi_siswa')
      .upsert(attendanceToInsert, { onConflict: 'nis,tanggal,teacher_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // AI Documents Routes
  app.get('/api/ai-documents', authenticateToken, async (req: any, res) => {
    const { data, error } = await supabase
      .from('ai_documents')
      .select('*')
      .eq('created_by', req.user.id)
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/ai-documents', authenticateToken, async (req: any, res) => {
    const { type, content, pdf_url } = req.body;
    const { data, error } = await supabase
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
        hmr: process.env.DISABLE_HMR !== 'true'
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
