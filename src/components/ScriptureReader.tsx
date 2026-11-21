import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Highlighter,
  MessageSquarePlus,
  Moon,
  RefreshCw,
  Search,
  StickyNote,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  BOOK_CATALOG,
  getAdjacentChapter,
  SCRIPTURE_VOLUMES,
  type VolumeId,
} from '../data/scriptureCatalog.ts';
import type {
  AlignedVerse,
  BilingualChapterResponse,
  DisplayMode,
  HighlightColor,
  ScriptureApiError,
  ScriptureFootnote,
  ScriptureSearchResponse,
  ScriptureSearchResult,
  SearchVolumeFilter,
  ThemeMode,
  UiLang,
  VerseSegment,
  VerseStudyAnnotation,
} from '../types/scripture.ts';
import {
  createAnnotationId,
  detectVerseSelection,
  ensureVerseHighlightedInStorage,
  getVersePlainText,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_PALETTE,
  loadChapterStudyItems,
  saveChapterStudyItems,
  sliceSegmentByAnnotations,
  type DetectedVerseSelection,
} from '../utils/studyStorage.ts';
import VerseStudyPanel, { type StudyDraftState } from './VerseStudyPanel.tsx';

const STORAGE_KEY = 'bilingual-scripture-reader-prefs-v1';
const MIN_FONT_SIZE = 15;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 18;

interface StoredPrefs {
  book: string;
  chapter: number;
  uiLang: UiLang;
  displayMode: DisplayMode;
  fontSize: number;
  theme: ThemeMode;
}

const DEFAULT_PREFS: StoredPrefs = {
  book: 'john',
  chapter: 1,
  uiLang: 'en',
  displayMode: 'parallel',
  fontSize: DEFAULT_FONT_SIZE,
  theme: 'light',
};

