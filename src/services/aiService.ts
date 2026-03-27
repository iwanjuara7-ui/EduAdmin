import { GoogleGenAI } from "@google/genai";
import mammoth from 'mammoth';

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
    console.log(`Image generation response parts count: ${parts.length}`);
    
    for (const part of parts) {
      if (part.inlineData) {
        console.log(`Successfully generated image data (length: ${part.inlineData.data.length})`);
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    console.warn("No inlineData found in image generation response");
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

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });

  return cleanAIResponse(response.text);
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
    // More robust regex to catch variations and ensure we match the whole tag
    const imageRegex = /\[IMAGE_PROMPT:\s*([^\]]+)\]/gi;
    
    // We need to process matches one by one to avoid issues with identical prompts
    let match;
    const processedPrompts = new Map<string, string>();
    
    // Create a copy of the content to modify
    let updatedContent = content;
    
    // Find all matches first
    const matches = Array.from(content.matchAll(imageRegex));
    
    for (const match of matches) {
      const fullTag = match[0];
      const imagePrompt = match[1].trim();
      
      try {
        let imageUrl = processedPrompts.get(imagePrompt);
        
        if (!imageUrl) {
          console.log(`Generating image for prompt: ${imagePrompt}`);
          imageUrl = await generateImage(imagePrompt);
          if (imageUrl) {
            processedPrompts.set(imagePrompt, imageUrl);
          }
        }
        
        if (imageUrl) {
          // Use split/join for safe replacement of all occurrences of this specific tag
          updatedContent = updatedContent.split(fullTag).join(`\n\n![Diagram/Gambar](${imageUrl})\n\n`);
        } else {
          updatedContent = updatedContent.split(fullTag).join(`\n\n*(Gambar sedang diproses atau tidak dapat dimuat)*\n\n`);
        }
      } catch (err) {
        console.error("Error processing image tag:", err);
        updatedContent = updatedContent.split(fullTag).join(`\n\n*(Gagal memproses gambar)*\n\n`);
      }
    }
    content = updatedContent;
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

  if (params.type.includes('ProSem') || params.type.includes('ProTa')) {
    userPrompt += `\n  CRITICAL: Distribute the teaching weeks (Mg) realistically across the months. Do NOT cluster all weeks in one month. Ensure a balanced distribution for a typical academic semester.`;
  }

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
    return cleanAIResponse(response.text);
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
    return cleanAIResponse(response.text);
  } else {
    throw new Error("Unsupported file type. Please upload PDF or DOCX.");
  }
};
