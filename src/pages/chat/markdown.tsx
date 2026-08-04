import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Download, Copy, Check } from 'lucide-react';
import { downloadTextFile } from './mediaUtils';

// ─── Code block with copy & download buttons — scrolls when > 10 lines ───────
const LINE_HEIGHT_PX = 22; // approximate line height in px (matches leading-relaxed @ ~13-14px font)
const MAX_VISIBLE_LINES = 10;

export const CodeBlock: FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);
  const trimmed = code.trim();
  const needsScroll = trimmed.split('\n').length > MAX_VISIBLE_LINES;

  const copy = () => {
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-[#09090F] max-w-full min-w-0 shadow-lg">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-800/90 border-b border-slate-700/80">
        <span className="font-mono text-[10px] sm:text-[11px] text-slate-400 tracking-wide uppercase">
          {lang || 'code'}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => downloadTextFile(trimmed, lang)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
            title="Download File"
          >
            <Download className="w-3.5 h-3.5 text-red-400 group-hover:text-white" />
            <span>Download File</span>
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white text-[11px] font-medium transition-all active:scale-95"
            title="Copy Code"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
              : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className={copied ? 'text-emerald-400 font-semibold' : ''}>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div
        className="overflow-x-auto overflow-y-auto"
        style={needsScroll ? { maxHeight: `${MAX_VISIBLE_LINES * LINE_HEIGHT_PX + 32}px` } : undefined}
      >
        <pre className="px-3 sm:px-4 py-3 sm:py-4 min-w-0">
          <code className="font-mono text-[11px] sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre block">
            {trimmed}
          </code>
        </pre>
      </div>
    </div>
  );
};

// ─── react-markdown component overrides (GFM: tables, task lists, strikethrough, autolinks) ───
const components: Components = {
  // Fenced code blocks arrive wrapped in <pre><code>; unwrap into our CodeBlock.
  // Inline `code` never passes through here — it renders as plain <code> below.
  pre({ children }) {
    const child = children as { props?: { className?: string; children?: ReactNode } } | undefined;
    if (child?.props) {
      const lang = /language-(\w+)/.exec(child.props.className || '')?.[1] || 'code';
      return <CodeBlock lang={lang} code={String(child.props.children).replace(/\n$/, '')} />;
    }
    return <pre>{children}</pre>;
  },
  code({ className, children }) {
    return (
      <code className={`px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-red-300 font-mono text-[0.82em] align-middle ${className || ''}`}>
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
  del: ({ children }) => <del className="line-through text-slate-400">{children}</del>,
  h1: ({ children }) => <p className="text-lg font-extrabold text-white mt-3 mb-1">{children}</p>,
  h2: ({ children }) => <p className="text-base font-bold text-white mt-2.5 mb-1">{children}</p>,
  h3: ({ children }) => <p className="text-sm font-bold text-slate-200 mt-2 mb-0.5">{children}</p>,
  h4: ({ children }) => <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1.5 mb-0.5">{children}</p>,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-red-500 bg-red-950/20 pl-3.5 py-1.5 my-2 rounded-r-lg italic text-slate-300 text-xs sm:text-sm">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-slate-700/80 my-3" />,
  ul: ({ children }) => <ul className="space-y-1 my-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1 my-1 list-decimal marker:text-red-400 marker:font-mono pl-4">{children}</ol>,
  li: ({ children, className }) => {
    // remark-gfm tags task-list items with class "task-list-item"; their checkbox
    // is a nested <input> (styled below), so this item skips the bullet marker.
    const isTask = className?.includes('task-list-item');
    return (
      <li className={isTask ? 'flex items-center gap-2 leading-relaxed list-none -ml-4' : 'flex gap-2 leading-relaxed marker:text-red-400'}>
        <span>{children}</span>
      </li>
    );
  },
  input: ({ checked }) => (
    <span className={`w-3.5 h-3.5 rounded border inline-flex items-center justify-center text-[9px] font-bold flex-shrink-0 mr-1.5 ${checked ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600 bg-slate-800 text-transparent'}`}>
      ✓
    </span>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-[#09090F] shadow-lg">
      <table className="w-full text-left border-collapse text-xs sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-800/90 border-b border-slate-700 text-red-400 font-mono">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-800 text-slate-200">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-800/40 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-3.5 py-2 font-bold uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-3.5 py-2.5 leading-relaxed">{children}</td>,
};

export const Markdown: FC<{ text: string }> = ({ text }) => (
  <div className="space-y-0.5">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  </div>
);

// ─── Streaming cursor ─────────────────────────────────────────────────────────
export const Cursor: FC = () => (
  <motion.span
    className="inline-block w-0.5 h-4 bg-red-400 ml-0.5 align-middle"
    animate={{ opacity: [1, 0] }}
    transition={{ repeat: Infinity, duration: 0.5 }}
  />
);