function loadStoredPrefs(): StoredPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    const bookMeta =
      parsed.book && BOOK_CATALOG[parsed.book]
        ? BOOK_CATALOG[parsed.book]
        : BOOK_CATALOG[DEFAULT_PREFS.book];
    const chapter =
      typeof parsed.chapter === 'number' &&
      Number.isInteger(parsed.chapter) &&
      parsed.chapter >= 1 &&
      parsed.chapter <= bookMeta.chapters
        ? parsed.chapter
        : 1;
    const uiLang: UiLang = parsed.uiLang === 'zh' ? 'zh' : 'en';
    const displayMode: DisplayMode =
      parsed.displayMode === 'parallel' ||
      parsed.displayMode === 'interleaved' ||
      parsed.displayMode === 'en-only' ||
      parsed.displayMode === 'zh-only'
        ? parsed.displayMode
        : DEFAULT_PREFS.displayMode;
    const fontSize =
      typeof parsed.fontSize === 'number' &&
      parsed.fontSize >= MIN_FONT_SIZE &&
      parsed.fontSize <= MAX_FONT_SIZE
        ? Math.round(parsed.fontSize)
        : DEFAULT_FONT_SIZE;
    const theme: ThemeMode = parsed.theme === 'dark' ? 'dark' : 'light';

    return {
      book: bookMeta.key,
      chapter,
      uiLang,
      displayMode,
      fontSize,
      theme,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const UI_COPY = {
  en: {
    brand: 'Scripture Parallel',
    volumeLabel: 'Volume',
    bookLabel: 'Book',
    chapterLabel: 'Chapter',
    chapterPrefix: 'Chapter',
    sectionPrefix: 'Section',
    prevChapter: 'Previous',
    nextChapter: 'Next',
    parallel: 'Parallel',
    interleaved: 'Interleaved',
    enOnly: 'English',
    zhOnly: '中文',
    backToTop: 'Top',
    backToTopAria: 'Back to top',
    loading: 'Loading chapter…',
    retry: 'Retry',
    refresh: 'Refresh',
    partialEnMissing: 'English text could not be loaded for this chapter.',
    partialZhMissing: 'Chinese text could not be loaded for this chapter.',
    errorTitle: 'Unable to load chapter',
    summaryHeading: 'Chapter Summary',
    versesCount: (n: number) => `${n} verses`,
    copyVerse: 'Copy verse',
    copied: 'Copied',
    lightMode: 'Light',
    darkMode: 'Dark',
    keyboardHint:
      'Use ← and → keys to switch chapters · Click a verse number or select words to highlight & annotate · Press / to search',
    englishHeader: 'English',
    chineseHeader: '中文',
    highlightVerse: (n: number) => `Highlight verse ${n}`,
    unhighlightVerse: (n: number) => `Remove highlight from verse ${n}`,
    annotateVerse: (n: number) => `Annotate or view notes for verse ${n}`,
    annotateButton: 'Annotate',
    clearHighlights: (n: number) => `Clear highlights (${n})`,
    chapterStudyButton: (n: number) => `Notes & Highlights (${n})`,
    chapterStudyHeading: 'Chapter Highlights & Notes',
    wholeVerseLabel: 'Whole verse',
    selectedWordingLabel: 'Selected wording',
    highlightOnlyLabel: 'Highlight only',
    jumpToVerse: 'Go to verse',
    editAction: 'Edit',
    removeAction: 'Remove',
    clearAllStudy: 'Clear all',
    confirmClearAllStudy: 'Confirm clear all',
    annotateSelection: 'Annotate',
    highlightSelectionTitle: (colorName: string) => `Highlight (${colorName})`,
    selectionNoteBadgeAria: 'View annotation for selected wording',
    searchPlaceholder: 'Search scriptures or references (e.g. "perfect knowledge", "太初有道", "Alma 32:21")',
    searchButton: 'Search',
    searchAllVolumes: 'All Volumes',
    searchResultsTitle: 'Search Results',
    searchCount: (shown: number, total: number) =>
      total > shown ? `Showing ${shown} of ${total.toLocaleString()} matches` : `${shown} matches`,
    searchEmpty: 'No scripture verses matched your query. Try different keywords or switch to All Volumes.',
    searchError: 'Unable to complete search.',
    closeSearch: 'Close',
    showResults: (n: number) => `Show search results (${n})`,
    openInReader: 'Open in reader',
    prevPage: 'Previous page',
    nextPage: 'Next page',
    searching: 'Searching across scripture volumes…',
    footnoteHeading: 'Study Footnotes',
    footnoteOpenAria: (marker: string, word: string) =>
      `Open footnote ${marker}${word ? ` for ${word}` : ''}`,
    footnoteClose: 'Close footnotes',
    footnoteMissing: 'Footnote details unavailable.',
    returnToStudy: (ref: string) => `Return to ${ref}`,
    studyTrailLabel: 'Cross-referencing from',
    jumpToRefTitle: (ref: string) => `Jump to ${ref}`,
    googleTranslatedLabel: '(Google Translated)',
  },
  zh: {
    brand: '雙語經文',
    volumeLabel: '經典',
    bookLabel: '書卷',
    chapterLabel: '章節',
    chapterPrefix: '第',
    chapterSuffix: '章',
    sectionPrefix: '第',
    sectionSuffix: '篇',
    prevChapter: '上一章',
    nextChapter: '下一章',
    parallel: '並排對照',
    interleaved: '逐節交錯',
    enOnly: '英文',
    zhOnly: '中文',
    backToTop: '頂部',
    backToTopAria: '回到頂部',
    loading: '正在載入經文…',
    retry: '重試',
    refresh: '重新抓取',
    partialEnMissing: '本章節的英文經文暫時無法載入。',
    partialZhMissing: '本章節的中文經文暫時無法載入。',
    errorTitle: '無法載入章節',
    summaryHeading: '章節摘要',
    versesCount: (n: number) => `共 ${n} 節`,
    copyVerse: '複製經文',
    copied: '已複製',
    lightMode: '淺色',
    darkMode: '深色',
    keyboardHint: '可使用 ← 與 → 切換章節 · 點擊節數或選取字詞可畫記與寫筆記 · 按 / 搜尋',
    englishHeader: 'English',
    chineseHeader: '中文',
    highlightVerse: (n: number) => `標記第 ${n} 節`,
    unhighlightVerse: (n: number) => `取消標記第 ${n} 節`,
    annotateVerse: (n: number) => `為第 ${n} 節加上或檢視筆記`,
    annotateButton: '筆記',
    clearHighlights: (n: number) => `清除標記 (${n})`,
    chapterStudyButton: (n: number) => `畫記與筆記 (${n})`,
    chapterStudyHeading: '本章畫記與研讀筆記',
    wholeVerseLabel: '整節經文',
    selectedWordingLabel: '選取字詞',
    highlightOnlyLabel: '僅畫記',
    jumpToVerse: '前往該節',
    editAction: '編輯',
    removeAction: '刪除',
    clearAllStudy: '全部清除',
    confirmClearAllStudy: '確認全部清除',
    annotateSelection: '加上筆記',
    highlightSelectionTitle: (colorName: string) => `畫記 (${colorName})`,
    selectionNoteBadgeAria: '檢視選取字詞的筆記',
    searchPlaceholder: '搜尋經文字詞、片語或章節（例如「太初有道」、「faith hope charity」、「Alma 32:21」）',
    searchButton: '搜尋',
    searchAllVolumes: '全部經典',
    searchResultsTitle: '搜尋結果',
    searchCount: (shown: number, total: number) =>
      total > shown ? `顯示 ${shown} 筆（共約 ${total.toLocaleString()} 筆符合）` : `共 ${shown} 筆結果`,
    searchEmpty: '找不到符合的經文，請嘗試其他關鍵字或切換為「全部經典」。',
    searchError: '無法完成搜尋。',
    closeSearch: '關閉',
    showResults: (n: number) => `顯示搜尋結果 (${n})`,
    openInReader: '前往閱讀',
    prevPage: '上一頁',
    nextPage: '下一頁',
    searching: '正在跨經典搜尋經文…',
    footnoteHeading: '經文註腳',
    footnoteOpenAria: (marker: string, word: string) =>
      `檢視註腳 ${marker}${word ? `（${word}）` : ''}`,
    footnoteClose: '關閉註腳',
    footnoteMissing: '無法讀取此註腳內容。',
    returnToStudy: (ref: string) => `返回 ${ref}`,
    studyTrailLabel: '目前正從註腳跳轉研讀：',
    jumpToRefTitle: (ref: string) => `跳轉至 ${ref}`,
    googleTranslatedLabel: '（Google 翻譯）',
  },
};

interface StudyOrigin {
  book: string;
  chapter: number;
  verse: number;
  lang: 'en' | 'zh';
  noteId: string;
  marker: string;
  labelEn: string;
  labelZh: string;
}

function renderHighlightedSnippet(snippet: string, query: string): React.ReactNode {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((t) => t.length >= 2 || /[\u4e00-\u9fff]/.test(t));

  if (tokens.length === 0) return snippet;

  const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = snippet.split(pattern);

  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark
        key={idx}
        className="bg-[#1E3A5F]/15 dark:bg-[#7DA2D1]/25 text-stone-900 dark:text-stone-100 rounded-xs px-0.5 font-medium"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export default function ScriptureReader() {
  const initialPrefs = useMemo(() => loadStoredPrefs(), []);

  const [bookKey, setBookKey] = useState<string>(initialPrefs.book);
  const [chapter, setChapter] = useState<number>(initialPrefs.chapter);
  const [uiLang, setUiLang] = useState<UiLang>(initialPrefs.uiLang);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialPrefs.displayMode);
  const [fontSize, setFontSize] = useState<number>(initialPrefs.fontSize);
  const [theme, setTheme] = useState<ThemeMode>(initialPrefs.theme);

  const [chapterData, setChapterData] = useState<BilingualChapterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<ScriptureApiError | null>(null);
  const [studyItems, setStudyItems] = useState<VerseStudyAnnotation[]>(() =>
    loadChapterStudyItems(initialPrefs.book, initialPrefs.chapter)
  );
  const [activeHighlightColor, setActiveHighlightColor] =
    useState<HighlightColor>('amber');
  const [activeStudyVerse, setActiveStudyVerse] = useState<number | null>(null);
  const [studyDraft, setStudyDraft] = useState<StudyDraftState | null>(null);
  const [chapterNotesOpen, setChapterNotesOpen] = useState<boolean>(false);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [selectionToolbar, setSelectionToolbar] =
    useState<DetectedVerseSelection | null>(null);

  const [copiedVerse, setCopiedVerse] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const { verseLevelByVerse, selectionItemsByVerseLang, studyItemsByVerse } =
    useMemo(() => {
      const verseMap = new Map<number, VerseStudyAnnotation>();
      const selMap = new Map<string, VerseStudyAnnotation[]>();
      const allByVerse = new Map<number, VerseStudyAnnotation[]>();

      for (const item of studyItems) {
        const list = allByVerse.get(item.verse) || [];
        list.push(item);
        allByVerse.set(item.verse, list);

        if (item.scope === 'verse') {
          verseMap.set(item.verse, item);
        } else if (item.scope === 'selection' && item.lang) {
          const k = `${item.verse}:${item.lang}`;
          const arr = selMap.get(k) || [];
          arr.push(item);
          selMap.set(k, arr);
        }
      }

      return {
        verseLevelByVerse: verseMap,
        selectionItemsByVerseLang: selMap,
        studyItemsByVerse: allByVerse,
      };
    }, [studyItems]);

  const [searchInput, setSearchInput] = useState<string>('');
  const [searchVolume, setSearchVolume] = useState<SearchVolumeFilter>('all');
  const [searchResponse, setSearchResponse] = useState<ScriptureSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(false);
  const [pendingScrollVerse, setPendingScrollVerse] = useState<number | null>(null);
  const [activeFootnote, setActiveFootnote] = useState<{
    verse: number;
    lang: 'en' | 'zh';
    noteId: string;
  } | null>(null);
  const [pendingRestoreFootnote, setPendingRestoreFootnote] = useState<{
    verse: number;
    lang: 'en' | 'zh';
    noteId: string;
  } | null>(null);
  const [studyHistory, setStudyHistory] = useState<StudyOrigin[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const t = UI_COPY[uiLang];
  const currentBook = BOOK_CATALOG[bookKey] ?? BOOK_CATALOG.john;
  const currentVolume =
    SCRIPTURE_VOLUMES.find((v) => v.id === currentBook.volume) ?? SCRIPTURE_VOLUMES[1];

  const prevTarget = useMemo(
    () => getAdjacentChapter(currentBook.key, chapter, 'prev'),
    [currentBook.key, chapter]
  );
  const nextTarget = useMemo(
    () => getAdjacentChapter(currentBook.key, chapter, 'next'),
    [currentBook.key, chapter]
  );

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Persist user preferences to localStorage
  useEffect(() => {
    try {
      const prefs: StoredPrefs = {
        book: currentBook.key,
        chapter,
        uiLang,
        displayMode,
        fontSize,
        theme,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [currentBook.key, chapter, uiLang, displayMode, fontSize, theme]);

  // Track reading depth progress bar
  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chapterData]);

  const fetchChapter = useCallback(
    async (targetBook: string, targetChapter: number, bypassCache = false) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErrorState(null);
      setActiveFootnote(null);
      setActiveStudyVerse(null);
      setStudyDraft(null);
      setSelectionToolbar(null);
      setConfirmClearAll(false);
      setStudyItems(loadChapterStudyItems(targetBook, targetChapter));

      try {
        const params = new URLSearchParams({
          book: targetBook,
          chapter: String(targetChapter),
        });
        if (bypassCache) {
          params.set('refresh', '1');
        }

        const res = await fetch(`/api/scripture?${params.toString()}`, {
          signal: controller.signal,
        });

        const json = await res.json();
        if (!res.ok) {
          setErrorState({
            error: json?.error || 'Failed to fetch scripture chapter.',
            retryable: json?.retryable !== false,
            details: json?.details,
          });
          setChapterData(null);
          return;
        }

        setChapterData(json as BilingualChapterResponse);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorState({
          error:
            err instanceof Error ? err.message : 'Network error loading scripture chapter.',
          retryable: true,
        });
        setChapterData(null);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchChapter(currentBook.key, chapter, false);
  }, [currentBook.key, chapter, fetchChapter]);

  // Detect text selection inside English or Chinese verses (desktop + mobile/iPad)
  useEffect(() => {
    if (loading || !chapterData) return;

    let timer: number | null = null;
    const evaluateSelection = () => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'INPUT' ||
          activeEl.closest('[data-selection-toolbar="true"]'))
      ) {
        return;
      }
      const detected = detectVerseSelection(window.getSelection());
      setSelectionToolbar(detected);
    };

    const scheduleEval = (delayMs: number) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(evaluateSelection, delayMs);
    };

    const onMouseUp = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[data-selection-toolbar="true"]')) {
        return;
      }
      scheduleEval(20);
    };

    const onKeyUp = () => scheduleEval(40);
    const onSelectionChange = () => scheduleEval(180);

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [loading, chapterData]);

  // Dismiss floating selection toolbar if viewport scrolls significantly
  useEffect(() => {
    if (!selectionToolbar) return;
    const startY = window.scrollY;
    const onScrollDismiss = () => {
      if (Math.abs(window.scrollY - startY) > 16) {
        setSelectionToolbar(null);
      }
    };
    window.addEventListener('scroll', onScrollDismiss, { passive: true });
    return () => window.removeEventListener('scroll', onScrollDismiss);
  }, [selectionToolbar]);

  const updateStudyItems = useCallback(
    (updater: (prev: VerseStudyAnnotation[]) => VerseStudyAnnotation[]) => {
      setStudyItems((prev) => {
        const next = updater(prev);
        saveChapterStudyItems(currentBook.key, chapter, next);
        return next;
      });
    },
    [currentBook.key, chapter]
  );

  const toggleVerseHighlight = useCallback(
    (verseNumber: number) => {
      updateStudyItems((prev) => {
        const idx = prev.findIndex(
          (item) => item.scope === 'verse' && item.verse === verseNumber
        );
        const now = new Date().toISOString();

        if (idx === -1) {
          return [
            ...prev,
            {
              id: createAnnotationId(),
              scope: 'verse',
              verse: verseNumber,
              color: activeHighlightColor,
              note: '',
              createdAt: now,
              updatedAt: now,
            },
          ];
        }

        const existing = prev[idx];
        if (existing.color !== null) {
          // If the verse has a written note, remove only the background tint so the note is preserved
          if (existing.note.trim().length > 0) {
            const copy = [...prev];
            copy[idx] = { ...existing, color: null, updatedAt: now };
            return copy;
          }
          return prev.filter((_, i) => i !== idx);
        }

        // Note-only verse item -> apply highlight color
        const copy = [...prev];
        copy[idx] = { ...existing, color: activeHighlightColor, updatedAt: now };
        return copy;
      });
    },
    [updateStudyItems, activeHighlightColor]
  );

  const clearAllChapterStudyItems = useCallback(() => {
    updateStudyItems(() => []);
    setConfirmClearAll(false);
    setChapterNotesOpen(false);
    setActiveStudyVerse(null);
    setStudyDraft(null);
  }, [updateStudyItems]);

  const clearBrowserSelection = () => {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      // Ignore selection clear error
    }
    setSelectionToolbar(null);
  };

  const handleHighlightSelection = useCallback(
    (color: HighlightColor) => {
      if (!selectionToolbar) return;
      const now = new Date().toISOString();
      const newItem: VerseStudyAnnotation = {
        id: createAnnotationId(),
        scope: 'selection',
        verse: selectionToolbar.verse,
        lang: selectionToolbar.lang,
        start: selectionToolbar.start,
        end: selectionToolbar.end,
        selectedText: selectionToolbar.selectedText,
        color,
        note: '',
        createdAt: now,
        updatedAt: now,
      };
      setActiveHighlightColor(color);
      updateStudyItems((prev) => [...prev, newItem]);
      clearBrowserSelection();
    },
    [selectionToolbar, updateStudyItems]
  );

  const handleStartAnnotateSelection = useCallback(() => {
    if (!selectionToolbar) return;
    const { verse, lang, start, end, selectedText } = selectionToolbar;
    setActiveStudyVerse(verse);
    setStudyDraft({
      editingId: null,
      scope: 'selection',
      verse,
      lang,
      start,
      end,
      selectedText,
      color: activeHighlightColor,
      note: '',
    });
    clearBrowserSelection();
  }, [selectionToolbar, activeHighlightColor]);

  const handleToggleVerseStudyPanel = useCallback(
    (verseNumber: number) => {
      if (activeStudyVerse === verseNumber) {
        setActiveStudyVerse(null);
        setStudyDraft((prev) => (prev?.verse === verseNumber ? null : prev));
        return;
      }

      setActiveStudyVerse(verseNumber);
      const existingForVerse = studyItemsByVerse.get(verseNumber) || [];
      if (existingForVerse.length === 0) {
        setStudyDraft({
          editingId: null,
          scope: 'verse',
          verse: verseNumber,
          color: activeHighlightColor,
          note: '',
        });
      } else {
        setStudyDraft(null);
      }
    },
    [activeStudyVerse, studyItemsByVerse, activeHighlightColor]
  );

  const handleStartNewVerseNote = useCallback(
    (verseNumber: number) => {
      const existingWhole = verseLevelByVerse.get(verseNumber);
      setActiveStudyVerse(verseNumber);
      setStudyDraft({
        editingId: existingWhole ? existingWhole.id : null,
        scope: 'verse',
        verse: verseNumber,
        color: existingWhole ? existingWhole.color : activeHighlightColor,
        note: existingWhole ? existingWhole.note : '',
      });
    },
    [verseLevelByVerse, activeHighlightColor]
  );

  const handleEditStudyItem = useCallback((item: VerseStudyAnnotation) => {
    setActiveStudyVerse(item.verse);
    setStudyDraft({
      editingId: item.id,
      scope: item.scope,
      verse: item.verse,
      lang: item.lang,
      start: item.start,
      end: item.end,
      selectedText: item.selectedText,
      color: item.color,
      note: item.note,
    });
  }, []);

  const handleSaveStudyDraft = useCallback(() => {
    if (!studyDraft) return;
    const trimmedNote = studyDraft.note.trim();
    if (studyDraft.color === null && trimmedNote.length === 0) return;

    const now = new Date().toISOString();
    if (studyDraft.color) {
      setActiveHighlightColor(studyDraft.color);
    }

    updateStudyItems((prev) => {
      if (studyDraft.editingId) {
        return prev.map((item) =>
          item.id === studyDraft.editingId
            ? {
                ...item,
                color: studyDraft.color,
                note: studyDraft.note,
                updatedAt: now,
              }
            : item
        );
      }

      // If creating a whole-verse note when a whole-verse highlight already exists, merge into it
      if (studyDraft.scope === 'verse') {
        const existingWholeIdx = prev.findIndex(
          (item) => item.scope === 'verse' && item.verse === studyDraft.verse
        );
        if (existingWholeIdx !== -1) {
          const copy = [...prev];
          copy[existingWholeIdx] = {
            ...copy[existingWholeIdx],
            color: studyDraft.color,
            note: studyDraft.note,
            updatedAt: now,
          };
          return copy;
        }
      }

      return [
        ...prev,
        {
          id: createAnnotationId(),
          scope: studyDraft.scope,
          verse: studyDraft.verse,
          lang: studyDraft.lang,
          start: studyDraft.start,
          end: studyDraft.end,
          selectedText: studyDraft.selectedText,
          color: studyDraft.color,
          note: studyDraft.note,
          createdAt: now,
          updatedAt: now,
        },
      ];
    });

    setStudyDraft(null);
  }, [studyDraft, updateStudyItems]);

  const handleChangeItemColor = useCallback(
    (itemId: string, color: HighlightColor | null) => {
      if (color) setActiveHighlightColor(color);
      updateStudyItems((prev) =>
        prev
          .map((item) =>
            item.id === itemId
              ? { ...item, color, updatedAt: new Date().toISOString() }
              : item
          )
          .filter((item) => item.color !== null || item.note.trim().length > 0)
      );
    },
    [updateStudyItems]
  );

  const handleDeleteStudyItem = useCallback(
    (itemId: string) => {
      updateStudyItems((prev) => prev.filter((item) => item.id !== itemId));
      setStudyDraft((prev) => (prev?.editingId === itemId ? null : prev));
    },
    [updateStudyItems]
  );

  const navigateTo = useCallback((target: { book: string; chapter: number } | null) => {
    if (!target) return;
    setBookKey(target.book);
    setChapter(target.chapter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll to target verse (and optionally restore origin footnote) after chapter load
  useEffect(() => {
    if (loading || !chapterData) return;

    if (pendingRestoreFootnote) {
      setActiveFootnote(pendingRestoreFootnote);
      setPendingRestoreFootnote(null);
    }

    if (pendingScrollVerse !== null) {
      const targetEl = document.getElementById(`v-${pendingScrollVerse}`);
      if (targetEl) {
        window.requestAnimationFrame(() => {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      setPendingScrollVerse(null);
    }
  }, [loading, chapterData, pendingScrollVerse, pendingRestoreFootnote]);

  const handleFootnoteClick = useCallback(
    (verse: number, lang: 'en' | 'zh', noteId: string) => {
      setActiveFootnote((prev) =>
        prev &&
        prev.verse === verse &&
        prev.lang === lang &&
        prev.noteId === noteId
          ? null
          : { verse, lang, noteId }
      );
    },
    []
  );

  const handleJumpToFootnoteRef = useCallback(
    (
      targetBook: string,
      targetChapter: number,
      targetVerse: number | null,
      originVerse: number,
      originLang: 'en' | 'zh',
      originNoteId: string,
      originMarker: string
    ) => {
      const originEntry: StudyOrigin = {
        book: currentBook.key,
        chapter,
        verse: originVerse,
        lang: originLang,
        noteId: originNoteId,
        marker: originMarker,
        labelEn: `${currentBook.en} ${chapter}:${originVerse}${originMarker ? ` (${originMarker})` : ''}`,
        labelZh: `${currentBook.zh} ${chapter}:${originVerse}${originMarker ? ` (${originMarker})` : ''}`,
      };
      setStudyHistory((prev) => [...prev, originEntry]);

      if (targetVerse !== null && targetVerse > 0) {
        ensureVerseHighlightedInStorage(
          targetBook,
          targetChapter,
          targetVerse,
          activeHighlightColor
        );
        setPendingScrollVerse(targetVerse);
      } else {
        setPendingScrollVerse(null);
      }

      if (targetBook === currentBook.key && targetChapter === chapter) {
        // Jumping within the same chapter
        setActiveFootnote(null);
        if (targetVerse !== null && targetVerse > 0) {
          setStudyItems(loadChapterStudyItems(targetBook, targetChapter));
          const el = document.getElementById(`v-${targetVerse}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          setPendingScrollVerse(null);
        }
        return;
      }

      setBookKey(targetBook);
      setChapter(targetChapter);
      if (targetVerse === null) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentBook.key, currentBook.en, currentBook.zh, chapter, activeHighlightColor]
  );

  const handleReturnToStudy = useCallback(() => {
    if (studyHistory.length === 0) return;
    const origin = studyHistory[studyHistory.length - 1];
    setStudyHistory((prev) => prev.slice(0, -1));

    if (origin.book === currentBook.key && origin.chapter === chapter) {
      setActiveFootnote({
        verse: origin.verse,
        lang: origin.lang,
        noteId: origin.noteId,
      });
      const el = document.getElementById(`v-${origin.verse}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setPendingScrollVerse(origin.verse);
    setPendingRestoreFootnote({
      verse: origin.verse,
      lang: origin.lang,
      noteId: origin.noteId,
    });
    setBookKey(origin.book);
    setChapter(origin.chapter);
  }, [studyHistory, currentBook.key, chapter]);

  const executeSearch = useCallback(
    async (query: string, volume: SearchVolumeFilter, page = 1) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSearchResponse(null);
        setSearchError(null);
        setSearchPanelOpen(false);
        return;
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearchLoading(true);
      setSearchError(null);
      setSearchPanelOpen(true);

      try {
        const params = new URLSearchParams({
          q: trimmed,
          volume,
          page: String(page),
        });
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setSearchError(json?.error || t.searchError);
          return;
        }
        setSearchResponse(json as ScriptureSearchResponse);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setSearchError(err instanceof Error ? err.message : t.searchError);
      } finally {
        if (searchAbortRef.current === controller) {
          setSearchLoading(false);
        }
      }
    },
    [t.searchError]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchInput, searchVolume, 1);
  };

  const handleOpenSearchResult = useCallback(
    (result: ScriptureSearchResult) => {
      if (result.verse !== null && result.verse > 0) {
        ensureVerseHighlightedInStorage(
          result.book,
          result.chapter,
          result.verse,
          activeHighlightColor
        );
        setPendingScrollVerse(result.verse);
      } else {
        setPendingScrollVerse(null);
      }

      if (result.book === currentBook.key && result.chapter === chapter) {
        setStudyItems(loadChapterStudyItems(result.book, result.chapter));
        if (result.verse !== null) {
          const el = document.getElementById(`v-${result.verse}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setPendingScrollVerse(null);
        }
      } else {
        setBookKey(result.book);
        setChapter(result.chapter);
        if (result.verse === null) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      setSearchPanelOpen(false);
    },
    [activeHighlightColor, currentBook.key, chapter]
  );

  // Keyboard navigation (ArrowLeft / ArrowRight and '/' to focus search)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === '/') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        searchInputRef.current?.focus();
      } else if (e.key === 'ArrowLeft' && prevTarget) {
        e.preventDefault();
        navigateTo(prevTarget);
      } else if (e.key === 'ArrowRight' && nextTarget) {
        e.preventDefault();
        navigateTo(nextTarget);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prevTarget, nextTarget, navigateTo]);

  const handleVolumeChange = (volumeId: VolumeId) => {
    const vol = SCRIPTURE_VOLUMES.find((v) => v.id === volumeId);
    if (!vol || vol.books.length === 0) return;
    setBookKey(vol.books[0].key);
    setChapter(1);
  };

  const handleBookChange = (nextBookKey: string) => {
    if (!BOOK_CATALOG[nextBookKey]) return;
    setBookKey(nextBookKey);
    setChapter(1);
  };

  const handleChapterChange = (nextChapter: number) => {
    setChapter(nextChapter);
  };

  const formatChapterHeading = (lang: UiLang) => {
    const isDc = currentBook.key === 'dc';
    if (lang === 'zh') {
      const unit = isDc ? '篇' : '章';
      return `${currentBook.zh} 第${chapter}${unit}`;
    }
    return isDc ? `Doctrine and Covenants ${chapter}` : `${currentBook.en} ${chapter}`;
  };

  const formatTargetLabel = (target: { book: string; chapter: number } | null) => {
    if (!target) return '';
    const meta = BOOK_CATALOG[target.book];
    if (!meta) return '';
    return uiLang === 'zh' ? `${meta.zh} ${target.chapter}` : `${meta.en} ${target.chapter}`;
  };

  const handleCopyVerse = async (verse: AlignedVerse) => {
    const refEn = `${currentBook.en} ${chapter}:${verse.verse}`;
    const refZh = `${currentBook.zh} ${chapter}:${verse.verse}`;
    const parts: string[] = [];

    if (displayMode === 'en-only') {
      if (verse.en) parts.push(`${refEn}\n${verse.en}`);
    } else if (displayMode === 'zh-only') {
      if (verse.zh) parts.push(`${refZh}\n${verse.zh}`);
    } else if (uiLang === 'zh') {
      parts.push(`${refZh} / ${refEn}`);
      if (verse.zh) parts.push(verse.zh);
      if (verse.en) parts.push(verse.en);
    } else {
      parts.push(`${refEn} / ${refZh}`);
      if (verse.en) parts.push(verse.en);
      if (verse.zh) parts.push(verse.zh);
    }

    try {
      await navigator.clipboard.writeText(parts.join('\n'));
      setCopiedVerse(verse.verse);
      window.setTimeout(() => {
        setCopiedVerse((prev) => (prev === verse.verse ? null : prev));
      }, 1600);
    } catch {
      // Clipboard API unavailable
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enFontStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: 1.75,
  };

  const zhFontStyle = {
    fontSize: `${fontSize + 1}px`,
    lineHeight: 1.9,
  };

  const chapterNumbers = useMemo(
    () => Array.from({ length: currentBook.chapters }, (_, i) => i + 1),
    [currentBook.chapters]
  );

  const primaryTitle =
    uiLang === 'zh' ? formatChapterHeading('zh') : formatChapterHeading('en');
  const secondaryTitle =
    uiLang === 'zh' ? formatChapterHeading('en') : formatChapterHeading('zh');

  const enIntro = chapterData?.intro?.en || '';
  const zhIntro = chapterData?.intro?.zh || '';
  const enSummary = chapterData?.summary.en || '';
  const zhSummary = chapterData?.summary.zh || '';
  const isZhSummaryTranslated = Boolean(chapterData?.summaryTranslated?.zh);
  const hasAnyHeadingSummary = Boolean(enIntro || zhIntro || enSummary || zhSummary);

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-stone-900 dark:bg-[#111315] dark:text-[#E7E5E0] transition-colors duration-150">
      {/* Subtle top reading depth progress line */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 z-50 h-[2px] bg-[#1E3A5F] dark:bg-[#7DA2D1] transition-[width] duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Sticky Top Header (compact <= 56px to respect 15% mobile sticky cap) */}
      <header className="sticky top-0 z-30 h-14 border-b border-stone-200/90 dark:border-stone-800 bg-[#FAF8F4]/95 dark:bg-[#111315]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-element Wordmark */}
          <button
            type="button"
            onClick={scrollToTop}
            className="font-['Cormorant_Garamond','Noto_Serif_TC',serif] text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
          >
            {t.brand}
          </button>

          {/* Zone 2: Quick Chapter Pager */}
          <nav
            aria-label="Chapter quick navigation"
            className="flex items-center gap-1 sm:gap-2 min-w-0"
          >
            <button
              type="button"
              onClick={() => navigateTo(prevTarget)}
              disabled={!prevTarget}
              aria-label={t.prevChapter}
              title={prevTarget ? `${t.prevChapter}: ${formatTargetLabel(prevTarget)}` : undefined}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md text-stone-700 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate max-w-[140px] sm:max-w-xs tabular-nums">
              {uiLang === 'zh'
                ? `${currentBook.zh} ${chapter}`
                : `${currentBook.en} ${chapter}`}
            </span>

            <button
              type="button"
              onClick={() => navigateTo(nextTarget)}
              disabled={!nextTarget}
              aria-label={t.nextChapter}
              title={nextTarget ? `${t.nextChapter}: ${formatTargetLabel(nextTarget)}` : undefined}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md text-stone-700 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>

          {/* Zone 3: Language & Theme Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setUiLang((prev) => (prev === 'en' ? 'zh' : 'en'))}
              className="h-10 px-3 rounded-md border border-stone-300/80 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
              aria-label="Toggle UI language"
            >
              {uiLang === 'en' ? '中文' : 'EN'}
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-stone-300/80 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
              aria-label={theme === 'light' ? t.darkMode : t.lightMode}
              title={theme === 'light' ? t.darkMode : t.lightMode}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Edge Chapter Navigation Arrows on Wide Desktop */}
      {prevTarget && (
        <button
          type="button"
          onClick={() => navigateTo(prevTarget)}
          aria-label={`${t.prevChapter}: ${formatTargetLabel(prevTarget)}`}
          title={`${t.prevChapter}: ${formatTargetLabel(prevTarget)}`}
          className="hidden xl:flex fixed left-5 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-11 h-16 rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF8F4]/90 dark:bg-[#181A1E]/90 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-300 dark:hover:border-stone-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {nextTarget && (
        <button
          type="button"
          onClick={() => navigateTo(nextTarget)}
          aria-label={`${t.nextChapter}: ${formatTargetLabel(nextTarget)}`}
          title={`${t.nextChapter}: ${formatTargetLabel(nextTarget)}`}
          className="hidden xl:flex fixed right-5 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-11 h-16 rounded-lg border border-stone-200 dark:border-stone-800 bg-[#FAF8F4]/90 dark:bg-[#181A1E]/90 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:border-stone-300 dark:hover:border-stone-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        {/* Editorial Workspace Toolbar (Scrolls naturally, never blocks mobile viewport) */}
        <section
          aria-label="Scripture selection and display controls"
          className="bg-[#F2EFE8] dark:bg-[#181A1E] border border-stone-200/90 dark:border-stone-800 rounded-lg p-4 mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            {/* Volume / Book / Chapter Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t.volumeLabel}
                </span>
                <select
                  value={currentBook.volume}
                  onChange={(e) => handleVolumeChange(e.target.value as VolumeId)}
                  className="h-10 px-3 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] cursor-pointer"
                >
                  {SCRIPTURE_VOLUMES.map((vol) => (
                    <option key={vol.id} value={vol.id}>
                      {uiLang === 'zh' ? vol.zh : vol.en}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t.bookLabel}
                </span>
                <select
                  value={currentBook.key}
                  onChange={(e) => handleBookChange(e.target.value)}
                  className="h-10 px-3 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-sm text-stone-900 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] cursor-pointer"
                >
                  {currentVolume.books.map((b) => (
                    <option key={b.key} value={b.key}>
                      {uiLang === 'zh' ? `${b.zh} (${b.en})` : `${b.en} · ${b.zh}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  {t.chapterLabel}
                </span>
                <select
                  value={chapter}
                  onChange={(e) => handleChapterChange(Number(e.target.value))}
                  className="h-10 px-3 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-sm text-stone-900 dark:text-stone-100 tabular-nums focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] cursor-pointer"
                >
                  {chapterNumbers.map((num) => (
                    <option key={num} value={num}>
                      {uiLang === 'zh'
                        ? `${currentBook.key === 'dc' ? '第 ' : '第 '}${num}${currentBook.key === 'dc' ? ' 篇' : ' 章'}`
                        : `${currentBook.key === 'dc' ? 'Section' : 'Chapter'} ${num}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Display Mode & Typography Scale */}
            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
              {/* Segmented Display Mode */}
              <div
                role="group"
                aria-label="Reading layout mode"
                className="inline-flex items-center p-1 rounded-md bg-stone-200/80 dark:bg-stone-800/90 border border-stone-300/60 dark:border-stone-700/80"
              >
                {(
                  [
                    ['parallel', t.parallel],
                    ['interleaved', t.interleaved],
                    ['en-only', t.enOnly],
                    ['zh-only', t.zhOnly],
                  ] as [DisplayMode, string][]
                ).map(([mode, label]) => {
                  const active = displayMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDisplayMode(mode)}
                      className={`h-8 px-3 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                        active
                          ? 'bg-white dark:bg-[#111315] text-[#1E3A5F] dark:text-[#7DA2D1] shadow-xs'
                          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Font Size Controls */}
              <div
                role="group"
                aria-label="Font size"
                className="inline-flex items-center rounded-md border border-stone-300/80 dark:border-stone-700 bg-white dark:bg-[#111315]"
              >
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 1))}
                  disabled={fontSize <= MIN_FONT_SIZE}
                  aria-label="Decrease font size"
                  className="h-10 px-3 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  A-
                </button>
                <span className="px-2 text-xs text-stone-500 dark:text-stone-400 tabular-nums border-x border-stone-200 dark:border-stone-800 select-none">
                  {fontSize}
                </span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 1))}
                  disabled={fontSize >= MAX_FONT_SIZE}
                  aria-label="Increase font size"
                  className="h-10 px-3 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  A+
                </button>
              </div>
            </div>
          </div>

          {/* Cross-Volume Scripture Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Search scriptures across all volumes"
            className="mt-4 pt-4 border-t border-stone-200/90 dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <div className="relative flex-1 min-w-0">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full h-10 pl-9 pr-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchResponse(null);
                    setSearchError(null);
                    setSearchPanelOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={searchVolume}
                onChange={(e) => {
                  const nextVol = e.target.value as SearchVolumeFilter;
                  setSearchVolume(nextVol);
                  if (searchResponse && searchInput.trim()) {
                    executeSearch(searchInput, nextVol, 1);
                  }
                }}
                aria-label="Search volume scope"
                className="h-10 px-3 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-sm text-stone-800 dark:text-stone-200 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] cursor-pointer"
              >
                <option value="all">{t.searchAllVolumes}</option>
                {SCRIPTURE_VOLUMES.map((vol) => (
                  <option key={vol.id} value={vol.id}>
                    {uiLang === 'zh' ? vol.zh : vol.en}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!searchInput.trim() || searchLoading}
                className="h-10 px-4 rounded-md bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] text-sm font-medium hover:opacity-90 disabled:opacity-45 disabled:pointer-events-none transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.searchButton}
              </button>

              {!searchPanelOpen && searchResponse && (
                <button
                  type="button"
                  onClick={() => setSearchPanelOpen(true)}
                  className="h-10 px-3 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  {t.showResults(searchResponse.results.length)}
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Search Results Panel */}
        {searchPanelOpen && (
          <section
            aria-label={t.searchResultsTitle}
            className="mb-10 bg-white dark:bg-[#181A1E] border border-stone-200 dark:border-stone-800 rounded-lg p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
              <div>
                <h2 className="font-['Cormorant_Garamond','Noto_Serif_TC',serif] text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  {t.searchResultsTitle}
                </h2>
                {searchResponse && !searchLoading && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                    <span>“{searchResponse.query}”</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {t.searchCount(
                        searchResponse.results.length,
                        searchResponse.totalEstimate
                      )}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSearchPanelOpen(false)}
                className="h-9 px-3 rounded-md border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.closeSearch}</span>
              </button>
            </div>

            {searchLoading && (
              <div className="py-8 text-sm text-stone-500 dark:text-stone-400">
                {t.searching}
              </div>
            )}

            {!searchLoading && searchError && (
              <div className="py-6 text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4">
                <span>{searchError}</span>
                <button
                  type="button"
                  onClick={() => executeSearch(searchInput, searchVolume, 1)}
                  className="h-9 px-3 rounded-md border border-stone-300 dark:border-stone-700 text-xs font-medium cursor-pointer"
                >
                  {t.retry}
                </button>
              </div>
            )}

            {!searchLoading &&
              !searchError &&
              searchResponse &&
              searchResponse.results.length === 0 && (
                <p className="py-8 text-sm text-stone-600 dark:text-stone-400">
                  {t.searchEmpty}
                </p>
              )}

            {!searchLoading &&
              !searchError &&
              searchResponse &&
              searchResponse.results.length > 0 && (
                <>
                  <div className="divide-y divide-stone-200/80 dark:divide-stone-800/80">
                    {searchResponse.results.map((item) => {
                      const refEn = item.verse
                        ? `${item.bookTitle.en} ${item.chapter}:${item.verse}`
                        : `${item.bookTitle.en} ${item.chapter}`;
                      const refZh = item.verse
                        ? `${item.bookTitle.zh} ${item.chapter}:${item.verse}`
                        : `${item.bookTitle.zh} ${item.chapter}`;

                      return (
                        <div key={item.id} className="py-4 first:pt-4 last:pb-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                              <span className="font-semibold text-[#1E3A5F] dark:text-[#7DA2D1]">
                                {uiLang === 'zh'
                                  ? `${refZh} · ${refEn}`
                                  : `${refEn} · ${refZh}`}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {uiLang === 'zh'
                                  ? item.volumeTitle.zh
                                  : item.volumeTitle.en}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.source}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenSearchResult(item)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                            >
                              <span>{t.openInReader}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p
                            className={`text-sm sm:text-base leading-relaxed ${
                              item.matchedLang === 'zh'
                                ? "font-['Noto_Serif_TC','Source_Serif_4',serif] text-neutral-900 dark:text-neutral-100"
                                : "font-['Source_Serif_4',Georgia,serif] text-neutral-600 dark:text-neutral-400"
                            }`}
                          >
                            {renderHighlightedSnippet(
                              item.snippet,
                              searchResponse.query
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {(searchResponse.page > 1 || searchResponse.hasMore) && (
                    <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={searchResponse.page <= 1}
                        onClick={() =>
                          executeSearch(
                            searchResponse.query,
                            searchResponse.volume,
                            searchResponse.page - 1
                          )
                        }
                        className="h-9 px-3.5 rounded-md border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                      >
                        {t.prevPage}
                      </button>
                      <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        {searchResponse.page}
                      </span>
                      <button
                        type="button"
                        disabled={!searchResponse.hasMore}
                        onClick={() =>
                          executeSearch(
                            searchResponse.query,
                            searchResponse.volume,
                            searchResponse.page + 1
                          )
                        }
                        className="h-9 px-3.5 rounded-md border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                      >
                        {t.nextPage}
                      </button>
                    </div>
                  )}
                </>
              )}
          </section>
        )}

        {/* Chapter Masthead */}
        <header className="mb-8 pb-6 border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              {/* Unboxed editorial metadata with typographic separators */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-2">
                <span>
                  {uiLang === 'zh' ? currentVolume.zh : currentVolume.en}
                </span>
                {chapterData && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {t.versesCount(chapterData.verses.length)}
                    </span>
                  </>
                )}
                {chapterData?.sources.zh && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{chapterData.sources.zh}</span>
                  </>
                )}
              </div>

              <h1
                className="font-['Cormorant_Garamond','Noto_Serif_TC',serif] text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-100"
                style={{ textWrap: 'balance' }}
              >
                {primaryTitle}
              </h1>
              <p className="mt-1 font-['Source_Serif_4','Noto_Serif_TC',serif] text-base sm:text-lg text-stone-500 dark:text-stone-400">
                {secondaryTitle}
              </p>
            </div>

            {/* Top Chapter Prev/Next Links & Notes Summary Toggle */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {studyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setChapterNotesOpen((prev) => !prev);
                    setConfirmClearAll(false);
                  }}
                  aria-expanded={chapterNotesOpen}
                  className={`h-10 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                    chapterNotesOpen
                      ? 'border-[#1E3A5F] dark:border-[#7DA2D1] bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315]'
                      : 'border-[#1E3A5F]/30 dark:border-[#7DA2D1]/35 bg-[#EFE8D8]/80 dark:bg-[#1E2530] text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#E7DEC9] dark:hover:bg-[#252E3C]'
                  }`}
                >
                  <StickyNote className="w-3.5 h-3.5" />
                  <span>{t.chapterStudyButton(studyItems.length)}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigateTo(prevTarget)}
                disabled={!prevTarget}
                className="h-10 px-3.5 rounded-md border border-stone-300/80 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t.prevChapter}</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo(nextTarget)}
                disabled={!nextTarget}
                className="h-10 px-3.5 rounded-md border border-stone-300/80 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 disabled:opacity-35 disabled:pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <span>{t.nextChapter}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bilingual Chapter Heading Summary & Section Intro */}
          {hasAnyHeadingSummary &&
            !loading &&
            (() => {
              const hasEnBlock = Boolean(enIntro || enSummary);
              const hasZhBlock = Boolean(zhIntro || zhSummary);

              const enHeadingBlock = hasEnBlock ? (
                <div key="en-summary" className="space-y-1.5 min-w-0">
                  {enIntro && (
                    <p className="font-['Source_Serif_4',Georgia,serif] text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {enIntro}
                    </p>
                  )}
                  {enSummary && (
                    <p className="font-['Source_Serif_4',Georgia,serif] text-sm sm:text-base italic text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {enSummary}
                    </p>
                  )}
                </div>
              ) : null;

              const zhHeadingBlock = hasZhBlock ? (
                <div key="zh-summary" className="space-y-1.5 min-w-0">
                  {zhIntro && (
                    <p className="font-['Noto_Serif_TC','Source_Serif_4',serif] text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      {zhIntro}
                    </p>
                  )}
                  {zhSummary && (
                    <p className="font-['Noto_Serif_TC','Source_Serif_4',serif] text-sm sm:text-base text-neutral-800 dark:text-neutral-200 leading-relaxed">
                      <span>{zhSummary}</span>
                      {isZhSummaryTranslated && (
                        <span className="ml-1.5 font-['Plus_Jakarta_Sans',sans-serif] not-italic text-xs text-stone-500 dark:text-stone-400">
                          {t.googleTranslatedLabel}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : null;

              return (
                <div className="mt-5 pt-4 border-t border-stone-200/70 dark:border-stone-800/80">
                  {displayMode === 'parallel' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                      {enHeadingBlock ?? <div className="hidden md:block" />}
                      {zhHeadingBlock}
                    </div>
                  )}

                  {displayMode === 'interleaved' && (
                    <div className="space-y-2.5 max-w-4xl">
                      {uiLang === 'zh'
                        ? [zhHeadingBlock, enHeadingBlock]
                        : [enHeadingBlock, zhHeadingBlock]}
                    </div>
                  )}

                  {displayMode === 'en-only' && (
                    <div className="max-w-4xl">
                      {enHeadingBlock || zhHeadingBlock}
                    </div>
                  )}

                  {displayMode === 'zh-only' && (
                    <div className="max-w-4xl">
                      {zhHeadingBlock || enHeadingBlock}
                    </div>
                  )}
                </div>
              );
            })()}
        </header>

        {/* Chapter Highlights & Notes Drawer */}
        {chapterNotesOpen && studyItems.length > 0 && (
          <section
            aria-label={t.chapterStudyHeading}
            className="mb-8 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#181A1E] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
              <h2 className="font-['Cormorant_Garamond','Noto_Serif_TC',serif] text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100">
                {t.chapterStudyHeading}
              </h2>

              <div className="flex items-center gap-2">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.clearAllStudy}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={clearAllChapterStudyItems}
                      className="h-8 px-2.5 rounded bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 whitespace-nowrap cursor-pointer"
                    >
                      {t.confirmClearAllStudy}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 whitespace-nowrap cursor-pointer"
                    >
                      {t.closeSearch}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setChapterNotesOpen(false)}
                  className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t.closeSearch}</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-stone-200/80 dark:divide-stone-800 mt-1">
              {[...studyItems]
                .sort((a, b) => {
                  if (a.verse !== b.verse) return a.verse - b.verse;
                  if (a.scope !== b.scope) return a.scope === 'verse' ? -1 : 1;
                  return (a.start ?? 0) - (b.start ?? 0);
                })
                .map((item) => {
                  const colorMeta = item.color ? HIGHLIGHT_PALETTE[item.color] : null;
                  const refLabel =
                    uiLang === 'zh'
                      ? `${currentBook.zh} ${chapter}:${item.verse}`
                      : `${currentBook.en} ${chapter}:${item.verse}`;

                  return (
                    <div
                      key={item.id}
                      className="py-3 first:pt-3 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                          <span className="font-semibold text-[#1E3A5F] dark:text-[#7DA2D1] tabular-nums">
                            {refLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {item.scope === 'verse'
                              ? t.wholeVerseLabel
                              : `${t.selectedWordingLabel} (${
                                  item.lang === 'zh' ? t.chineseHeader : t.englishHeader
                                })`}
                          </span>
                          {colorMeta && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-stone-700 dark:text-stone-300">
                                <span
                                  aria-hidden="true"
                                  className={`w-2.5 h-2.5 rounded-xs border ${colorMeta.swatchClass}`}
                                />
                                <span>
                                  {uiLang === 'zh'
                                    ? colorMeta.labelZh
                                    : colorMeta.labelEn}
                                </span>
                              </span>
                            </>
                          )}
                        </div>

                        {item.scope === 'selection' && item.selectedText && (
                          <p
                            className={`text-xs sm:text-sm italic px-2 py-0.5 rounded inline-block max-w-full ${
                              colorMeta
                                ? colorMeta.inlineMarkClass
                                : 'bg-stone-200/70 dark:bg-stone-800/80'
                            } text-stone-800 dark:text-stone-200`}
                          >
                            “{item.selectedText}”
                          </p>
                        )}

                        {item.note.trim() ? (
                          <p className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                            {item.note}
                          </p>
                        ) : (
                          <p className="text-xs italic text-stone-400 dark:text-stone-500">
                            {t.highlightOnlyLabel}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStudyVerse(item.verse);
                            setStudyDraft(null);
                            const el = document.getElementById(`v-${item.verse}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap cursor-pointer"
                        >
                          {t.jumpToVerse}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleEditStudyItem(item);
                            const el = document.getElementById(`v-${item.verse}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap cursor-pointer"
                        >
                          {t.editAction}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudyItem(item.id)}
                          className="h-8 px-2 rounded text-xs text-stone-500 dark:text-stone-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap cursor-pointer"
                        >
                          {t.removeAction}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Active Study Return Banner (when jumped from a footnote cross-reference) */}
        {studyHistory.length > 0 && (
          <div
            role="region"
            aria-label={t.studyTrailLabel}
            className="mb-6 px-4 py-3 rounded-lg border border-[#1E3A5F]/25 dark:border-[#7DA2D1]/30 bg-[#EFE8D8]/75 dark:bg-[#1A2029] flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
              <span>{t.studyTrailLabel}</span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                {uiLang === 'zh'
                  ? studyHistory[studyHistory.length - 1].labelZh
                  : studyHistory[studyHistory.length - 1].labelEn}
              </span>
              {studyHistory.length > 1 && (
                <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                  ({studyHistory.length})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleReturnToStudy}
              className="h-9 px-3.5 rounded-md bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] text-xs font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                {t.returnToStudy(
                  uiLang === 'zh'
                    ? studyHistory[studyHistory.length - 1].labelZh
                    : studyHistory[studyHistory.length - 1].labelEn
                )}
              </span>
            </button>
          </div>
        )}

        {/* Partial Fetch Warning Banner (non-blocking) */}
        {!loading &&
          chapterData &&
          (chapterData.partial.enMissing || chapterData.partial.zhMissing) && (
            <div
              role="status"
              className="mb-6 p-4 rounded-lg border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="text-sm text-amber-900 dark:text-amber-200">
                {chapterData.partial.enMissing && <p>{t.partialEnMissing}</p>}
                {chapterData.partial.zhMissing && <p>{t.partialZhMissing}</p>}
              </div>
              <button
                type="button"
                onClick={() => fetchChapter(currentBook.key, chapter, true)}
                className="h-9 px-3.5 rounded-md border border-amber-400/70 dark:border-amber-700 bg-white dark:bg-[#181A1E] text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.retry}</span>
              </button>
            </div>
          )}

        {/* Loading State */}
        {loading && (
          <div aria-live="polite" className="space-y-5 py-4">
            <p className="text-sm text-stone-500 dark:text-stone-400">{t.loading}</p>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 border-b border-stone-200/60 dark:border-stone-800/60 animate-pulse"
                >
                  <div className="space-y-2">
                    <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-11/12" />
                    <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-10/12" />
                    <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && errorState && (
          <div
            role="alert"
            className="max-w-xl mx-auto my-12 p-6 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#181A1E] text-center"
          >
            <h2 className="font-['Cormorant_Garamond','Noto_Serif_TC',serif] text-2xl font-semibold text-stone-900 dark:text-stone-100">
              {t.errorTitle}
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              {errorState.error}
            </p>
            {errorState.retryable && (
              <button
                type="button"
                onClick={() => fetchChapter(currentBook.key, chapter, true)}
                className="mt-5 h-10 px-5 rounded-md bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t.retry}</span>
              </button>
            )}
          </div>
        )}

        {/* Verses Content */}
        {!loading && !errorState && chapterData && (
          <article aria-label={primaryTitle}>
            {(() => {
              const renderAnnotatedTextSlices = (
                segStart: number,
                segEnd: number,
                fullText: string,
                selectionAnns: VerseStudyAnnotation[],
                extraClassName?: string
              ): React.ReactNode => {
                const slices = sliceSegmentByAnnotations(
                  segStart,
                  segEnd,
                  fullText,
                  selectionAnns
                );

                return slices.map((slice, sIdx) => {
                  const primary = slice.primaryAnnotation;
                  const colorMeta = primary?.color
                    ? HIGHLIGHT_PALETTE[primary.color]
                    : null;
                  const hasNoteOnlyUnderline =
                    Boolean(primary) && !primary?.color && Boolean(primary?.note.trim());

                  const sliceClasses = [
                    extraClassName,
                    colorMeta ? colorMeta.inlineMarkClass : '',
                    hasNoteOnlyUnderline
                      ? 'underline decoration-dotted decoration-[#1E3A5F]/75 dark:decoration-[#7DA2D1]/80 underline-offset-4'
                      : '',
                    primary ? 'cursor-pointer transition-colors' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const handleAnnotatedSliceClick = primary
                    ? (e: React.MouseEvent) => {
                        const sel = window.getSelection();
                        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
                          return;
                        }
                        e.stopPropagation();
                        handleEditStudyItem(primary);
                      }
                    : undefined;

                  return (
                    <React.Fragment key={`${slice.start}-${slice.end}-${sIdx}`}>
                      {primary ? (
                        <mark
                          onClick={handleAnnotatedSliceClick}
                          title={primary.note.trim() ? primary.note : undefined}
                          className={`${sliceClasses} ${
                            !colorMeta ? 'bg-transparent text-inherit' : ''
                          }`}
                        >
                          {slice.text}
                        </mark>
                      ) : extraClassName ? (
                        <span className={extraClassName}>{slice.text}</span>
                      ) : (
                        <>{slice.text}</>
                      )}

                      {slice.endingNotes.map((noteAnn) => (
                        <button
                          key={`badge-${noteAnn.id}`}
                          type="button"
                          data-annotation-badge="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStudyItem(noteAnn);
                          }}
                          aria-label={t.selectionNoteBadgeAria}
                          title={noteAnn.note}
                          className="select-none inline-flex items-center justify-center align-super text-[0.68em] leading-none px-1 py-0.5 ml-0.5 rounded-xs border border-[#1E3A5F]/35 dark:border-[#7DA2D1]/45 bg-[#EFE8D8] dark:bg-[#1E2530] text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#1E3A5F] hover:text-white dark:hover:bg-[#7DA2D1] dark:hover:text-[#111315] transition-colors cursor-pointer"
                        >
                          <StickyNote className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </React.Fragment>
                  );
                });
              };

              const renderVerseSegments = (
                segments: VerseSegment[] | undefined,
                fallbackText: string,
                lang: 'en' | 'zh',
                verseNum: number
              ): React.ReactNode => {
                const selectionAnns =
                  selectionItemsByVerseLang.get(`${verseNum}:${lang}`) || [];
                const fullText = getVersePlainText(segments, fallbackText);

                if (!segments || segments.length === 0) {
                  if (!fullText) {
                    return (
                      <span className="text-sm italic text-stone-400 dark:text-stone-500">
                        —
                      </span>
                    );
                  }
                  return renderAnnotatedTextSlices(
                    0,
                    fullText.length,
                    fullText,
                    selectionAnns
                  );
                }

                let cursor = 0;
                return segments.map((seg, idx) => {
                  const segStart = cursor;
                  const segEnd = cursor + seg.text.length;
                  cursor = segEnd;

                  if (seg.type === 'text') {
                    return (
                      <React.Fragment key={idx}>
                        {renderAnnotatedTextSlices(
                          segStart,
                          segEnd,
                          fullText,
                          selectionAnns
                        )}
                      </React.Fragment>
                    );
                  }

                  const noteId = seg.noteId;
                  const marker = seg.marker;
                  const isActive =
                    Boolean(noteId) &&
                    activeFootnote?.verse === verseNum &&
                    activeFootnote?.lang === lang &&
                    activeFootnote?.noteId === noteId;

                  if (!noteId || !marker) {
                    return (
                      <React.Fragment key={idx}>
                        {renderAnnotatedTextSlices(
                          segStart,
                          segEnd,
                          fullText,
                          selectionAnns
                        )}
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={`${noteId}-${idx}`}>
                      <button
                        type="button"
                        data-footnote-marker="true"
                        onClick={() => handleFootnoteClick(verseNum, lang, noteId)}
                        aria-expanded={isActive}
                        aria-label={t.footnoteOpenAria(marker, seg.text)}
                        className={`select-none inline-flex items-center justify-center align-super text-[0.7em] font-['Plus_Jakarta_Sans',sans-serif] font-semibold leading-none px-1 py-0.5 mr-0.5 rounded-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                          isActive
                            ? 'bg-[#1E3A5F] text-white dark:bg-[#7DA2D1] dark:text-[#111315]'
                            : 'text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#1E3A5F]/12 dark:hover:bg-[#7DA2D1]/20'
                        }`}
                      >
                        {marker}
                      </button>
                      {renderAnnotatedTextSlices(
                        segStart,
                        segEnd,
                        fullText,
                        selectionAnns,
                        isActive
                          ? 'underline decoration-[#1E3A5F]/55 dark:decoration-[#7DA2D1]/60 underline-offset-4'
                          : undefined
                      )}
                    </React.Fragment>
                  );
                });
              };

              const renderFootnotePanel = (verse: AlignedVerse) => {
                if (!activeFootnote || activeFootnote.verse !== verse.verse) {
                  return null;
                }
                const { lang, noteId } = activeFootnote;
                const langNotes =
                  lang === 'en'
                    ? chapterData.footnotes?.en
                    : chapterData.footnotes?.zh;
                const segments = lang === 'en' ? verse.enSegments : verse.zhSegments;
                const verseNoteRefs = (segments || []).filter(
                  (s): s is VerseSegment & { noteId: string; marker: string } =>
                    s.type === 'note' && Boolean(s.noteId) && Boolean(s.marker)
                );
                const note: ScriptureFootnote | undefined = langNotes?.[noteId];

                return (
                  <div
                    role="region"
                    aria-label={t.footnoteHeading}
                    className="mt-3 pt-3 border-t border-stone-300/70 dark:border-stone-700/80"
                  >
                    <div className="rounded-md border border-stone-200 dark:border-stone-700/80 bg-[#FAF8F4] dark:bg-[#111315] p-3.5 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-stone-200/80 dark:border-stone-800">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mr-1">
                            {t.footnoteHeading} ({lang === 'en' ? t.englishHeader : t.chineseHeader})
                          </span>
                          {verseNoteRefs.map((refSeg) => {
                            const selected = refSeg.noteId === noteId;
                            return (
                              <button
                                key={refSeg.noteId}
                                type="button"
                                onClick={() =>
                                  setActiveFootnote({
                                    verse: verse.verse,
                                    lang,
                                    noteId: refSeg.noteId,
                                  })
                                }
                                className={`h-7 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-[#1E3A5F] text-white dark:bg-[#7DA2D1] dark:text-[#111315]'
                                    : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300/70 dark:hover:bg-stone-700'
                                }`}
                              >
                                {refSeg.marker} · {refSeg.text}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveFootnote(null)}
                          aria-label={t.footnoteClose}
                          className="h-7 px-2 rounded text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t.closeSearch}</span>
                        </button>
                      </div>

                      {note ? (
                        <div
                          className={`text-sm sm:text-[15px] leading-relaxed ${
                            lang === 'zh'
                              ? "font-['Noto_Serif_TC','Source_Serif_4',serif] text-neutral-900 dark:text-neutral-100"
                              : "font-['Source_Serif_4',Georgia,serif] text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          <span className="font-['Plus_Jakarta_Sans',sans-serif] font-semibold text-xs text-[#1E3A5F] dark:text-[#7DA2D1] mr-2 tabular-nums">
                            {note.fullMarker}
                          </span>
                          {note.parts.map((part, pIdx) => {
                            if (part.type === 'ref' && part.book && part.chapter) {
                              const targetBook = part.book;
                              const targetChapter = part.chapter;
                              const targetVerse = part.verse ?? null;
                              return (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() =>
                                    handleJumpToFootnoteRef(
                                      targetBook,
                                      targetChapter,
                                      targetVerse,
                                      verse.verse,
                                      lang,
                                      note.id,
                                      note.marker
                                    )
                                  }
                                  title={t.jumpToRefTitle(part.text)}
                                  className="inline font-medium text-[#1E3A5F] dark:text-[#7DA2D1] underline underline-offset-4 decoration-[#1E3A5F]/40 dark:decoration-[#7DA2D1]/45 hover:decoration-[#1E3A5F] dark:hover:decoration-[#7DA2D1] hover:bg-[#1E3A5F]/8 dark:hover:bg-[#7DA2D1]/12 rounded-xs px-0.5 transition-colors cursor-pointer"
                                >
                                  {part.text}
                                </button>
                              );
                            }

                            if (part.type === 'external' && part.url) {
                              return (
                                <a
                                  key={pIdx}
                                  href={part.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-baseline gap-0.5 text-stone-700 dark:text-stone-300 underline underline-offset-4 decoration-stone-400/60 hover:text-[#1E3A5F] dark:hover:text-[#7DA2D1]"
                                >
                                  <span>{part.text}</span>
                                  <ExternalLink className="w-3 h-3 inline self-center shrink-0 opacity-70" />
                                </a>
                              );
                            }

                            return <React.Fragment key={pIdx}>{part.text}</React.Fragment>;
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-500 dark:text-stone-400">
                          {t.footnoteMissing}
                        </p>
                      )}
                    </div>
                  </div>
                );
              };

              const renderVerseStudyPanel = (verseNumber: number) => {
                if (activeStudyVerse !== verseNumber) return null;
                return (
                  <VerseStudyPanel
                    verse={verseNumber}
                    uiLang={uiLang}
                    items={studyItemsByVerse.get(verseNumber) || []}
                    draft={studyDraft}
                    onChangeDraft={setStudyDraft}
                    onSaveDraft={handleSaveStudyDraft}
                    onCancelDraft={() => setStudyDraft(null)}
                    onStartNewVerseNote={handleStartNewVerseNote}
                    onEditItem={handleEditStudyItem}
                    onChangeItemColor={handleChangeItemColor}
                    onDeleteItem={handleDeleteStudyItem}
                    onClosePanel={() => {
                      setActiveStudyVerse(null);
                      setStudyDraft(null);
                    }}
                  />
                );
              };

              const getVerseVisualMeta = (verseNum: number) => {
                const wholeItem = verseLevelByVerse.get(verseNum);
                const wholeColor = wholeItem?.color ?? null;
                const isHighlighted = wholeColor !== null;
                const colorConfig = wholeColor ? HIGHLIGHT_PALETTE[wholeColor] : null;
                const verseItems = studyItemsByVerse.get(verseNum) || [];
                const noteCount = verseItems.filter(
                  (item) => item.note.trim().length > 0
                ).length;
                const hasAnyStudy = verseItems.length > 0;
                return {
                  isHighlighted,
                  colorConfig,
                  verseItems,
                  noteCount,
                  hasAnyStudy,
                };
              };

              return (
                <>
                  {/* Parallel Mode (Side-by-side on md+, stacked on narrow) */}
                  {displayMode === 'parallel' && (
                    <div>
                      {/* Desktop Column Headers */}
                      <div className="hidden md:grid md:grid-cols-[3.5rem_1fr_1fr] gap-8 pb-3 mb-2 border-b border-stone-200 dark:border-stone-800 text-xs font-medium">
                        <span aria-hidden="true" />
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {t.englishHeader}
                        </span>
                        <span className="text-neutral-900 dark:text-neutral-100">
                          {t.chineseHeader}
                        </span>
                      </div>

                      <div className="divide-y divide-stone-200/75 dark:divide-stone-800/75">
                        {chapterData.verses.map((v) => {
                          const {
                            isHighlighted,
                            colorConfig,
                            noteCount,
                            hasAnyStudy,
                          } = getVerseVisualMeta(v.verse);
                          const hasOpenFootnote = activeFootnote?.verse === v.verse;
                          const hasOpenStudy = activeStudyVerse === v.verse;
                          const enPlain = getVersePlainText(v.enSegments, v.en);
                          const zhPlain = getVersePlainText(v.zhSegments, v.zh);

                          return (
                            <div
                              key={v.verse}
                              id={`v-${v.verse}`}
                              className={`group py-4 px-3 -mx-3 rounded-md transition-colors ${
                                colorConfig
                                  ? colorConfig.verseContainerClass
                                  : 'hover:bg-stone-200/35 dark:hover:bg-stone-800/30'
                              }`}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-[3.5rem_1fr_1fr] gap-3 md:gap-8">
                                <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start md:gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleVerseHighlight(v.verse)}
                                    aria-pressed={isHighlighted}
                                    aria-label={
                                      isHighlighted
                                        ? t.unhighlightVerse(v.verse)
                                        : t.highlightVerse(v.verse)
                                    }
                                    title={
                                      isHighlighted
                                        ? t.unhighlightVerse(v.verse)
                                        : t.highlightVerse(v.verse)
                                    }
                                    className={`inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2 rounded text-sm font-semibold tabular-nums transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                      colorConfig
                                        ? colorConfig.verseNumberActiveClass
                                        : 'text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#1E3A5F]/12 dark:hover:bg-[#7DA2D1]/18'
                                    }`}
                                  >
                                    {v.verse}
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleVerseStudyPanel(v.verse)}
                                      aria-expanded={hasOpenStudy}
                                      aria-label={t.annotateVerse(v.verse)}
                                      title={t.annotateVerse(v.verse)}
                                      className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded text-xs transition-all cursor-pointer tabular-nums focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                        hasOpenStudy || noteCount > 0 || hasAnyStudy
                                          ? 'text-[#1E3A5F] dark:text-[#7DA2D1] bg-white/80 dark:bg-[#111315]/80 border border-stone-300/80 dark:border-stone-700 opacity-100'
                                          : 'text-stone-500 dark:text-stone-400 hover:text-[#1E3A5F] dark:hover:text-[#7DA2D1] hover:bg-stone-200/60 dark:hover:bg-stone-800 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                                      }`}
                                    >
                                      {noteCount > 0 ? (
                                        <>
                                          <StickyNote className="w-3.5 h-3.5" />
                                          <span>{noteCount}</span>
                                        </>
                                      ) : (
                                        <MessageSquarePlus className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    {isHighlighted && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyVerse(v)}
                                        className="md:hidden inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] cursor-pointer"
                                      >
                                        {copiedVerse === v.verse ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>{t.copied}</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t.copyVerse}</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p
                                  data-verse-text="true"
                                  data-verse={v.verse}
                                  data-lang="en"
                                  data-full-text={enPlain}
                                  className={`font-['Source_Serif_4',Georgia,serif] dark:tracking-[0.01em] ${
                                    isHighlighted
                                      ? 'text-neutral-700 dark:text-neutral-300'
                                      : 'text-neutral-600 dark:text-neutral-400'
                                  }`}
                                  style={enFontStyle}
                                >
                                  {renderVerseSegments(v.enSegments, v.en, 'en', v.verse)}
                                </p>

                                <div className="flex flex-col justify-between gap-2">
                                  <p
                                    data-verse-text="true"
                                    data-verse={v.verse}
                                    data-lang="zh"
                                    data-full-text={zhPlain}
                                    className="font-['Noto_Serif_TC','Source_Serif_4',serif] text-neutral-900 dark:text-neutral-100 dark:tracking-[0.015em]"
                                    style={zhFontStyle}
                                  >
                                    {renderVerseSegments(v.zhSegments, v.zh, 'zh', v.verse)}
                                  </p>
                                  {isHighlighted && (
                                    <div className="hidden md:flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyVerse(v)}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                                      >
                                        {copiedVerse === v.verse ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>{t.copied}</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t.copyVerse}</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {(hasOpenFootnote || hasOpenStudy) && (
                                <div className="md:pl-[5.5rem]">
                                  {hasOpenFootnote && renderFootnotePanel(v)}
                                  {renderVerseStudyPanel(v.verse)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interleaved Mode (zh first when uiLang === 'zh', en first when uiLang === 'en') */}
                  {displayMode === 'interleaved' && (
                    <div className="max-w-3xl mx-auto divide-y divide-stone-200/75 dark:divide-stone-800/75">
                      {chapterData.verses.map((v) => {
                        const {
                          isHighlighted,
                          colorConfig,
                          noteCount,
                          hasAnyStudy,
                        } = getVerseVisualMeta(v.verse);
                        const hasOpenStudy = activeStudyVerse === v.verse;
                        const zhFirst = uiLang === 'zh';
                        const enPlain = getVersePlainText(v.enSegments, v.en);
                        const zhPlain = getVersePlainText(v.zhSegments, v.zh);

                        const enBlock = (
                          <p
                            key="en"
                            data-verse-text="true"
                            data-verse={v.verse}
                            data-lang="en"
                            data-full-text={enPlain}
                            className={`font-['Source_Serif_4',Georgia,serif] dark:tracking-[0.01em] ${
                              isHighlighted
                                ? 'text-neutral-700 dark:text-neutral-300'
                                : 'text-neutral-600 dark:text-neutral-400'
                            }`}
                            style={enFontStyle}
                          >
                            {renderVerseSegments(v.enSegments, v.en, 'en', v.verse)}
                          </p>
                        );

                        const zhBlock = (
                          <p
                            key="zh"
                            data-verse-text="true"
                            data-verse={v.verse}
                            data-lang="zh"
                            data-full-text={zhPlain}
                            className="font-['Noto_Serif_TC','Source_Serif_4',serif] text-neutral-900 dark:text-neutral-100 dark:tracking-[0.015em]"
                            style={zhFontStyle}
                          >
                            {renderVerseSegments(v.zhSegments, v.zh, 'zh', v.verse)}
                          </p>
                        );

                        return (
                          <div
                            key={v.verse}
                            id={`v-${v.verse}`}
                            className={`group py-5 px-3.5 -mx-3.5 rounded-md transition-colors ${
                              colorConfig
                                ? colorConfig.verseContainerClass
                                : 'hover:bg-stone-200/35 dark:hover:bg-stone-800/30'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex flex-col items-center gap-1.5 shrink-0 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleVerseHighlight(v.verse)}
                                  aria-pressed={isHighlighted}
                                  aria-label={
                                    isHighlighted
                                      ? t.unhighlightVerse(v.verse)
                                      : t.highlightVerse(v.verse)
                                  }
                                  title={
                                    isHighlighted
                                      ? t.unhighlightVerse(v.verse)
                                      : t.highlightVerse(v.verse)
                                  }
                                  className={`inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2 rounded text-sm font-semibold tabular-nums transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                    colorConfig
                                      ? colorConfig.verseNumberActiveClass
                                      : 'text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#1E3A5F]/12 dark:hover:bg-[#7DA2D1]/18'
                                  }`}
                                >
                                  {v.verse}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleVerseStudyPanel(v.verse)}
                                  aria-expanded={hasOpenStudy}
                                  aria-label={t.annotateVerse(v.verse)}
                                  title={t.annotateVerse(v.verse)}
                                  className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded text-xs transition-all cursor-pointer tabular-nums focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                    hasOpenStudy || noteCount > 0 || hasAnyStudy
                                      ? 'text-[#1E3A5F] dark:text-[#7DA2D1] bg-white/80 dark:bg-[#111315]/80 border border-stone-300/80 dark:border-stone-700 opacity-100'
                                      : 'text-stone-500 dark:text-stone-400 hover:text-[#1E3A5F] dark:hover:text-[#7DA2D1] hover:bg-stone-200/60 dark:hover:bg-stone-800 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                                  }`}
                                >
                                  {noteCount > 0 ? (
                                    <>
                                      <StickyNote className="w-3.5 h-3.5" />
                                      <span>{noteCount}</span>
                                    </>
                                  ) : (
                                    <MessageSquarePlus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              <div className="space-y-2.5 flex-1 min-w-0">
                                {zhFirst ? [zhBlock, enBlock] : [enBlock, zhBlock]}
                                {renderFootnotePanel(v)}
                                {renderVerseStudyPanel(v.verse)}
                                {isHighlighted && (
                                  <div className="pt-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyVerse(v)}
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                                    >
                                      {copiedVerse === v.verse ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>{t.copied}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>{t.copyVerse}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Single-Language Views (EN-only or ZH-only) */}
                  {(displayMode === 'en-only' || displayMode === 'zh-only') && (
                    <div className="max-w-2xl mx-auto space-y-3">
                      {chapterData.verses.map((v) => {
                        const {
                          isHighlighted,
                          colorConfig,
                          noteCount,
                          hasAnyStudy,
                        } = getVerseVisualMeta(v.verse);
                        const hasOpenStudy = activeStudyVerse === v.verse;
                        const isEn = displayMode === 'en-only';
                        const plainText = isEn
                          ? getVersePlainText(v.enSegments, v.en)
                          : getVersePlainText(v.zhSegments, v.zh);

                        return (
                          <div
                            key={v.verse}
                            id={`v-${v.verse}`}
                            className={`group py-3 px-3.5 -mx-3.5 rounded-md transition-colors ${
                              colorConfig
                                ? colorConfig.verseContainerClass
                                : 'hover:bg-stone-200/35 dark:hover:bg-stone-800/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                                <button
                                  type="button"
                                  onClick={() => toggleVerseHighlight(v.verse)}
                                  aria-pressed={isHighlighted}
                                  aria-label={
                                    isHighlighted
                                      ? t.unhighlightVerse(v.verse)
                                      : t.highlightVerse(v.verse)
                                  }
                                  title={
                                    isHighlighted
                                      ? t.unhighlightVerse(v.verse)
                                      : t.highlightVerse(v.verse)
                                  }
                                  className={`inline-flex items-center justify-center min-w-[2rem] h-7 px-1.5 rounded text-xs font-semibold tabular-nums transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                    colorConfig
                                      ? colorConfig.verseNumberActiveClass
                                      : 'text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-[#1E3A5F]/12 dark:hover:bg-[#7DA2D1]/18'
                                  }`}
                                >
                                  {v.verse}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleVerseStudyPanel(v.verse)}
                                  aria-expanded={hasOpenStudy}
                                  aria-label={t.annotateVerse(v.verse)}
                                  title={t.annotateVerse(v.verse)}
                                  className={`inline-flex items-center justify-center gap-0.5 h-6 px-1.5 rounded text-[11px] transition-all cursor-pointer tabular-nums focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] ${
                                    hasOpenStudy || noteCount > 0 || hasAnyStudy
                                      ? 'text-[#1E3A5F] dark:text-[#7DA2D1] bg-white/80 dark:bg-[#111315]/80 border border-stone-300/80 dark:border-stone-700 opacity-100'
                                      : 'text-stone-500 dark:text-stone-400 hover:text-[#1E3A5F] dark:hover:text-[#7DA2D1] hover:bg-stone-200/60 dark:hover:bg-stone-800 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                                  }`}
                                >
                                  {noteCount > 0 ? (
                                    <>
                                      <StickyNote className="w-3 h-3" />
                                      <span>{noteCount}</span>
                                    </>
                                  ) : (
                                    <MessageSquarePlus className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  data-verse-text="true"
                                  data-verse={v.verse}
                                  data-lang={isEn ? 'en' : 'zh'}
                                  data-full-text={plainText}
                                  className={
                                    isEn
                                      ? `font-['Source_Serif_4',Georgia,serif] dark:tracking-[0.01em] ${
                                          isHighlighted
                                            ? 'text-neutral-700 dark:text-neutral-300'
                                            : 'text-neutral-600 dark:text-neutral-400'
                                        }`
                                      : "font-['Noto_Serif_TC','Source_Serif_4',serif] text-neutral-900 dark:text-neutral-100 dark:tracking-[0.015em]"
                                  }
                                  style={isEn ? enFontStyle : zhFontStyle}
                                >
                                  {isEn
                                    ? renderVerseSegments(v.enSegments, v.en, 'en', v.verse)
                                    : renderVerseSegments(v.zhSegments, v.zh, 'zh', v.verse)}
                                </p>
                                {renderFootnotePanel(v)}
                                {renderVerseStudyPanel(v.verse)}
                                {isHighlighted && (
                                  <div className="mt-2 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyVerse(v)}
                                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#111315] hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                                    >
                                      {copiedVerse === v.verse ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>{t.copied}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>{t.copyVerse}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </article>
        )}

        {/* Bottom Chapter Navigation */}
        <footer className="mt-14 pt-8 border-t border-stone-200 dark:border-stone-800 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            {prevTarget ? (
              <button
                type="button"
                onClick={() => navigateTo(prevTarget)}
                className="min-h-11 px-4 py-2.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#181A1E] hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition-colors inline-flex items-center gap-3 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-stone-500 shrink-0" />
                <div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    {t.prevChapter}
                  </div>
                  <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {formatTargetLabel(prevTarget)}
                  </div>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextTarget ? (
              <button
                type="button"
                onClick={() => navigateTo(nextTarget)}
                className="min-h-11 px-4 py-2.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#181A1E] hover:bg-stone-100 dark:hover:bg-stone-800 text-right transition-colors inline-flex items-center gap-3 cursor-pointer"
              >
                <div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    {t.nextChapter}
                  </div>
                  <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    {formatTargetLabel(nextTarget)}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>{t.keyboardHint}</span>
            <button
              type="button"
              onClick={() => fetchChapter(currentBook.key, chapter, true)}
              className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.refresh}</span>
            </button>
          </div>
        </footer>
      </main>

      {/* Floating Return to Original Study Button (visible whenever cross-referencing from a footnote) */}
      {studyHistory.length > 0 && (
        <button
          type="button"
          onClick={handleReturnToStudy}
          className="fixed bottom-5 left-5 z-30 h-11 px-4 rounded-lg border border-[#1E3A5F]/35 dark:border-[#7DA2D1]/40 bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] shadow-sm hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap max-w-[60vw] truncate cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {t.returnToStudy(
              uiLang === 'zh'
                ? studyHistory[studyHistory.length - 1].labelZh
                : studyHistory[studyHistory.length - 1].labelEn
            )}
          </span>
        </button>
      )}

      {/* Floating Selection Action Toolbar (Highlight / Annotate Selected Wording) */}
      {selectionToolbar &&
        (() => {
          const rect = selectionToolbar.rect;
          const isNarrowViewport =
            typeof window !== 'undefined' && window.innerWidth < 768;
          const placeBelow = isNarrowViewport || rect.top < 120;
          const rawTop = placeBelow ? rect.bottom + 10 : rect.top - 56;
          const clampedTop =
            typeof window !== 'undefined'
              ? Math.max(64, Math.min(rawTop, window.innerHeight - 68))
              : rawTop;
          const estimatedWidth = 310;
          const rawLeft = rect.left + rect.width / 2 - estimatedWidth / 2;
          const clampedLeft =
            typeof window !== 'undefined'
              ? Math.max(12, Math.min(rawLeft, window.innerWidth - estimatedWidth - 12))
              : rawLeft;

          return (
            <div
              data-selection-toolbar="true"
              role="toolbar"
              aria-label={t.highlightSelectionTitle(
                uiLang === 'zh' ? '選取字詞' : 'Selected text'
              )}
              onMouseDown={(e) => e.preventDefault()}
              style={{ top: `${clampedTop}px`, left: `${clampedLeft}px` }}
              className="fixed z-40 rounded-lg border border-stone-300 dark:border-stone-700 bg-white/95 dark:bg-[#181A1E]/95 backdrop-blur-sm shadow-md px-2.5 py-1.5 flex items-center gap-2 max-w-[calc(100vw-24px)]"
            >
              <Highlighter
                aria-hidden="true"
                className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0"
              />

              <div className="flex items-center gap-1.5">
                {HIGHLIGHT_COLORS.map((color) => {
                  const meta = HIGHLIGHT_PALETTE[color];
                  const label = uiLang === 'zh' ? meta.labelZh : meta.labelEn;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleHighlightSelection(color)}
                      aria-label={t.highlightSelectionTitle(label)}
                      title={t.highlightSelectionTitle(label)}
                      className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 cursor-pointer ${meta.swatchClass}`}
                    />
                  );
                })}
              </div>

              <span
                aria-hidden="true"
                className="h-5 w-px bg-stone-200 dark:bg-stone-700"
              />

              <button
                type="button"
                onClick={handleStartAnnotateSelection}
                className="h-8 px-2.5 rounded-md bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] text-xs font-medium hover:opacity-90 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>{t.annotateSelection}</span>
              </button>

              <button
                type="button"
                onClick={clearBrowserSelection}
                aria-label={t.closeSearch}
                className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })()}

      {/* Always-Available Floating Back to Top Button */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t.backToTopAria}
        className="fixed bottom-5 right-5 z-30 h-11 px-4 rounded-lg border border-stone-300 dark:border-stone-700 bg-white/95 dark:bg-[#181A1E]/95 text-stone-800 dark:text-stone-100 shadow-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1]"
      >
        <ArrowUp className="w-3.5 h-3.5" />
        <span>{t.backToTop}</span>
      </button>
    </div>
  );
}
