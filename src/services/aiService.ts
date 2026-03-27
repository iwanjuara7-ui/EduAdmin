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
    const userId = session?.user?.id;
    
    if (!userId) {
      console.warn('User not authenticated. Falling back to base64 for image.');
      return `data:${mimeType};base64,${base64Data}`;
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

export const generateImage = async (prompt: string) => {
  const ai = getAI();
  console.log(`Starting image generation for: "${prompt}"`);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
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
    return null;
  } catch (error) {
    console.error("Image generation error details:", error);
    return null;
  }
};

const SYSTEM_INSTRUCTION = `You are a professional Indonesian SMA (Senior High School) education expert. 
Your task is to generate a high-quality education document (RPP, Modul, Materi, LKS, or Soal Ujian) based on the provided context or file content.

CRITICAL RULES:
1. Return ONLY the content in Markdown format.
2. Do NOT include any conversational filler, introductory text, or concluding remarks.
3. Do NOT use code blocks like \`\`\`markdown or \`\`\` at the beginning or end.
4. REMOVE all unnecessary strings, headers, footers, or artifacts from the file extraction.
5. For Mathematical, Physics, or Chemical formulas, use LaTeX format ($...$ for inline, $$...$$ for block).
6. Make the formulas attractive, easy to read, and easy to understand.
7. Organize the content into clear sections: 
   - For RPP/Modul/Materi: Pendahuluan, Inti, Penutup, and Penilaian.
   - For LKS (Lembar Kerja Siswa): Identitas, Petunjuk Belajar, Kompetensi/Tujuan, Ringkasan Materi, Tugas/Latihan, and Penilaian.
   - For Soal Ujian: List of questions with clear numbering and options (if multiple choice).
   - For ProTa (Program Tahunan): Use a Markdown TABLE with columns: No, Semester, Kompetensi Dasar/Tujuan Pembelajaran, Alokasi Waktu (JP), and Keterangan.
   - For ProSem (Program Semester): Use a Markdown TABLE with columns: No, Materi Pokok, Alokasi Waktu (JP), and monthly distribution (Jan, Feb, Mar, etc. with weeks 1-4/5). Use 'X' or numbers to mark the weeks.
8. Use professional Indonesian language (Bahasa Indonesia yang baik dan benar).
9. VISUAL CONTENT: If a question or explanation would benefit from a diagram, chart, or illustration (especially in Science/Math), insert a tag: [IMAGE_PROMPT: a very detailed English description of the visual needed].
10. TABLES: Always use standard Markdown tables for data that is best presented in a tabular format. Ensure tables have clear headers and at least 3-5 rows of data. DO NOT use raw HTML tags like <br> inside table cells; use standard Markdown line breaks (two spaces at the end of a line) if needed.`;

