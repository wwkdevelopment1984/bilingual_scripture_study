import { load } from 'cheerio';
import {
  ALL_BOOKS,
  BOOK_CATALOG,
  type CatalogBook,
  type VolumeId,
} from '../src/data/scriptureCatalog.ts';
import type {
  ScriptureSearchResponse,
  ScriptureSearchResult,
  SearchVolumeFilter,
} from '../src/types/scripture.ts';

const SEARCH_TIMEOUT_MS = 12000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const VOLUME_TO_COLLECTION: Record<SearchVolumeFilter, string> = {
  all: '*',
  ot: 'Old Testament',
  nt: 'New Testament',
  bofm: 'Book of Mormon',
  'dc-testament': 'Doctrine and Covenants',
  pgp: 'Pearl of Great Price',
};

const BOOK_BY_BIBLE_ID = new Map<number, CatalogBook>(
  ALL_BOOKS.filter((b) => b.bibleBookId !== null).map((b) => [b.bibleBookId!, b])
);

const searchCache = new Map<
  string,
  { expiresAt: number; data: ScriptureSearchResponse }
>();

function containsCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function normalizeSearchQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function tryMatchDirectReference(
  query: string,
  volumeFilter: SearchVolumeFilter
): ScriptureSearchResult | null {
  const cleaned = query.trim();
  const refMatch = cleaned.match(/^(.+?)\s*(\d+)(?:\s*[:：]\s*(\d+))?$/);
  if (!refMatch) return null;

  const bookQuery = refMatch[1].trim().toLowerCase();
  const chapterNum = parseInt(refMatch[2], 10);
  const verseNum = refMatch[3] ? parseInt(refMatch[3], 10) : null;

  if (!Number.isInteger(chapterNum) || chapterNum < 1) return null;

  const matchedBook = ALL_BOOKS.find((b) => {
    const enNorm = b.en.toLowerCase();
    const zhNorm = b.zh.toLowerCase();
    const keyNorm = b.key.toLowerCase();
    return (
      enNorm === bookQuery ||
      zhNorm === bookQuery ||
      keyNorm === bookQuery ||
      (b.key === 'dc' &&
        (bookQuery === 'd&c' ||
          bookQuery === 'doctrine and covenants' ||
          bookQuery === '教義和聖約')) ||
      (b.key === 'ps' && bookQuery === 'psalm')
    );
  });

  if (!matchedBook || chapterNum > matchedBook.chapters) return null;
  if (volumeFilter !== 'all' && matchedBook.volume !== volumeFilter) return null;

  return {
    id: `direct:${matchedBook.key}:${chapterNum}:${verseNum ?? 0}`,
    book: matchedBook.key,
    volume: matchedBook.volume,
    chapter: chapterNum,
    verse: verseNum && verseNum > 0 ? verseNum : null,
    bookTitle: { en: matchedBook.en, zh: matchedBook.zh },
    volumeTitle: { en: matchedBook.volumeEn, zh: matchedBook.volumeZh },
    snippet: verseNum
      ? `Jump directly to ${matchedBook.en} ${chapterNum}:${verseNum} · ${matchedBook.zh} ${chapterNum}:${verseNum}`
      : `Jump directly to ${matchedBook.en} ${chapterNum} · ${matchedBook.zh} ${chapterNum}`,
    matchedLang: containsCjk(query) ? 'zh' : 'en',
    source: 'Direct Reference',
    isDirectReference: true,
  };
}

interface VertexResultItem {
  id?: string;
  document?: {
    structData?: {
      fields?: {
        reference?: { stringValue?: string };
        book?: { stringValue?: string };
        chapter?: { stringValue?: string };
        verse_id?: { stringValue?: string };
        standard_work?: { stringValue?: string };
        verse_text?: { stringValue?: string };
        deep_link?: { stringValue?: string };
      };
    };
  };
}

