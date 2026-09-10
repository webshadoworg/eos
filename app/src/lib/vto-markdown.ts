// Render the V/TO (vision + traction + SWOT JSONB payloads) as a Markdown document.
// Mirrors the section order and labels used by VtoEditor.svelte so the download
// reads like the page. Empty fields are skipped rather than rendered blank.

type Pair = { name?: string; description?: string };
type Measurable = { name?: string; value?: unknown };

function has(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.some(has);
  if (typeof v === 'object') return Object.values(v as object).some(has);
  return String(v).trim() !== '';
}

// Same rules as VtoEditor's fmtMoney: numbers and numeric strings become USD,
// shorthand like "2.5 mil" passes through with a $ prefix.
function fmtMoney(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number') return '$' + Math.round(raw).toLocaleString('en-US');
  const s = String(raw).trim();
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isNaN(n) && cleaned !== '') return '$' + Math.round(n).toLocaleString('en-US');
  return s.startsWith('$') ? s : '$' + s;
}

// 'YYYY-MM-DD' → 'December 31, 2028'. Anything else passes through unchanged.
function fmtDate(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// Escape the pipes that would otherwise break a Markdown table cell.
const cell = (v: unknown) => String(v ?? '').trim().replace(/\|/g, '\\|');

export function vtoToMarkdown(
  vision: any = {},
  traction: any = {},
  swot: any = {},
  opts: { title?: string; exportedAt?: Date } = {},
): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const blank = () => {
    if (out.length && out[out.length - 1] !== '') out.push('');
  };

  const field = (label: string, value: unknown, fmt: (v: unknown) => string = String) => {
    if (!has(value)) return;
    push(`**${label}:** ${fmt(value).trim()}`, '');
  };

  const bullets = (heading: string, items: unknown) => {
    const list = (Array.isArray(items) ? items : []).filter(has);
    if (!list.length) return;
    push(`**${heading}**`, '');
    for (const item of list) push(`- ${String(item).trim()}`);
    push('');
  };

  const pairs = (heading: string, items: unknown) => {
    const list = (Array.isArray(items) ? items : []).filter(has) as Pair[];
    if (!list.length) return;
    push(`**${heading}**`, '');
    for (const p of list) {
      const name = (p.name ?? '').trim();
      const desc = (p.description ?? '').trim();
      push(`- ${name && desc ? `**${name}** — ${desc}` : `${name}${desc}`}`);
    }
    push('');
  };

  const measurables = (items: unknown) => {
    const list = (Array.isArray(items) ? items : []).filter(has) as Measurable[];
    if (!list.length) return;
    push('| Measurable | Target |', '| --- | --- |');
    for (const m of list) push(`| ${cell(m.name)} | ${cell(m.value) || '—'} |`);
    push('');
  };

  const plan = (heading: string, p: any, listHeading?: string, listKey?: string) => {
    if (!has(p)) return;
    push(`### ${heading}`, '');
    field('Future date', p?.future_date, fmtDate);
    field('Budget', p?.revenue?.budget, fmtMoney);
    field('Profit', p?.revenue?.profit, fmtMoney);
    measurables(p?.measurables);
    if (listHeading && listKey) bullets(listHeading, p?.[listKey]);
  };

  const exportedAt = opts.exportedAt ?? new Date();
  push(`# ${opts.title ?? 'Vision/Traction Organizer'}`, '');
  push(
    `_Exported ${exportedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}_`,
    '',
  );

  // ---- Vision
  if (has(vision)) {
    push('## Vision', '');
    pairs('Core Values', vision?.core_values);

    if (has(vision?.core_focus)) {
      push('### Core Focus', '');
      field('Purpose', vision.core_focus?.purpose);
      field('Niche', vision.core_focus?.niche);
    }

    if (has(vision?.ten_year_target)) {
      push('### 10 Year Target', '');
      for (const t of (vision.ten_year_target as unknown[]).filter(has)) push(`- ${String(t).trim()}`);
      push('');
    }

    if (has(vision?.marketing)) {
      push('### Marketing Strategy', '');
      field('Target Market', vision.marketing?.target_market);
      pairs('Three Uniques', vision.marketing?.uniques);
      field('Proven Process', vision.marketing?.proven_process);
      field('System Promise', vision.marketing?.system_promise);
    }

    plan('3 Year Goal', vision?.three_year, 'What does it look like?', 'looks_like');
  }

  // ---- Traction
  if (has(traction)) {
    blank();
    push('## Traction', '');
    plan('1 Year Plan', traction?.one_year, 'Goals for the Year', 'goals');
    plan('90 Day Plan', traction?.ninety_day);
  }

  // ---- SWOT
  if (has(swot)) {
    blank();
    push('## SWOT', '');
    bullets('Strengths', swot?.strengths);
    bullets('Weaknesses', swot?.weaknesses);
    bullets('Opportunities', swot?.opportunities);
    bullets('Threats', swot?.threats);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
