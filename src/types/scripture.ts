export type UiLang = 'en' | 'zh';
export type DisplayMode = 'parallel' | 'interleaved' | 'en-only' | 'zh-only';
export type ThemeMode = 'light' | 'dark';
export type SearchVolumeFilter = 'all' | 'ot' | 'nt' | 'bofm' | 'dc-testament' | 'pgp';

export interface VerseSegment {
  type: 'text' | 'note';
  text: string;
  marker?: string;
  noteId?: string;
}

export interface FootnotePart {
  type: 'text' | 'ref' | 'external';
  text: string;
  book?: string;
  chapter?: number;
  verse?: number | null;
  url?: string;
}

export interface ScriptureFootnote {
  id: string;
  marker: string;
  fullMarker: string;
  verse: number;
  parts: FootnotePart[];
}

export interface AlignedVerse {
  verse: number;
  en: string;
  zh: string;
  enSegments?: VerseSegment[];
  zhSegments?: VerseSegment[];
}

export interface BilingualChapterResponse {
  book: string;
  volume: string;
  chapter: number;
  bookTitle: {
    en: string;
    zh: string;
  };
  volumeTitle: {
    en: string;
    zh: string;
  };
  summary: {
    en: string;
    zh: string;
  };
  intro?: {
    en: string;
    zh: string;
  };
  summaryTranslated?: {
    zh?: boolean;
  };
  verses: AlignedVerse[];
  footnotes?: {
    en: Record<string, ScriptureFootnote>;
    zh: Record<string, ScriptureFootnote>;
  };
  sources: {
    en: string | null;
    zh: string | null;
  };
  partial: {
    enMissing: boolean;
    zhMissing: boolean;
  };
  errors: {
    en?: string;
    zh?: string;
  };
  cached: boolean;
  fetchedAt: string;
}

export interface ScriptureApiError {
  error: string;
  retryable: boolean;
  details?: {
    en?: string;
    zh?: string;
  };
}

export interface ScriptureSearchResult {
  id: string;
  book: string;
  volume: string;
  chapter: number;
  verse: number | null;
  bookTitle: {
    en: string;
    zh: string;
  };
  volumeTitle: {
    en: string;
    zh: string;
  };
  snippet: string;
  matchedLang: 'en' | 'zh';
  source: string;
  isDirectReference?: boolean;
}

export interface ScriptureSearchResponse {
  query: string;
  volume: SearchVolumeFilter;
  page: number;
  pageSize: number;
  totalEstimate: number;
  hasMore: boolean;
  results: ScriptureSearchResult[];
}

export type HighlightColor = 'amber' | 'sage' | 'lapis' | 'rose';
export type StudyScope = 'verse' | 'selection';

export interface VerseStudyAnnotation {
  id: string;
  scope: StudyScope;
  verse: number;
  lang?: 'en' | 'zh';
  start?: number;
  end?: number;
  selectedText?: string;
  color: HighlightColor | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