async function searchEnglishVertex(
  query: string,
  volumeFilter: SearchVolumeFilter,
  page: number,
  pageSize: number
): Promise<{ results: ScriptureSearchResult[]; totalSize: number }> {
  const collectionName = VOLUME_TO_COLLECTION[volumeFilter] || '*';
  const start = (page - 1) * pageSize + 1;
  const url = `https://www.churchofjesuschrist.org/search/proxy/vertex-scripture-search?query=${encodeURIComponent(
    query
  )}&collectionName=${encodeURIComponent(
    collectionName
  )}&bookTitle=*&start=${start}&pageSize=${pageSize}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Scripture search HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    error?: string;
    totalSize?: number;
    results?: VertexResultItem[];
  };

  if (json.error) {
    throw new Error(json.error);
  }

  const parsed: ScriptureSearchResult[] = [];
  for (const item of json.results ?? []) {
    const fields = item.document?.structData?.fields;
    if (!fields) continue;

    const deepLink = fields.deep_link?.stringValue || '';
    const linkMatch = deepLink.match(
      /\/study\/scriptures\/(ot|nt|bofm|dc-testament|pgp)\/([^/?#]+)\/(\d+)/
    );
    if (!linkMatch) continue;

    const slug = linkMatch[2];
    const chapterNum = parseInt(linkMatch[3], 10);
    const bookMeta = BOOK_CATALOG[slug];
    if (!bookMeta || !Number.isInteger(chapterNum) || chapterNum < 1) continue;

    let verseNum: number | null = null;
    const verseId = fields.verse_id?.stringValue || '';
    const idMatch = verseId.match(/^p(\d+)$/);
    if (idMatch) {
      verseNum = parseInt(idMatch[1], 10);
    } else if (fields.reference?.stringValue) {
      const refColon = fields.reference.stringValue.match(/:(\d+)$/);
      if (refColon) verseNum = parseInt(refColon[1], 10);
    }

    const snippet = (fields.verse_text?.stringValue || '').replace(/\s+/g, ' ').trim();
    if (!snippet) continue;

    parsed.push({
      id: item.id || `${bookMeta.key}:${chapterNum}:${verseNum ?? 0}`,
      book: bookMeta.key,
      volume: bookMeta.volume,
      chapter: chapterNum,
      verse: verseNum,
      bookTitle: { en: bookMeta.en, zh: bookMeta.zh },
      volumeTitle: { en: bookMeta.volumeEn, zh: bookMeta.volumeZh },
      snippet,
      matchedLang: 'en',
      source: 'ChurchofJesusChrist.org',
    });
  }

  return {
    results: parsed,
    totalSize: typeof json.totalSize === 'number' ? json.totalSize : parsed.length,
  };
}

interface BollsFindItem {
  pk?: number;
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

async function searchBollsCunp(
  query: string,
  volumeFilter: SearchVolumeFilter,
  limit: number
): Promise<ScriptureSearchResult[]> {
  const url = `https://bolls.life/find/CUNP/?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Bolls CUNP search HTTP ${res.status}`);
  }

  const items = (await res.json()) as BollsFindItem[];
  if (!Array.isArray(items)) return [];

  const results: ScriptureSearchResult[] = [];
  for (const item of items) {
    const bookMeta = BOOK_BY_BIBLE_ID.get(item.book);
    if (!bookMeta) continue;
    if (volumeFilter !== 'all' && bookMeta.volume !== volumeFilter) continue;

    const $ = load(`<div>${item.text}</div>`);
    $('sup').remove();
    $('br').replaceWith(' ');
    const snippet = $('div').text().replace(/\s+/g, ' ').trim();
    if (!snippet) continue;

    results.push({
      id: `bolls:${bookMeta.key}:${item.chapter}:${item.verse}`,
      book: bookMeta.key,
      volume: bookMeta.volume,
      chapter: item.chapter,
      verse: item.verse,
      bookTitle: { en: bookMeta.en, zh: bookMeta.zh },
      volumeTitle: { en: bookMeta.volumeEn, zh: bookMeta.volumeZh },
      snippet,
      matchedLang: 'zh',
      source: 'CUNP (Bolls)',
    });

    if (results.length >= limit) break;
  }

  return results;
}

interface ProxySearchResultItem {
  id?: string;
  document?: {
    derivedStructData?: {
      fields?: {
        link?: { stringValue?: string };
        title?: { stringValue?: string };
        snippets?: {
          listValue?: {
            values?: Array<{
              structValue?: {
                fields?: {
                  snippet?: { stringValue?: string };
                };
              };
            }>;
          };
        };
      };
    };
  };
}