const cleanAIResponse = (text: string) => {
  if (!text) return '';
  
  // Remove markdown code block wrappers
  let cleaned = text.replace(/```markdown\n?/g, '').replace(/```\n?/g, '');
  
  // Remove common AI introductory/concluding phrases (Indonesian)
  const phrasesToRemove = [
    /^Tentu, berikut adalah.*:?\n?/i,
    /^Berikut adalah.*:?\n?/i,
    /^Ini adalah.*:?\n?/i,
    /\n?Semoga bermanfaat.*$/i,
    /\n?Demikian.*$/i,
    /\n?Terima kasih.*$/i
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
  let prompt = `Generate a professional Indonesian SMA (Senior High School) education document of type ${params.type}.
  Subject: ${params.subject}
  Class: ${params.className}
  Topic: ${params.topic}
  Learning Objectives: ${params.objectives}
  Duration: ${params.duration}`;

  if (params.semester) {
    prompt += `\n  Semester: ${params.semester}`;
  }

  if (params.academicCalendar) {
    prompt += `\n  Academic Calendar / Effective Weeks Info: ${params.academicCalendar}
    CRITICAL: You MUST distribute the teaching weeks (Mg) according to this specific calendar info. Do NOT cluster all weeks in one month. Spread them realistically across the semester months.`;
  } else if (params.type.includes('ProSem') || params.type.includes('ProTa')) {
    prompt += `\n  CRITICAL: Distribute the teaching weeks (Mg) realistically across the months. Do NOT cluster all weeks in one month. Ensure a balanced distribution for a typical academic semester.`;
  }
  
  prompt += `\n\n  Ensure all formulas are converted to beautiful LaTeX.`;

  if (params.withImages) {
    prompt += `\n\nCRITICAL FOR VISUAL CONTENT:
    You MUST include diagrams, charts, or illustrations for concepts that require visual explanation (e.g., Physics circuits, Biology cells, Math geometry, Chemistry molecular structures).
    For EACH such concept, insert a tag immediately after the explanation text: [IMAGE_PROMPT: very detailed English description of the diagram].
    Example: [IMAGE_PROMPT: A detailed physics circuit diagram with a 12V battery and three resistors (2 ohm, 4 ohm, 6 ohm) in a combination of series and parallel].
    The description MUST be in English and very specific to allow for accurate generation.`;
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
  const imageRegex = /\[IMAGE_PROMPT:\s*([^\]]+)\]/gi;
  const matches = Array.from(content.matchAll(imageRegex));
  
  if (matches.length === 0) return content;

  console.log(`Found ${matches.length} image prompts. Generating images...`);

  // Parallelize image generation with individual error handling
  const imagePromises = matches.map(async (match) => {
    const fullTag = match[0];
    const imagePrompt = match[1].trim();
    try {
      // Add more descriptive context to the prompt for better results
      const enhancedPrompt = `High quality educational illustration for: ${imagePrompt}. Style: clean, professional, academic, 2D vector illustration, white background.`;
      const imageUrl = await generateImage(enhancedPrompt);
      return { fullTag, imageUrl };
    } catch (err) {
      console.error(`Error generating image for prompt "${imagePrompt}":`, err);
      return { fullTag, imageUrl: null };
    }
  });

  const results = await Promise.all(imagePromises);
  
  let updatedContent = content;
  for (const { fullTag, imageUrl } of results) {
    if (imageUrl) {
      // Use a more robust replacement that handles multiple occurrences of the same tag
      // and ensures it's rendered as a proper markdown image
      const markdownImage = `\n\n![${fullTag.replace(/[\[\]]/g, '')}](${imageUrl})\n\n`;
      updatedContent = updatedContent.split(fullTag).join(markdownImage);
    } else {
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
  
  let prompt = `Generate ${params.subject} exam questions for SMA level ${params.level}.
  Topic: ${params.topic}
  Detailed Question distribution: ${configStr}.
  
  Please strictly follow the detailed question distribution for each type and its specific difficulty level (LOTS/MOTS/HOTS).
  Include an answer key at the end.
  Ensure all formulas are converted to beautiful LaTeX.`;

  if (params.withImages) {
    prompt += `\n\nCRITICAL FOR VISUAL QUESTIONS:
    You MUST include diagrams, charts, or illustrations for questions that require visual analysis (e.g., Physics circuits, Biology cells, Math geometry, Chemistry molecular structures).
    For EACH such question, insert a tag immediately after the question text: [IMAGE_PROMPT: very detailed English description of the diagram].
    Example: [IMAGE_PROMPT: A detailed physics circuit diagram with a 12V battery and three resistors (2 ohm, 4 ohm, 6 ohm) in a combination of series and parallel].
    The description MUST be in English and very specific to allow for accurate generation.`;
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
  
  let userPrompt = `Generate a ${params.type} for:
  Subject: ${params.subject}
  Class: ${params.className || params.level}
  ${params.duration ? `Duration: ${params.duration}` : ''}
  ${params.semester ? `Semester: ${params.semester}` : ''}
  ${params.academicCalendar ? `Academic Calendar Info: ${params.academicCalendar}` : ''}
  ${params.config ? `Detailed Question distribution: ${params.config.map(c => `${c.count} ${c.type}${c.difficulty ? ` (${c.difficulty})` : ''}`).join(', ')}` : ''}
  
  Use the content from the attached file to build this document. Ensure all formulas are converted to beautiful LaTeX.`;

  if (params.withImages) {
    userPrompt += `\n\nCRITICAL FOR VISUAL QUESTIONS:
    You MUST include diagrams, charts, or illustrations for questions that require visual analysis (e.g., Physics circuits, Biology cells, Math geometry, Chemistry molecular structures).
    For EACH such question, insert a tag immediately after the question text: [IMAGE_PROMPT: very detailed English description of the diagram].
    Example: [IMAGE_PROMPT: A detailed physics circuit diagram with a 12V battery and three resistors (2 ohm, 4 ohm, 6 ohm) in a combination of series and parallel].
    The description MUST be in English and very specific to allow for accurate generation.`;
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
