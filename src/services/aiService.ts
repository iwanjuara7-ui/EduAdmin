import { GoogleGenAI } from "@google/genai";
import mammoth from 'mammoth';
import { supabase } from '../supabaseClient';

// Lazy initialization of the AI client to ensure the API key is available
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please ensure GEMINI_API_KEY is set in your environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const uploadBase64ToSupabase = async (base64Data: string, mimeType: string) => {
  try {
    if (!supabase || !supabase.storage) {
      console.warn('Supabase storage is not initialized. Falling back to base64.');
      return `data:${mimeType};base64,${base64Data}`;
    }

    const { data: { session } } = await supabase.auth.getSession();
    let userId = session?.user?.id;
    
    if (!userId) {
      // Try to get from localStorage if using custom backend
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          userId = parsed.id || parsed.uid || 'anonymous';
        } else {
          userId = 'anonymous';
        }
      } catch (e) {
        userId = 'anonymous';
      }
    }
    
    // Convert base64 to Blob
    let binaryData;
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      binaryData = new Uint8Array(byteNumbers);
    } catch (atobError) {
      console.error('Failed to decode base64 data:', atobError);
      return `data:${mimeType};base64,${base64Data}`;
    }
    
    const blob = new Blob([binaryData], { type: mimeType });
    
    const fileExt = mimeType.split('/')[1] || 'png';
    const fileName = `ai-generated/${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log(`Uploading image to Supabase: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from('EduAdmin')
      .upload(fileName, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) {
      console.error('Supabase upload error:', error.message);
      return `data:${mimeType};base64,${base64Data}`; // Fallback
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('EduAdmin')
      .getPublicUrl(fileName);
      
    console.log(`Image uploaded successfully. Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('Failed to upload AI image to Supabase:', err);
    return `data:${mimeType};base64,${base64Data}`; // Fallback to base64
  }
};

export const generateImage = async (prompt: string, retryCount = 0): Promise<string | null> => {
  const ai = getAI();
  console.log(`Starting image generation (attempt ${retryCount + 1}) for: "${prompt}"`);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData) {
        const url = await uploadBase64ToSupabase(part.inlineData.data, part.inlineData.mimeType);
        return url;
      }
    }
    
    if (retryCount < 1) {
      console.log("No image data in response, retrying...");
      return generateImage(prompt, retryCount + 1);
    }
    
    return null;
  } catch (error) {
    console.error(`Image generation error (attempt ${retryCount + 1}):`, error);
    if (retryCount < 1) {
      return generateImage(prompt, retryCount + 1);
    }
    return null;
  }
};

const SYSTEM_INSTRUCTION = `Anda adalah pakar pendidikan SMA (Sekolah Menengah Atas) di Indonesia yang sangat berpengalaman.
Tugas Anda adalah membuat dokumen pendidikan berkualitas tinggi (RPP, Modul, Materi, LKS/LKPD, atau Soal Ujian) berdasarkan konteks atau konten file yang diberikan.

ATURAN KRITIS (KURIKULUM MERDEKA & DEEP LEARNING):
1. Fokus pada Profil Pelajar Pancasila, Pembelajaran Berdiferensiasi, dan Capaian Pembelajaran (CP).
2. Terapkan prinsip Deep Learning (Meaningful Learning): Mindful, Meditative, Meta-cognitive.
3. Struktur LKPD/LKS harus interaktif, mendorong penyelidikan, dan refleksi.
4. Kembalikan HANYA konten dalam format Markdown.
2. JANGAN sertakan basa-basi, kalimat pembuka, atau penutup (seperti "Tentu, ini soalnya...").
3. JANGAN gunakan blok kode seperti \`\`\`markdown atau \`\`\` di awal atau akhir.
4. HAPUS semua string, header, footer, atau artefak yang tidak perlu dari ekstraksi file.
5. Untuk rumus Matematika, Fisika, atau Kimia, WAJIB gunakan format LaTeX ($...$ untuk inline, $$...$$ untuk blok).
6. Buat rumus terlihat cantik, mudah dibaca, dan mudah dipahami.
10. Atur konten ke dalam bagian yang jelas:
   - Untuk RPP/Modul/Materi: Pendahuluan, Inti, Penutup, dan Penilaian.
   - Untuk LKPD/LKS: Identitas, Capaian Pembelajaran, Petunjuk Belajar, Ringkasan Materi Interaktif, Lembar Kerja/Tantangan (Case Study/Problem Based), Refleksi Terbimbing, dan Penilaian.
   - Untuk Soal Ujian: Daftar soal dengan penomoran jelas dan opsi (jika pilihan ganda).
   - Untuk ProTa: Gunakan TABEL Markdown dengan kolom: No, Semester, Kompetensi Dasar/Tujuan Pembelajaran, Alokasi Waktu (JP), dan Keterangan.
   - Untuk ProSem: Gunakan TABEL Markdown dengan kolom: No, Materi Pokok, Alokasi Waktu (JP), dan distribusi bulanan (Jan, Feb, Mar, dst. dengan minggu 1-4/5). Gunakan 'X' atau angka untuk menandai minggu.
8. Gunakan Bahasa Indonesia yang formal, profesional, dan edukatif.
9. KONTEN VISUAL (SANGAT PENTING): Jika mode gambar aktif, Anda WAJIB menyertakan diagram, bagan, atau ilustrasi untuk konsep yang membutuhkan penjelasan visual (terutama di Sains, Matematika, dan Geografi).
   Gunakan tag: [IMAGE_PROMPT: deskripsi teknis dalam Bahasa Inggris yang sangat mendetail].
   Deskripsi HARUS dalam Bahasa Inggris dan sangat teknis agar dipahami oleh AI pembuat gambar.
10. TABEL: Selalu gunakan tabel Markdown standar untuk data yang paling baik disajikan dalam format tabular.`;

const cleanAIResponse = (text: string) => {
  if (!text) return '';
  
  // Remove markdown code block wrappers (any language)
  let cleaned = text.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/\n?```$/gm, '');
  
  // Remove common AI introductory/concluding phrases (Indonesian)
  const phrasesToRemove = [
    /^Tentu, berikut adalah.*:?\n?/i,
    /^Berikut adalah.*:?\n?/i,
    /^Ini adalah.*:?\n?/i,
    /^Baik, saya akan membuat.*:?\n?/i,
    /\n?Semoga bermanfaat.*$/i,
    /\n?Demikian.*$/i,
    /\n?Terima kasih.*$/i,
    /\n?Silakan beri tahu jika.*$/i
  ];
  
  phrasesToRemove.forEach(phrase => {
    cleaned = cleaned.replace(phrase, '');
  });
  
  return cleaned.trim();
};

export const generateEducationDocument = async (params: {
  type: string;
  subject: string;
  className: string;
  topic: string;
  objectives: string;
  duration: string;
  semester?: string;
  academicCalendar?: string;
  withImages?: boolean;
}) => {
  const ai = getAI();
  let prompt = `Buatlah dokumen pendidikan SMA profesional tipe ${params.type}.
  Mata Pelajaran: ${params.subject}
  Kelas: ${params.className}
  Topik: ${params.topic}
  Tujuan Pembelajaran: ${params.objectives}
  Durasi: ${params.duration}`;

  if (params.semester) {
    prompt += `\n  Semester: ${params.semester}`;
  }

  if (params.academicCalendar) {
    prompt += `\n  Kalender Akademik / Info Minggu Efektif: ${params.academicCalendar}
    KRITIS: Anda WAJIB mendistribusikan minggu mengajar (Mg) sesuai dengan info kalender ini. JANGAN kumpulkan semua minggu dalam satu bulan. Sebarkan secara realistis di seluruh bulan semester.`;
  } else if (params.type.includes('ProSem') || params.type.includes('ProTa')) {
    prompt += `\n  KRITIS: Distribusikan minggu mengajar (Mg) secara realistis di seluruh bulan. JANGAN kumpulkan semua minggu dalam satu bulan. Pastikan distribusi seimbang untuk semester akademik tipikal.`;
  }
  
  if (params.type.includes('LKPD') || params.type.includes('LKS')) {
    prompt += `\n\nKHUSUS LKPD/LKS:
    - Terapkan standar Kurikulum Merdeka.
    - Gunakan pendekatan Deep Learning (Mindful, Meditative, Meta-cognitive).
    - Pastikan ada bagian Masalah Otentik atau Proyek Nyata.
    - Sertakan pertanyaan reflektif yang mendalam untuk siswa.`;
  }

  prompt += `\n\n  Pastikan semua rumus dikonversi ke LaTeX yang indah.`;

  if (params.withImages) {
    prompt += `\n\nINSTRUKSI VISUAL (MODE VISUAL AKTIF):
    Anda WAJIB menyertakan minimal 3-5 ilustrasi visual menggunakan tag khusus: [IMAGE_PROMPT: deskripsi_detail_dalam_bahasa_inggris]
    - Letakkan tag di bagian yang membutuhkan penjelasan visual (misal: struktur sel, grafik fungsi, siklus air).
    - Deskripsi HARUS dalam Bahasa Inggris dan sangat teknis agar dipahami oleh AI pembuat gambar.
    - Contoh: [IMAGE_PROMPT: A professional educational diagram of the human digestive system with labels]`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });

  let content = cleanAIResponse(response.text);

  if (params.withImages) {
    content = await processImageTags(content);
  }

  return content;
};

const processImageTags = async (content: string) => {
  // More robust regex to handle variations in spacing, case, and potential markdown formatting like bolding
  const imageRegex = /(?:\*\*|__)?\[IMAGE_PROMPT:\s*([^\]]+)\](?:\*\*|__)?/gi;
  const matches = Array.from(content.matchAll(imageRegex));
  
  if (matches.length === 0) {
    console.log("No image prompts found in the content. Raw content preview (first 500 chars):", content.substring(0, 500));
    return content;
  }

  console.log(`Found ${matches.length} image prompts. Generating images...`);

  // Parallelize image generation with individual error handling
  const imagePromises = matches.map(async (match, index) => {
    const fullTag = match[0];
    const imagePrompt = match[1].trim();
    console.log(`Generating image ${index + 1}/${matches.length} for prompt: "${imagePrompt}"`);
    try {
      // Add more descriptive context to the prompt for better results
      const enhancedPrompt = `Educational illustration: ${imagePrompt}. 
      Style: Professional academic diagram, 2D vector art, clean lines, high contrast, white background, labeled clearly in English if necessary. 
      No realistic photos, only clear educational diagrams or illustrations. 
      The image should be simple, clear, and easy to understand for students.`;
      const imageUrl = await generateImage(enhancedPrompt);
      if (imageUrl) {
        console.log(`Successfully generated image ${index + 1} URL: ${imageUrl.substring(0, 50)}...`);
      } else {
        console.warn(`Failed to generate image ${index + 1} for prompt: "${imagePrompt}"`);
      }
      return { fullTag, imageUrl };
    } catch (err) {
      console.error(`Error generating image ${index + 1} for prompt "${imagePrompt}":`, err);
      return { fullTag, imageUrl: null };
    }
  });

  const results = await Promise.all(imagePromises);
  
  let updatedContent = content;
  for (const { fullTag, imageUrl } of results) {
    if (imageUrl) {
      // Use a more robust replacement that handles multiple occurrences of the same tag
      // and ensures it's rendered as a proper markdown image
      const markdownImage = `\n\n![Ilustrasi Edukasi](${imageUrl})\n\n`;
      updatedContent = updatedContent.split(fullTag).join(markdownImage);
    } else {
      console.warn(`Image generation failed for tag: ${fullTag}`);
      updatedContent = updatedContent.split(fullTag).join(`\n\n*(Gambar tidak dapat dimuat: ${fullTag.replace(/[\[\]]/g, '')})*\n\n`);
    }
  }
  return updatedContent;
};

export const generateExamQuestions = async (params: {
  subject: string;
  level: string;
  topic: string;
  config: { type: string; count: number; difficulty?: string }[];
  withImages?: boolean;
}) => {
  const ai = getAI();
  const configStr = params.config.map(c => `${c.count} ${c.type}${c.difficulty ? ` (${c.difficulty})` : ''}`).join(', ');
  
  let prompt = `Buatlah soal ujian ${params.subject} untuk tingkat SMA kelas ${params.level}.
  Topik: ${params.topic}
  Distribusi Soal: ${configStr}.
  
  Patuhi distribusi soal dan tingkat kesulitan (LOTS/MOTS/HOTS).
  Sertakan kunci jawaban di akhir.
  Gunakan LaTeX untuk semua rumus.`;

  if (params.withImages) {
    prompt += `\n\nINSTRUKSI VISUAL (MODE SOAL VISUAL AKTIF):
    Anda WAJIB menyertakan minimal satu gambar untuk setiap 2-3 soal.
    Format tag: [IMAGE_PROMPT: deskripsi_detail_dalam_bahasa_inggris]
    Letakkan tag tepat di bawah teks soal sebelum pilihan jawaban.
    Contoh:
    1. Perhatikan gambar berikut! Apa nama organel sel yang ditunjuk?
    [IMAGE_PROMPT: A high-quality 3D diagram of a plant cell with a specific organelle highlighted]
    A. Mitokondria
    B. Ribosom
    ...`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });

  let content = cleanAIResponse(response.text);

  if (params.withImages) {
    content = await processImageTags(content);
  }

  return content;
};

export const generateFromFile = async (file: File, params: {
  type: string;
  subject: string;
  className: string;
  duration?: string;
  level?: string;
  config?: { type: string; count: number; difficulty?: string }[];
  semester?: string;
  academicCalendar?: string;
  withImages?: boolean;
}) => {
  const ai = getAI();
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  let userPrompt = `Buatlah dokumen ${params.type} untuk:
  Mata Pelajaran: ${params.subject}
  Kelas/Tingkat: ${params.className || params.level}
  ${params.duration ? `Durasi: ${params.duration}` : ''}
  ${params.semester ? `Semester: ${params.semester}` : ''}
  ${params.academicCalendar ? `Info Kalender Akademik: ${params.academicCalendar}` : ''}
  ${params.config ? `Distribusi Soal: ${params.config.map(c => `${c.count} ${c.type}${c.difficulty ? ` (${c.difficulty})` : ''}`).join(', ')}` : ''}
  
  Gunakan konten dari file yang dilampirkan untuk membangun dokumen ini. Pastikan semua rumus dikonversi ke LaTeX yang indah.`;

  if (params.withImages) {
    userPrompt += `\n\nINSTRUKSI VISUAL (MODE VISUAL AKTIF):
    Anda WAJIB menyertakan diagram, bagan, atau ilustrasi untuk bagian yang membutuhkan penjelasan visual berdasarkan konten file.
    Format tag: [IMAGE_PROMPT: deskripsi_detail_dalam_bahasa_inggris]
    Letakkan tag tepat setelah teks penjelasan.
    Contoh: [IMAGE_PROMPT: A detailed biology diagram of a plant cell with clearly labeled organelles. 2D vector style.]`;
  }

  if (params.type.includes('ProSem') || params.type.includes('ProTa')) {
    userPrompt += `\n  CRITICAL: Distribute the teaching weeks (Mg) realistically across the months. Do NOT cluster all weeks in one month. Ensure a balanced distribution for a typical academic semester.`;
  }

  let content = '';
  if (fileExt === 'pdf') {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
    reader.readAsDataURL(file);
    const base64Data = await base64Promise;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
            { text: userPrompt }
          ]
        }
      ],
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    content = cleanAIResponse(response.text);
  } else if (fileExt === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const extractedText = result.value;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Extracted text from file:\n\n${extractedText}\n\n---\n\n${userPrompt}` }
          ]
        }
      ],
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    content = cleanAIResponse(response.text);
  } else {
    throw new Error("Unsupported file type. Please upload PDF or DOCX.");
  }

  if (params.withImages) {
    content = await processImageTags(content);
  }

  return content;
};