async function searchChurchZhoChapters(
  query: string,
  volumeFilter: SearchVolumeFilter,
  pageSize: number
): Promise<ScriptureSearchResult[]> {
  const url = `https://www.churchofjesuschrist.org/search/proxy/search?query=${encodeURIComponent(
    query
  )}&lang=zho&facet=scriptures&page=1&size=${Math.max(20, pageSize * 2)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`ChurchofJesusChrist.org Chinese search HTTP ${res.status}`);
  }

  const json = (await res.json()) as { results?: ProxySearchResultItem[] };
  const parsed: ScriptureSearchResult[] = [];

  for (const item of json.results ?? []) {
    const fields = item.document?.derivedStructData?.fields;
    if (!fields) continue;
    const link = fields.link?.stringValue || '';
    const linkMatch = link.match(
      /\/study\/scriptures\/(ot|nt|bofm|dc-testament|pgp)\/([^/?#]+)\/(\d+)/
    );
    if (!linkMatch) continue;

    const vol = linkMatch[1] as VolumeId;
    const slug = linkMatch[2];
    const chapterNum = parseInt(linkMatch[3], 10);
    const bookMeta = BOOK_CATALOG[slug];
    if (!bookMeta || !Number.isInteger(chapterNum) || chapterNum < 1) continue;
    if (volumeFilter !== 'all' && vol !== volumeFilter) continue;

    const rawSnippet =
      fields.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet
        ?.stringValue || '';
    const $ = load(`<div>${rawSnippet}</div>`);
    const snippet = $('div').text().replace(/\s+/g, ' ').trim();
    if (!snippet) continue;

    // Try extracting leading verse number if snippet begins with digits before Chinese text
    const verseMatch = snippet.match(/(?:^|\.\s+)(\d{1,3})\s+[\u4e00-\u9fff]/);
    const verseNum = verseMatch ? parseInt(verseMatch[1], 10) : null;

    parsed.push({
      id: `lds-zh:${bookMeta.key}:${chapterNum}:${verseNum ?? 0}`,
      book: bookMeta.key,
      volume: bookMeta.volume,
      chapter: chapterNum,
      verse: verseNum,
      bookTitle: { en: bookMeta.en, zh: bookMeta.zh },
      volumeTitle: { en: bookMeta.volumeEn, zh: bookMeta.volumeZh },
      snippet,
      matchedLang: 'zh',
      source: 'ChurchofJesusChrist.org',
    });

    if (parsed.length >= pageSize) break;
  }

  return parsed;
}

export async function searchScriptures({
  query,
  volume = 'all',
  page = 1,
  pageSize = 15,
}: {
  query: string;
  volume?: SearchVolumeFilter;
  page?: number;
  pageSize?: number;
}): Promise<ScriptureSearchResponse> {
  const normalizedQuery = normalizeSearchQuery(query);
  const validPage = Number.isInteger(page) && page >= 1 ? page : 1;
  const validPageSize =
    Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 30 ? pageSize : 15;
  const validVolume: SearchVolumeFilter =
    volume in VOLUME_TO_COLLECTION ? volume : 'all';

  if (!normalizedQuery) {
    return {
      query: '',
      volume: validVolume,
      page: validPage,
      pageSize: validPageSize,
      totalEstimate: 0,
      hasMore: false,
      results: [],
    };
  }

  const cacheKey = `${validVolume}:${validPage}:${validPageSize}:${normalizedQuery}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const directHit =
    validPage === 1 ? tryMatchDirectReference(normalizedQuery, validVolume) : null;

  const isCjk = containsCjk(normalizedQuery);
  let results: ScriptureSearchResult[] = [];
  let totalEstimate = 0;
  let hasMore = false;

  if (!isCjk) {
    const vertexData = await searchEnglishVertex(
      normalizedQuery,
      validVolume,
      validPage,
      validPageSize
    );
    results = vertexData.results;
    totalEstimate = vertexData.totalSize;
    hasMore = validPage * validPageSize < totalEstimate && results.length === validPageSize;
  } else {
    const wantsBible =
      validVolume === 'all' || validVolume === 'ot' || validVolume === 'nt';
    const wantsRestoration =
      validVolume === 'all' ||
      validVolume === 'bofm' ||
      validVolume === 'dc-testament' ||
      validVolume === 'pgp';

    const [bollsRes, ldsRes] = await Promise.allSettled([
      wantsBible
        ? searchBollsCunp(normalizedQuery, validVolume, validPage * validPageSize)
        : Promise.resolve([]),
      wantsRestoration
        ? searchChurchZhoChapters(
            normalizedQuery,
            validVolume,
            validPage * validPageSize
          )
        : Promise.resolve([]),
    ]);

    const bollsHits = bollsRes.status === 'fulfilled' ? bollsRes.value : [];
    const ldsHits = ldsRes.status === 'fulfilled' ? ldsRes.value : [];

    // Interleave Restoration and Bible hits when searching all volumes so both appear prominently
    const merged: ScriptureSearchResult[] = [];
    const maxLen = Math.max(bollsHits.length, ldsHits.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < bollsHits.length) merged.push(bollsHits[i]);
      if (i < ldsHits.length) merged.push(ldsHits[i]);
    }

    const deduped = new Map<string, ScriptureSearchResult>();
    for (const r of merged) {
      const key = `${r.book}:${r.chapter}:${r.verse ?? 0}`;
      if (!deduped.has(key)) deduped.set(key, r);
    }

    const allMerged = Array.from(deduped.values());
    const offset = (validPage - 1) * validPageSize;
    results = allMerged.slice(offset, offset + validPageSize);
    totalEstimate = allMerged.length;
    hasMore = offset + validPageSize < allMerged.length;
  }

  if (directHit) {
    const filtered = results.filter(
      (r) =>
        !(
          r.book === directHit.book &&
          r.chapter === directHit.chapter &&
          (directHit.verse === null || r.verse === directHit.verse)
        )
    );
    results = [directHit, ...filtered];
    totalEstimate = Math.max(totalEstimate, results.length);
  }

  const response: ScriptureSearchResponse = {
    query: normalizedQuery,
    volume: validVolume,
    page: validPage,
    pageSize: validPageSize,
    totalEstimate,
    hasMore,
    results,
  };

  searchCache.set(cacheKey, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    data: response,
  });

  return response;
}
