'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import { normalizeMathText } from '@/lib/math-normalizer';

type Props = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  block?: boolean;
  inline?: boolean;
  imageMap?: Record<number, string>;
  onImageClick?: (src: string, placeholder: string) => void;
};

type Token =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'block-math'; value: string }
  | { type: 'image'; placeholder: string; index?: number };

export function MathText({ text, className, style, inline = false, imageMap, onImageClick }: Props) {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // 1. Normalize pseudo math like L^(2)m to $L^2m$
    const normalized = normalizeMathText(text);

    // 2. Tokenize by $$, $, and image placeholders
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\[(?:Hình|Hinh|hình)\s*\d+[^\]]*\]|\((?:Hình|Hinh|hình)\s+\d[^\)]*\))/gu;
    const tokens: Token[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      const start = match.index;
      if (start > lastIndex) {
        tokens.push({ type: 'text', value: normalized.slice(lastIndex, start) });
      }
      const raw = match[0];
      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        tokens.push({ type: 'block-math', value: raw.slice(2, -2).trim() });
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        tokens.push({ type: 'inline-math', value: raw.slice(1, -1).trim() });
      } else {
        const numMatch = raw.match(/\d+/);
        const idx = numMatch ? Number(numMatch[0]) : undefined;
        tokens.push({ type: 'image', placeholder: raw, index: idx });
      }
      lastIndex = start + raw.length;
    }

    if (lastIndex < normalized.length) {
      tokens.push({ type: 'text', value: normalized.slice(lastIndex) });
    }

    return tokens.map((token, index) => {
      if (token.type === 'inline-math') {
        try {
          const inlineValue = token.value.replace(/\\frac\b/g, '\\tfrac');
          const html = katex.renderToString(inlineValue, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="math-inline"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="math-fallback">${token.value}$</span>;
        }
      }

      if (token.type === 'block-math') {
        try {
          const html = katex.renderToString(token.value, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <div
              key={index}
              className="math-block"
              style={{ margin: '10px 0', overflowX: 'auto' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <div key={index} className="math-fallback">$${token.value}$$</div>;
        }
      }

      if (token.type === 'image') {
        const src = token.index && imageMap ? imageMap[token.index] : undefined;
        const isSupportedImage = src && !src.includes('wmf') && !src.includes('emf') && !src.includes('embedded-image');
        if (isSupportedImage) {
          return (
            <span key={index} className="math-inline-image-wrap" style={{ display: 'inline-flex', alignItems: 'center', margin: '0 4px', verticalAlign: 'middle' }}>
              <img
                src={src}
                alt={token.placeholder}
                style={{ maxHeight: '80px', maxWidth: '240px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--ux-line-2)', cursor: 'pointer', background: 'var(--ux-surface-2)' }}
                onClick={() => onImageClick?.(src, token.placeholder)}
                title={`Bấm xem hình phóng to: ${token.placeholder}`}
              />
            </span>
          );
        }
        return (
          <span key={index} className="math-image-tag" style={{ color: 'var(--ux-accent)', fontWeight: 650, padding: '2px 6px', background: 'var(--ux-accent-soft)', borderRadius: '4px', margin: '0 2px' }}>
            {token.placeholder}
          </span>
        );
      }

      // Plain text: preserve line breaks
      const lines = token.value.split('\n');
      return (
        <React.Fragment key={index}>
          {lines.map((line, lIdx) => (
            <React.Fragment key={lIdx}>
              {lIdx > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    });
  }, [text, imageMap, onImageClick]);

  if (inline) {
    return <span className={`math-rendered ${className || ''}`} style={style}>{renderedContent}</span>;
  }

  return (
    <div className={`math-rendered ${className || ''}`} style={{ lineHeight: 1.68, ...style }}>
      {renderedContent}
    </div>
  );
}
