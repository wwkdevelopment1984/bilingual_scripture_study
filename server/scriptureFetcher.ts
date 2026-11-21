import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { BOOK_CATALOG, type CatalogBook } from '../src/data/scriptureCatalog.ts';
import type {
  AlignedVerse,
  BilingualChapterResponse,
  FootnotePart,
  ScriptureFootnote,
  VerseSegment,
} from '../src/types/scripture.ts';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface ParsedLanguageChapter {
  verses: Map<number, string>;
  segments: Map<number, VerseSegment[]>;
  footnotes: Record<string, ScriptureFootnote>;
  summary: string;
  intro: string;
  source: string;
}

interface CacheEntry {
  expiresAt: number;
  data: BilingualChapterResponse;
}

const chapterCache = new Map<string, CacheEntry>();

function normalizeWhitespace(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeChineseWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInlineChunk(text: string, isChinese: boolean): string {
  const cleaned = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  return isChinese ? cleaned.replace(/\u3000/g, ' ') : cleaned;
}

function extractVerseSegments(
  $: CheerioAPI,
  verseRoot: AnyNode,
  isChinese: boolean
): VerseSegment[] {
  const segments: VerseSegment[] = [];

  const pushText = (raw: string) => {
    const normalized = normalizeInlineChunk(raw, isChinese);
    if (!normalized) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.type === 'text') {
      prev.text = `${prev.text}${normalized}`.replace(/\s+/g, ' ');
    } else {
      segments.push({ type: 'text', text: normalized });
    }
  };

  const walk = (node: AnyNode) => {
    if (node.type === 'text') {
      pushText(node.data || '');
      return;
    }
    if (node.type !== 'tag') return;

    const el = $(node);
    if (el.is('.verse-number, button, [data-pointer-type="media"], [class*="iconPointer"]')) {
      return;
    }
    if (el.is('a.study-note-ref')) {
      const href = el.attr('href') || '';
      const hashId = href.includes('#') ? href.split('#')[1] : '';
      const noteId = el.attr('data-scroll-id') || hashId;
      const marker =
        el.find('sup.marker').attr('data-value') || el.find('sup').text().trim();
      const clone = el.clone();
      clone.find('sup').remove();
      const wordText = normalizeInlineChunk(clone.text(), isChinese);
      if (wordText || marker) {
        segments.push({
          type: 'note',
          text: wordText,
          marker: marker || undefined,
          noteId: noteId || undefined,
        });
      }
      return;
    }
    if (el.is('sup')) {
      return;
    }

    el.contents().each((_, child) => {
      walk(child);
    });
  };

  $(verseRoot)
    .contents()
    .each((_, child) => {
      walk(child);
    });

  if (segments.length > 0 && segments[0].type === 'text') {
    segments[0].text = segments[0].text.replace(/^\s+/, '');
    if (!segments[0].text) segments.shift();
  }
  if (segments.length > 0 && segments[segments.length - 1].type === 'text') {
    segments[segments.length - 1].text = segments[segments.length - 1].text.replace(/\s+$/, '');
    if (!segments[segments.length - 1].text) segments.pop();
  }

  return segments;
}

