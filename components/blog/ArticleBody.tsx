import type { ReactNode } from 'react';

// Light Markdown for blog posts (identical in EstateNav and EstateNav-admin, so the admin preview
// matches the website): ## / ### headings, paragraphs, - and 1. lists, > quotes, ---,
// **bold**, *italic*, [links](url) and ![images](url "optional caption").

const SAFE_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[*_`[\]()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** The ## headings, for a table of contents. */
export function articleHeadings(source: string): { id: string; text: string }[] {
  return source
    .split('\n')
    .filter((l) => /^##\s+/.test(l) && !/^###/.test(l))
    .map((l) => {
      const text = l.replace(/^##\s+/, '').replace(/\*\*/g, '').trim();
      return { id: headingId(text), text };
    });
}

/** About 200 words a minute, at least one minute. */
export function readMinutes(source: string): number {
  const words = source.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined) {
      const href = m[2];
      if (SAFE_URL.test(href)) {
        const external = /^https?:\/\//i.test(href);
        out.push(
          <a key={key} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="font-medium text-accent-ink underline decoration-accent-ink/30 underline-offset-2 hover:decoration-accent-ink">
            {m[1]}
          </a>,
        );
      } else out.push(m[1]);
    } else if (m[3] !== undefined) out.push(<strong key={key} className="font-semibold text-ink">{m[3]}</strong>);
    else out.push(<em key={key}>{m[4] ?? m[5]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ArticleBody({ source, className = '' }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).filter((b) => b.trim());

  return (
    <div className={`space-y-5 text-[1.02rem] leading-[1.75] text-ink/85 ${className}`}>
      {blocks.map((raw, i) => {
        const block = raw.trim();
        const lines = block.split('\n').map((l) => l.trim());
        const key = `b${i}`;

        if (/^###\s+/.test(block)) {
          const text = block.replace(/^###\s+/, '');
          return <h3 key={key} id={headingId(text)} className="scroll-mt-28 pt-2 text-lg font-semibold leading-snug text-ink">{inline(text, key)}</h3>;
        }
        if (/^##\s+/.test(block)) {
          const text = block.replace(/^##\s+/, '');
          return <h2 key={key} id={headingId(text)} className="scroll-mt-28 pt-4 font-serif text-[1.45rem] font-bold leading-tight tracking-[-0.01em] text-ink">{inline(text, key)}</h2>;
        }
        if (/^-{3,}$/.test(block)) return <hr key={key} className="border-line" />;

        const image = block.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/);
        if (image && SAFE_URL.test(image[2])) {
          return (
            <figure key={key} className="my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image[2]} alt={image[1]} loading="lazy" className="w-full rounded-2xl border border-line object-cover" />
              {(image[3] || image[1]) && <figcaption className="mt-2 text-center text-sm text-ink-muted">{image[3] || image[1]}</figcaption>}
            </figure>
          );
        }
        if (lines.every((l) => /^>\s?/.test(l))) {
          return (
            <blockquote key={key} className="rounded-r-2xl border-l-4 border-accent bg-surface-2/60 px-5 py-3 font-medium text-ink">
              {inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '), key)}
            </blockquote>
          );
        }
        if (lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-5 marker:text-accent-ink">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^[-*]\s+/, ''), `${key}-${j}`)}</li>)}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
          return (
            <ol key={key} className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-accent-ink">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+[.)]\s+/, ''), `${key}-${j}`)}</li>)}
            </ol>
          );
        }
        return <p key={key}>{inline(lines.join(' '), key)}</p>;
      })}
    </div>
  );
}
