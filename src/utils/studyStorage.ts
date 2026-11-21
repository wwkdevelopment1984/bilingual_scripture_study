import type {
  HighlightColor,
  VerseSegment,
  VerseStudyAnnotation,
} from '../types/scripture.ts';

const LEGACY_HIGHLIGHTS_KEY = 'bilingual-scripture-highlights-v1';
const STUDY_STORAGE_KEY = 'bilingual-scripture-study-v1';

export interface HighlightColorConfig {
  id: HighlightColor;
  labelEn: string;
  labelZh: string;
  swatchClass: string;
  inlineMarkClass: string;
  verseContainerClass: string;
  verseNumberActiveClass: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = ['amber', 'sage', 'lapis', 'rose'];

export const HIGHLIGHT_PALETTE: Record<HighlightColor, HighlightColorConfig> = {
  amber: {
    id: 'amber',
    labelEn: 'Gold',
    labelZh: '暖黃',
    swatchClass:
      'bg-[#E6C775] dark:bg-[#C99E3D] border-[#B8922E] dark:border-[#E5BD5B]',
    inlineMarkClass:
      'bg-amber-200/75 dark:bg-amber-500/30 text-inherit rounded-[2px] py-[1px]',
    verseContainerClass:
      'bg-[#F5ECD4]/85 dark:bg-[#272116]/85 ring-1 ring-amber-700/25 dark:ring-amber-400/30',
    verseNumberActiveClass:
      'bg-amber-700 text-white dark:bg-amber-400 dark:text-[#111315]',
  },
  sage: {
    id: 'sage',
    labelEn: 'Sage',
    labelZh: '青綠',
    swatchClass:
      'bg-[#9AC4A7] dark:bg-[#4F9167] border-[#5D8F6D] dark:border-[#78BA8F]',
    inlineMarkClass:
      'bg-emerald-200/70 dark:bg-emerald-500/28 text-inherit rounded-[2px] py-[1px]',
    verseContainerClass:
      'bg-[#E6EFE9]/85 dark:bg-[#17261E]/85 ring-1 ring-emerald-700/25 dark:ring-emerald-400/30',
    verseNumberActiveClass:
      'bg-emerald-800 text-white dark:bg-emerald-400 dark:text-[#111315]',
  },
  lapis: {
    id: 'lapis',
    labelEn: 'Blue',
    labelZh: '群青',
    swatchClass:
      'bg-[#9AB6D8] dark:bg-[#5E88B8] border-[#1E3A5F]/60 dark:border-[#7DA2D1]',
    inlineMarkClass:
      'bg-sky-200/75 dark:bg-[#7DA2D1]/30 text-inherit rounded-[2px] py-[1px]',
    verseContainerClass:
      'bg-[#EFE8D8]/85 dark:bg-[#1E2530] ring-1 ring-[#1E3A5F]/25 dark:ring-[#7DA2D1]/30',
    verseNumberActiveClass:
      'bg-[#1E3A5F] text-white dark:bg-[#7DA2D1] dark:text-[#111315]',
  },
  rose: {
    id: 'rose',
    labelEn: 'Rose',
    labelZh: '赭紅',
    swatchClass:
      'bg-[#DF9F9F] dark:bg-[#B8636A] border-[#A8595D] dark:border-[#DE8B92]',
    inlineMarkClass:
      'bg-rose-200/70 dark:bg-rose-500/28 text-inherit rounded-[2px] py-[1px]',
    verseContainerClass:
      'bg-[#F4E6E6]/85 dark:bg-[#2A1B1D]/85 ring-1 ring-rose-700/25 dark:ring-rose-400/30',
    verseNumberActiveClass:
      'bg-rose-800 text-white dark:bg-rose-400 dark:text-[#111315]',
  },
};

function isValidHighlightColor(val: unknown): val is HighlightColor {
  return val === 'amber' || val === 'sage' || val === 'lapis' || val === 'rose';
}

function readAllStudyMap(): Record<string, VerseStudyAnnotation[]> {
  try {
    const raw = window.localStorage.getItem(STUDY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    const clean: Record<string, VerseStudyAnnotation[]> = {};
    for (const [key, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      const validItems: VerseStudyAnnotation[] = [];
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Partial<VerseStudyAnnotation>;
        if (
          typeof rec.id !== 'string' ||
          (rec.scope !== 'verse' && rec.scope !== 'selection') ||
          typeof rec.verse !== 'number' ||
          !Number.isInteger(rec.verse) ||
          rec.verse < 1
        ) {
          continue;
        }
        const color = isValidHighlightColor(rec.color) ? rec.color : null;
        const note = typeof rec.note === 'string' ? rec.note : '';
        if (color === null && note.trim().length === 0) continue;

        if (rec.scope === 'selection') {
          if (
            (rec.lang !== 'en' && rec.lang !== 'zh') ||
            typeof rec.start !== 'number' ||
            typeof rec.end !== 'number' ||
            rec.end <= rec.start ||
            rec.start < 0
          ) {
            continue;
          }
        }

        validItems.push({
          id: rec.id,
          scope: rec.scope,
          verse: rec.verse,
          lang: rec.scope === 'selection' ? rec.lang : undefined,
          start: rec.scope === 'selection' ? rec.start : undefined,
          end: rec.scope === 'selection' ? rec.end : undefined,
          selectedText:
            rec.scope === 'selection' && typeof rec.selectedText === 'string'
              ? rec.selectedText
              : undefined,
          color,
          note,
          createdAt:
            typeof rec.createdAt === 'string'
              ? rec.createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof rec.updatedAt === 'string'
              ? rec.updatedAt
              : new Date().toISOString(),
        });
      }
      if (validItems.length > 0) {
        clean[key] = validItems;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function readLegacyHighlights(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_HIGHLIGHTS_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, unknown>;
    const list = map[key];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0
    );
  } catch {
    return [];
  }
}

function clearLegacyHighlightsKey(key: string): void {
  try {
    const raw = window.localStorage.getItem(LEGACY_HIGHLIGHTS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, unknown>;
    if (key in map) {
      delete map[key];
      window.localStorage.setItem(LEGACY_HIGHLIGHTS_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadChapterStudyItems(
  book: string,
  chapter: number
): VerseStudyAnnotation[] {
  const key = `${book}:${chapter}`;
  const map = readAllStudyMap();
  const existing = map[key] ? [...map[key]] : [];

  const legacyVerses = readLegacyHighlights(key);
  if (legacyVerses.length > 0) {
    const now = new Date().toISOString();
    let changed = false;
    for (const vNum of legacyVerses) {
      const alreadyHasVerseItem = existing.some(
        (item) => item.scope === 'verse' && item.verse === vNum
      );
      if (!alreadyHasVerseItem) {
        existing.push({
          id: createAnnotationId(),
          scope: 'verse',
          verse: vNum,
          color: 'lapis',
          note: '',
          createdAt: now,
          updatedAt: now,
        });
        changed = true;
      }
    }
    if (changed) {
      saveChapterStudyItems(book, chapter, existing);
    }
    clearLegacyHighlightsKey(key);
  }

  return existing;
}

export function saveChapterStudyItems(
  book: string,
  chapter: number,
  items: VerseStudyAnnotation[]
): void {
  try {
    const key = `${book}:${chapter}`;
    const map = readAllStudyMap();
    const cleaned = items.filter(
      (item) => item.color !== null || item.note.trim().length > 0
    );
    if (cleaned.length === 0) {
      delete map[key];
    } else {
      map[key] = cleaned;
    }
    window.localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function ensureVerseHighlightedInStorage(
  book: string,
  chapter: number,
  verse: number,
  color: HighlightColor = 'lapis'
): void {
  const items = loadChapterStudyItems(book, chapter);
  const existingVerse = items.find(
    (item) => item.scope === 'verse' && item.verse === verse
  );
  if (existingVerse) {
    if (!existingVerse.color) {
      existingVerse.color = color;
      existingVerse.updatedAt = new Date().toISOString();
      saveChapterStudyItems(book, chapter, items);
    }
    return;
  }
  const now = new Date().toISOString();
  items.push({
    id: createAnnotationId(),
    scope: 'verse',
    verse,
    color,
    note: '',
    createdAt: now,
    updatedAt: now,
  });
  saveChapterStudyItems(book, chapter, items);
}

export function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getVersePlainText(
  segments: VerseSegment[] | undefined,
  fallbackText: string
): string {
  if (segments && segments.length > 0) {
    return segments.map((s) => s.text).join('');
  }
  return fallbackText || '';
}

function isSkippedAnnotationNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  return (
    el.hasAttribute('data-footnote-marker') ||
    el.hasAttribute('data-annotation-badge')
  );
}

function countNonSkippedChars(node: Node): number {
  if (isSkippedAnnotationNode(node)) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').length;
  }
  let total = 0;
  for (let i = 0; i < node.childNodes.length; i += 1) {
    total += countNonSkippedChars(node.childNodes[i]);
  }
  return total;
}

function countTextCharsBefore(
  root: Node,
  targetNode: Node,
  targetOffset: number
): { count: number; found: boolean } {
  if (isSkippedAnnotationNode(root)) {
    return { count: 0, found: false };
  }

  if (root === targetNode) {
    if (root.nodeType === Node.TEXT_NODE) {
      const len = (root.textContent || '').length;
      return { count: Math.min(targetOffset, len), found: true };
    }
    let count = 0;
    const limit = Math.min(targetOffset, root.childNodes.length);
    for (let i = 0; i < limit; i += 1) {
      count += countNonSkippedChars(root.childNodes[i]);
    }
    return { count, found: true };
  }

  if (root.nodeType === Node.TEXT_NODE) {
    return { count: (root.textContent || '').length, found: false };
  }

  let total = 0;
  for (let i = 0; i < root.childNodes.length; i += 1) {
    const res = countTextCharsBefore(root.childNodes[i], targetNode, targetOffset);
    total += res.count;
    if (res.found) {
      return { count: total, found: true };
    }
  }

  return { count: total, found: false };
}

export interface DetectedVerseSelection {
  verse: number;
  lang: 'en' | 'zh';
  start: number;
  end: number;
  selectedText: string;
  rect: DOMRect;
}

function findVerseTextHost(node: Node | null): HTMLElement | null {
  let curr: Node | null = node;
  while (curr) {
    if (
      curr.nodeType === Node.ELEMENT_NODE &&
      (curr as HTMLElement).hasAttribute('data-verse-text')
    ) {
      return curr as HTMLElement;
    }
    curr = curr.parentNode;
  }
  return null;
}

export function detectVerseSelection(
  selection: Selection | null
): DetectedVerseSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const startHost = findVerseTextHost(range.startContainer);
  const endHost = findVerseTextHost(range.endContainer);

  let host: HTMLElement | null = null;
  if (startHost && (!endHost || endHost === startHost)) {
    host = startHost;
  } else if (endHost && !startHost) {
    host = endHost;
  } else if (startHost && endHost && startHost !== endHost) {
    // Handle triple-click where end boundary snaps to offset 0 of next verse element
    const endPos = countTextCharsBefore(
      endHost,
      range.endContainer,
      range.endOffset
    );
    if (endPos.found && endPos.count === 0) {
      host = startHost;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!host) return null;

  const verseAttr = Number(host.getAttribute('data-verse'));
  const langAttr = host.getAttribute('data-lang');
  const fullText = host.getAttribute('data-full-text') || '';
  if (
    !Number.isInteger(verseAttr) ||
    verseAttr < 1 ||
    (langAttr !== 'en' && langAttr !== 'zh') ||
    !fullText
  ) {
    return null;
  }

  const elRange = document.createRange();
  elRange.selectNodeContents(host);

  if (range.compareBoundaryPoints(Range.END_TO_START, elRange) >= 0) return null;
  if (range.compareBoundaryPoints(Range.START_TO_END, elRange) <= 0) return null;

  const clamped = range.cloneRange();
  if (clamped.compareBoundaryPoints(Range.START_TO_START, elRange) < 0) {
    clamped.setStart(elRange.startContainer, elRange.startOffset);
  }
  if (clamped.compareBoundaryPoints(Range.END_TO_END, elRange) > 0) {
    clamped.setEnd(elRange.endContainer, elRange.endOffset);
  }

  const startRes = countTextCharsBefore(
    host,
    clamped.startContainer,
    clamped.startOffset
  );
  const endRes = countTextCharsBefore(
    host,
    clamped.endContainer,
    clamped.endOffset
  );
  if (!startRes.found || !endRes.found) return null;

  let start = Math.max(0, Math.min(startRes.count, fullText.length));
  let end = Math.max(0, Math.min(endRes.count, fullText.length));
  if (end <= start) return null;

  // Trim leading/trailing whitespace from selection boundaries
  while (start < end && /\s/.test(fullText[start])) {
    start += 1;
  }
  while (end > start && /\s/.test(fullText[end - 1])) {
    end -= 1;
  }
  if (end <= start) return null;

  const selectedText = fullText.slice(start, end);
  if (!selectedText.trim()) return null;

  const rect = clamped.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return {
    verse: verseAttr,
    lang: langAttr,
    start,
    end,
    selectedText,
    rect,
  };
}

export interface TextAnnotationSlice {
  start: number;
  end: number;
  text: string;
  primaryAnnotation: VerseStudyAnnotation | null;
  endingNotes: VerseStudyAnnotation[];
}

export function sliceSegmentByAnnotations(
  segStart: number,
  segEnd: number,
  fullText: string,
  annotations: VerseStudyAnnotation[]
): TextAnnotationSlice[] {
  if (segEnd <= segStart) return [];

  const relevant = annotations.filter(
    (ann) =>
      ann.scope === 'selection' &&
      typeof ann.start === 'number' &&
      typeof ann.end === 'number' &&
      ann.end > segStart &&
      ann.start < segEnd
  );

  if (relevant.length === 0) {
    return [
      {
        start: segStart,
        end: segEnd,
        text: fullText.slice(segStart, segEnd),
        primaryAnnotation: null,
        endingNotes: [],
      },
    ];
  }

  const pointsSet = new Set<number>([segStart, segEnd]);
  for (const ann of relevant) {
    if (ann.start! > segStart && ann.start! < segEnd) {
      pointsSet.add(ann.start!);
    }
    if (ann.end! > segStart && ann.end! < segEnd) {
      pointsSet.add(ann.end!);
    }
  }

  const points = Array.from(pointsSet).sort((a, b) => a - b);
  const slices: TextAnnotationSlice[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (b <= a) continue;

    const covering = relevant.filter(
      (ann) => ann.start! <= a && ann.end! >= b
    );
    const primaryAnnotation =
      covering.length > 0 ? covering[covering.length - 1] : null;
    const endingNotes = relevant.filter(
      (ann) => ann.end === b && ann.note.trim().length > 0
    );

    slices.push({
      start: a,
      end: b,
      text: fullText.slice(a, b),
      primaryAnnotation,
      endingNotes,
    });
  }

  return slices;
}
