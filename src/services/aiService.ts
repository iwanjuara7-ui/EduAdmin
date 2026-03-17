import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateEducationDocument = async (params: {
  type: string;
  subject: string;
  className: string;
  topic: string;
  objectives: string;
  duration: string;
}) => {
  const prompt = `Generate a professional Indonesian SMA (Senior High School) education document of type ${params.type}.
  Subject: ${params.subject}
  Class: ${params.className}
  Topic: ${params.topic}
  Learning Objectives: ${params.objectives}
  Duration: ${params.duration}
  
  Format the output in Markdown with clear sections (Pendahuluan, Inti, Penutup, Penilaian).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};

export const generateExamQuestions = async (params: {
  subject: string;
  level: string;
  topic: string;
  difficulty: string;
  config: { type: string; count: number }[];
}) => {
  const configStr = params.config.map(c => `${c.count} ${c.type}`).join(', ');
  const prompt = `Generate ${params.subject} exam questions for SMA level ${params.level}.
  Topic: ${params.topic}
  Difficulty Level: ${params.difficulty}.
  Question distribution: ${configStr}.
  
  For Multiple Choice (Biasa/Komplek/Berbasis Kasus), provide 5 options (A-E).
  For "Menjodohkan", provide a list of items to match.
  Include an answer key at the end.
  Format in Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
};