function parseScriptureHref(
  href: string
): { book: string; chapter: number; verse: number | null } | null {
  const match = href.match(
    /\/study\/scriptures\/(ot|nt|bofm|dc-testament|pgp)\/([^/?#]+)\/(\d+)/
  );
  if (!match) return null;
  const slug = match[2];
  const chapterNum = parseInt(match[3], 10);
  const bookMeta = BOOK_CATALOG[slug];
  if (!bookMeta || !Number.isInteger(chapterNum) || chapterNum < 1 || chapterNum > bookMeta.chapters) {
    return null;
  }

  let verseNum: number | null = null;
  const hashMatch = href.match(/#p(\d+)/);
  if (hashMatch) {
    verseNum = parseInt(hashMatch[1], 10);
  } else {
    const idParamMatch = href.match(/[?&]id=p(\d+)/);
    if (idParamMatch) {
      verseNum = parseInt(idParamMatch[1], 10);
    }
  }

  return {
    book: bookMeta.key,
    chapter: chapterNum,
    verse: verseNum && verseNum > 0 ? verseNum : null,
  };
}

function extractFootnotes(
  $: CheerioAPI,
  isChinese: boolean
): Record<string, ScriptureFootnote> {
  const map: Record<string, ScriptureFootnote> = {};

  $('.study-notes li[id^="note"]').each((_, li) => {
    const el = $(li);
    const id = el.attr('id') || '';
    if (!id || id === 'note') return;

    const marker = el.attr('data-marker') || '';
    const fullMarker = el.attr('data-full-marker') || '';
    const verseMatch = id.match(/^note(\d+)_/) || fullMarker.match(/^(\d+)/);
    const verse = verseMatch ? parseInt(verseMatch[1], 10) : 0;

    const parts: FootnotePart[] = [];
    const pushText = (raw: string) => {
      const normalized = normalizeInlineChunk(raw, isChinese);
      if (!normalized) return;
      const prev = parts[parts.length - 1];
      if (prev && prev.type === 'text') {
        prev.text = `${prev.text}${normalized}`.replace(/\s+/g, ' ');
      } else {
        parts.push({ type: 'text', text: normalized });
      }
    };

    const walk = (node: AnyNode) => {
      if (node.type === 'text') {
        pushText(node.data || '');
        return;
      }
      if (node.type !== 'tag') return;

      const nodeEl = $(node);
      if (nodeEl.is('a')) {
        const href = nodeEl.attr('href') || '';
        const text = isChinese
          ? normalizeChineseWhitespace(nodeEl.text())
          : normalizeWhitespace(nodeEl.text());
        if (!text) return;

        const internalTarget = parseScriptureHref(href);
        if (internalTarget) {
          parts.push({
            type: 'ref',
            text,
            book: internalTarget.book,
            chapter: internalTarget.chapter,
            verse: internalTarget.verse,
          });
        } else if (href) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.churchofjesuschrist.org${href.startsWith('/') ? '' : '/'}${href}`;
          parts.push({
            type: 'external',
            text,
            url: fullUrl,
          });
        } else {
          pushText(text);
        }
        return;
      }

      nodeEl.contents().each((_, child) => {
        walk(child);
      });
    };

    const paragraphs = el.find('p');
    if (paragraphs.length > 0) {
      paragraphs.each((pIdx, pEl) => {
        if (pIdx > 0) pushText(' ');
        $(pEl)
          .contents()
          .each((_, child) => {
            walk(child);
          });
      });
    } else {
      el.contents().each((_, child) => {
        walk(child);
      });
    }

    if (parts.length > 0 && parts[0].type === 'text') {
      parts[0].text = parts[0].text.replace(/^\s+/, '');
      if (!parts[0].text) parts.shift();
    }
    if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
      parts[parts.length - 1].text = parts[parts.length - 1].text.replace(/\s+$/, '');
      if (!parts[parts.length - 1].text) parts.pop();
    }

    if (parts.length > 0) {
      map[id] = {
        id,
        marker: marker || id.split('_')[1] || '',
        fullMarker: fullMarker || `${verse}${marker}`,
        verse,
        parts,
      };
    }
  });

  return map;
}

function parseChurchOfJesusChristHtml(
  html: string,
  lang: 'eng' | 'zho'
): ParsedLanguageChapter {
  const $ = load(html);
  const isChinese = lang === 'zho';
  const verses = new Map<number, string>();
  const segments = new Map<number, VerseSegment[]>();

  const summaryEl = $('.study-summary').first().clone();
  summaryEl.find('sup, button, [class*="iconPointer"]').remove();
  const rawSummary = summaryEl.text();
  const summary = isChinese
    ? normalizeChineseWhitespace(rawSummary)
    : normalizeWhitespace(rawSummary);

  const introEl = $('.study-intro').first().clone();
  introEl.find('sup, button, [class*="iconPointer"]').remove();
  const rawIntro = introEl.text();
  const intro = isChinese
    ? normalizeChineseWhitespace(rawIntro)
    : normalizeWhitespace(rawIntro);

  $('p.verse').each((idx, el) => {
    const verseEl = $(el).clone();
    const numText = verseEl.find('.verse-number').first().text().trim();
    const parsedNum = parseInt(numText.replace(/[^\d]/g, ''), 10);
    const verseNumber = Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : idx + 1;

    const inlineSegments = extractVerseSegments($, verseEl[0], isChinese);

    // Remove footnote markers, verse numbers, and media buttons while preserving text inside .study-note-ref
    verseEl
      .find('sup, .verse-number, button, [data-pointer-type="media"], [class*="iconPointer"]')
      .remove();

    const cleaned = isChinese
      ? normalizeChineseWhitespace(verseEl.text())
      : normalizeWhitespace(verseEl.text());

    if (cleaned) {
      const existing = verses.get(verseNumber);
      verses.set(verseNumber, existing ? `${existing} ${cleaned}` : cleaned);

      const existingSegs = segments.get(verseNumber);
      if (existingSegs && inlineSegments.length > 0) {
        segments.set(verseNumber, [
          ...existingSegs,
          { type: 'text', text: ' ' },
          ...inlineSegments,
        ]);
      } else if (inlineSegments.length > 0) {
        segments.set(verseNumber, inlineSegments);
      }
    }
  });

  if (verses.size === 0) {
    throw new Error(`No verses found in ChurchofJesusChrist.org response (${lang})`);
  }

  const footnotes = extractFootnotes($, isChinese);

  return {
    verses,
    segments,
    footnotes,
    summary,
    intro,
    source: 'ChurchofJesusChrist.org',
  };
}

async function fetchChurchOfJesusChrist(
  bookMeta: CatalogBook,
  chapter: number,
  lang: 'eng' | 'zho'
): Promise<ParsedLanguageChapter> {
  const url = `https://www.churchofjesuschrist.org/study/scriptures/${bookMeta.volume}/${bookMeta.slug}/${chapter}?lang=${lang}&platform=web`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': lang === 'zho' ? 'zh-TW,zh;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`ChurchofJesusChrist.org HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseChurchOfJesusChristHtml(html, lang);
}

function parseBibleComHtml(html: string): ParsedLanguageChapter {
  const $ = load(html);
  const verses = new Map<number, string>();

  const verseNodes = $('[data-usfm]');
  verseNodes.each((_, el) => {
    const usfmAttr = $(el).attr('data-usfm') || '';
    const match = usfmAttr.match(/\.(\d+)$/);
    if (!match) return;
    const verseNum = parseInt(match[1], 10);
    if (!Number.isFinite(verseNum) || verseNum <= 0) return;

    const clone = $(el).clone();
    clone
      .find(
        '[class*="label"], [class*="note"], sup, button, [data-testid="verse-number"]'
      )
      .remove();
    const text = normalizeChineseWhitespace(clone.text());
    if (text) {
      const existing = verses.get(verseNum);
      verses.set(verseNum, existing ? `${existing}${text}` : text);
    }
  });

  if (verses.size === 0) {
    throw new Error('Could not extract verses from bible.com HTML');
  }

  return {
    verses,
    segments: new Map(),
    footnotes: {},
    summary: '',
    intro: '',
    source: 'YouVersion (CUNP)',
  };
}

interface BollsVerseItem {
  pk?: number;
  verse: number;
  text: string;
}

async function fetchBollsCunp(
  bibleBookId: number,
  chapter: number
): Promise<ParsedLanguageChapter> {
  const url = `https://bolls.life/get-text/CUNP/${bibleBookId}/${chapter}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Bolls CUNP API HTTP ${res.status}`);
  }

  const items = (await res.json()) as BollsVerseItem[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Bolls CUNP API returned no verses');
  }

  const verses = new Map<number, string>();
  for (const item of items) {
    if (!item || typeof item.verse !== 'number' || typeof item.text !== 'string') {
      continue;
    }
    const $ = load(`<div>${item.text}</div>`);
    $('sup').remove();
    $('br').replaceWith(' ');
    const cleaned = normalizeChineseWhitespace($('div').text());
    if (cleaned) {
      verses.set(item.verse, cleaned);
    }
  }

  if (verses.size === 0) {
    throw new Error('Bolls CUNP API contained no readable verses');
  }

  return {
    verses,
    segments: new Map(),
    footnotes: {},
    summary: '',
    intro: '',
    source: 'CUNP (Bolls)',
  };
}

async function translateTextToTraditionalChinese(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return '';
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || !Array.isArray(json[0])) return '';

    const translated = (json[0] as unknown[])
      .map((part) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''))
      .join('')
      .replace(/上帝/g, '神')
      .trim();

    return translated;
  } catch {
    return '';
  }
}

async function fetchBibleChineseCunp(
  bookMeta: CatalogBook,
  chapter: number
): Promise<ParsedLanguageChapter> {
  let bibleComError = '';

  if (bookMeta.usfm) {
    try {
      const url = `https://www.bible.com/bible/46/${bookMeta.usfm}.${chapter}.CUNP`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const html = await res.text();
        return parseBibleComHtml(html);
      }
      bibleComError = `bible.com HTTP ${res.status}`;
    } catch (err) {
      bibleComError = err instanceof Error ? err.message : 'bible.com fetch failed';
    }
  }

  if (bookMeta.bibleBookId !== null) {
    try {
      return await fetchBollsCunp(bookMeta.bibleBookId, chapter);
    } catch (fallbackErr) {
      const fallbackMsg =
        fallbackErr instanceof Error ? fallbackErr.message : 'Bolls fallback failed';
      throw new Error(
        bibleComError ? `${bibleComError}; ${fallbackMsg}` : fallbackMsg
      );
    }
  }

  throw new Error(bibleComError || 'No Chinese Bible source configured');
}

export class ScriptureFetchError extends Error {
  statusCode: number;
  retryable: boolean;
  details?: { en?: string; zh?: string };

  constructor(
    message: string,
    statusCode = 502,
    retryable = true,
    details?: { en?: string; zh?: string }
  ) {
    super(message);
    this.name = 'ScriptureFetchError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

export async function getBilingualChapter({
  book,
  chapter,
  bypassCache = false,
}: {
  book: string;
  chapter: number | string;
  bypassCache?: boolean;
}): Promise<BilingualChapterResponse> {
  const bookKey = String(book || '').trim().toLowerCase();
  const bookMeta = BOOK_CATALOG[bookKey];
  if (!bookMeta) {
    throw new ScriptureFetchError(`Unknown scripture book: "${book}"`, 400, false);
  }

  const chapterNum = Number(chapter);
  if (
    !Number.isInteger(chapterNum) ||
    chapterNum < 1 ||
    chapterNum > bookMeta.chapters
  ) {
    throw new ScriptureFetchError(
      `Invalid chapter ${chapter} for ${bookMeta.en} (1–${bookMeta.chapters})`,
      400,
      false
    );
  }

  const cacheKey = `${bookMeta.key}:${chapterNum}`;
  if (!bypassCache) {
    const cached = chapterCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.data,
        cached: true,
      };
    }
  }

  const isBible = bookMeta.volume === 'ot' || bookMeta.volume === 'nt';

  const [enResult, zhResult] = await Promise.allSettled([
    fetchChurchOfJesusChrist(bookMeta, chapterNum, 'eng'),
    isBible
      ? fetchBibleChineseCunp(bookMeta, chapterNum)
      : fetchChurchOfJesusChrist(bookMeta, chapterNum, 'zho'),
  ]);

  const enData = enResult.status === 'fulfilled' ? enResult.value : null;
  const zhData = zhResult.status === 'fulfilled' ? zhResult.value : null;

  const enError =
    enResult.status === 'rejected'
      ? enResult.reason instanceof Error
        ? enResult.reason.message
        : 'Failed to load English text'
      : undefined;
  const zhError =
    zhResult.status === 'rejected'
      ? zhResult.reason instanceof Error
        ? zhResult.reason.message
        : 'Failed to load Chinese text'
      : undefined;

  if (!enData && !zhData) {
    throw new ScriptureFetchError(
      `Unable to load ${bookMeta.en} ${chapterNum} from scripture sources.`,
      502,
      true,
      { en: enError, zh: zhError }
    );
  }

  const verseNumbers = new Set<number>();
  if (enData) {
    for (const v of enData.verses.keys()) verseNumbers.add(v);
  }
  if (zhData) {
    for (const v of zhData.verses.keys()) verseNumbers.add(v);
  }

  const sortedVerses = Array.from(verseNumbers).sort((a, b) => a - b);
  const verses: AlignedVerse[] = sortedVerses.map((v) => {
    const enSegs = enData?.segments.get(v);
    const zhSegs = zhData?.segments.get(v);
    return {
      verse: v,
      en: enData?.verses.get(v) ?? '',
      zh: zhData?.verses.get(v) ?? '',
      ...(enSegs && enSegs.length > 0 ? { enSegments: enSegs } : {}),
      ...(zhSegs && zhSegs.length > 0 ? { zhSegments: zhSegs } : {}),
    };
  });

  let zhSummary = zhData?.summary ?? '';
  let zhSummaryTranslated = false;

  if (isBible && enData?.summary && !zhSummary) {
    const translated = await translateTextToTraditionalChinese(enData.summary);
    if (translated) {
      zhSummary = translated;
      zhSummaryTranslated = true;
    }
  }

  const enIntro = enData?.intro ?? '';
  const zhIntro = zhData?.intro ?? '';

  const payload: BilingualChapterResponse = {
    book: bookMeta.key,
    volume: bookMeta.volume,
    chapter: chapterNum,
    bookTitle: {
      en: bookMeta.en,
      zh: bookMeta.zh,
    },
    volumeTitle: {
      en: bookMeta.volumeEn,
      zh: bookMeta.volumeZh,
    },
    summary: {
      en: enData?.summary ?? '',
      zh: zhSummary,
    },
    ...(enIntro || zhIntro
      ? {
          intro: {
            en: enIntro,
            zh: zhIntro,
          },
        }
      : {}),
    ...(zhSummaryTranslated
      ? {
          summaryTranslated: {
            zh: true,
          },
        }
      : {}),
    verses,
    footnotes: {
      en: enData?.footnotes ?? {},
      zh: zhData?.footnotes ?? {},
    },
    sources: {
      en: enData?.source ?? null,
      zh: zhData?.source ?? null,
    },
    partial: {
      enMissing: !enData,
      zhMissing: !zhData,
    },
    errors: {
      ...(enError ? { en: enError } : {}),
      ...(zhError ? { zh: zhError } : {}),
    },
    cached: false,
    fetchedAt: new Date().toISOString(),
  };

  if (enData && zhData && verses.length > 0) {
    chapterCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: payload,
    });
  }

  return payload;
}
