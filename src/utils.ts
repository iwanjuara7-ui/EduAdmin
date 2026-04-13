import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import katex from 'katex';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Render Block LaTeX: $$...$$
  html = html.replace(/\$\$(.*?)\$\$/gs, (_, formula) => {
    try {
      return `<div class="katex-block" style="text-align: center; margin: 1.5em 0;">${katex.renderToString(formula, { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return `$$${formula}$$`;
    }
  });

  // Render Inline LaTeX: $...$
  html = html.replace(/\$(.*?)\$/g, (_, formula) => {
    try {
      return katex.renderToString(formula, { displayMode: false, throwOnError: false });
    } catch (e) {
      return `$${formula}$`;
    }
  });

  // Headers
  html = html
    .replace(/^# (.*$)/gim, '<h1 style="font-size: 22pt; font-weight: bold; margin-top: 24pt; margin-bottom: 12pt; border-bottom: 2px solid #333; padding-bottom: 5pt; text-align: center;">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size: 18pt; font-weight: bold; margin-top: 20pt; margin-bottom: 10pt; color: #333;">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 style="font-size: 14pt; font-weight: bold; margin-top: 16pt; margin-bottom: 8pt; color: #444;">$1</h3>');

  // Bold and Italic (Non-greedy)
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');

  // Handle <br> tags if AI generates them
  html = html.replace(/&lt;br&gt;/g, '<br/>');
  html = html.replace(/<br\s*\/?>/gi, '<br/>');

  // Lists
  // Unordered lists
  html = html.replace(/^\s*[-*+]\s+(.*)$/gim, '<li style="margin-left: 25pt; margin-bottom: 5pt;">$1</li>');
  // Ordered lists
  html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li style="margin-left: 25pt; margin-bottom: 5pt; list-style-type: decimal;">$1</li>');

  // Wrap lists in ul/ol
  html = html.replace(/(<li style="margin-left: 25pt; margin-bottom: 5pt;">.*?<\/li>)+/gs, '<ul>$&</ul>');
  html = html.replace(/(<li style="margin-left: 25pt; margin-bottom: 5pt; list-style-type: decimal;">.*?<\/li>)+/gs, '<ol>$&</ol>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #ccc; padding: 10pt 20pt; margin: 15pt 0; background: #f9f9f9; font-style: italic;">$1</blockquote>');

  // Tables (Basic support)
  html = html.replace(/^\|(.+)\|$\n^\|([-| :]+)\|$\n((^\|.+\|$\n?)+)/gim, (match, header, separator, body) => {
    const headers = header.split('|').filter((h: string) => h.trim() !== '').map((h: string) => `<th style="border: 1.5px solid #333; padding: 10pt 8pt; background-color: #f8f9fa; text-align: center; font-weight: bold; font-size: 11pt;">${h.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row: string, index: number) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#fcfcfc';
      const cells = row.split('|').filter((c: string) => c.trim() !== '').map((c: string) => `<td style="border: 1px solid #666; padding: 8pt; text-align: left; vertical-align: top; white-space: pre-wrap;">${c.trim()}</td>`).join('');
      return `<tr style="background-color: ${bgColor};">${cells}</tr>`;
    }).join('');
    return `<div style="margin: 20pt 0; overflow-x: auto;"><table style="border-collapse: collapse; width: 100%; border: 2px solid #333; font-family: Arial, sans-serif;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });

  // Images and Links
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    if (!src || src.trim() === '') return '';
    return `<img alt="${alt}" src="${src}" referrerPolicy="no-referrer" style="max-width: 100%; margin: 15pt 0; display: block; margin-left: auto; margin-right: auto;" />`;
  });
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #0056b3; text-decoration: underline;">$1</a>');

  // Paragraphs and Line Breaks
  const lines = html.split('\n');
  let result = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      result += '<div style="height: 10pt;"></div>';
      continue;
    }

    if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || line.startsWith('<li') || line.startsWith('<blockquote') || line.startsWith('<div') || line.startsWith('<table')) {
      result += line;
    } else {
      result += `<p style="margin-bottom: 10pt; text-align: justify; line-height: 1.6;">${line}</p>`;
    }
  }

  return result;
}
