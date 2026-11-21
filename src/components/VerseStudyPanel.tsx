import React, { useEffect, useRef } from 'react';
import {
  Check,
  Highlighter,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type { HighlightColor, UiLang, VerseStudyAnnotation } from '../types/scripture.ts';
import { HIGHLIGHT_COLORS, HIGHLIGHT_PALETTE } from '../utils/studyStorage.ts';

export interface StudyDraftState {
  editingId: string | null;
  scope: 'verse' | 'selection';
  verse: number;
  lang?: 'en' | 'zh';
  start?: number;
  end?: number;
  selectedText?: string;
  color: HighlightColor | null;
  note: string;
}

interface VerseStudyPanelProps {
  verse: number;
  uiLang: UiLang;
  items: VerseStudyAnnotation[];
  draft: StudyDraftState | null;
  onChangeDraft: (next: StudyDraftState) => void;
  onSaveDraft: () => void;
  onCancelDraft: () => void;
  onStartNewVerseNote: (verse: number) => void;
  onEditItem: (item: VerseStudyAnnotation) => void;
  onChangeItemColor: (itemId: string, color: HighlightColor | null) => void;
  onDeleteItem: (itemId: string) => void;
  onClosePanel: () => void;
}

const COPY = {
  en: {
    heading: 'Verse Highlights & Notes',
    close: 'Close',
    wholeVerse: 'Whole verse',
    selectedWording: 'Selected wording',
    englishTag: 'English',
    chineseTag: '中文',
    highlightOnly: 'Highlight only',
    highlightLabel: 'Highlight color',
    noteOnly: 'Note only',
    notePlaceholder: 'Write a study note, cross-reference thought, or reflection…',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    remove: 'Remove',
    addWholeVerseNote: 'Add whole-verse note',
    empty: 'No highlights or notes on this verse yet.',
  },
  zh: {
    heading: '經文畫記與筆記',
    close: '關閉',
    wholeVerse: '整節經文',
    selectedWording: '選取字詞',
    englishTag: '英文',
    chineseTag: '中文',
    highlightOnly: '僅畫記',
    highlightLabel: '標記顏色',
    noteOnly: '僅記筆記',
    notePlaceholder: '寫下研讀筆記、交叉參考想法或心得…',
    save: '儲存',
    cancel: '取消',
    edit: '編輯',
    remove: '刪除',
    addWholeVerseNote: '新增整節筆記',
    empty: '此節尚未建立畫記或筆記。',
  },
};

export default function VerseStudyPanel({
  verse,
  uiLang,
  items,
  draft,
  onChangeDraft,
  onSaveDraft,
  onCancelDraft,
  onStartNewVerseNote,
  onEditItem,
  onChangeItemColor,
  onDeleteItem,
  onClosePanel,
}: VerseStudyPanelProps) {
  const t = COPY[uiLang];
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeDraftForVerse = draft && draft.verse === verse ? draft : null;

  useEffect(() => {
    if (activeDraftForVerse && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [
    activeDraftForVerse?.verse,
    activeDraftForVerse?.editingId,
    activeDraftForVerse?.scope,
    activeDraftForVerse?.start,
  ]);

  const sortedItems = [...items].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'verse' ? -1 : 1;
    if ((a.start ?? 0) !== (b.start ?? 0)) return (a.start ?? 0) - (b.start ?? 0);
    return a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <div
      role="region"
      aria-label={`${t.heading} ${verse}`}
      className="mt-3 pt-3 border-t border-stone-300/70 dark:border-stone-700/80"
    >
      <div className="rounded-md border border-stone-200 dark:border-stone-700/80 bg-[#FAF8F4] dark:bg-[#111315] p-3.5 sm:p-4 space-y-3">
        {/* Panel Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200/80 dark:border-stone-800">
          <div className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300">
            <StickyNote className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7DA2D1]" />
            <span>{t.heading}</span>
            {items.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-stone-500 dark:text-stone-400">
                  {items.length}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!activeDraftForVerse && (
              <button
                type="button"
                onClick={() => onStartNewVerseNote(verse)}
                className="h-8 px-2.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#181A1E] text-xs font-medium text-[#1E3A5F] dark:text-[#7DA2D1] hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addWholeVerseNote}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClosePanel}
              aria-label={t.close}
              className="h-8 px-2.5 rounded text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.close}</span>
            </button>
          </div>
        </div>

        {/* Saved Items List */}
        {sortedItems.length > 0 && (
          <div className="divide-y divide-stone-200/80 dark:divide-stone-800">
            {sortedItems.map((item) => {
              const isBeingEdited = activeDraftForVerse?.editingId === item.id;
              if (isBeingEdited) return null;

              const colorMeta = item.color ? HIGHLIGHT_PALETTE[item.color] : null;
              const scopeText =
                item.scope === 'verse'
                  ? t.wholeVerse
                  : `${t.selectedWording} · ${item.lang === 'zh' ? t.chineseTag : t.englishTag}`;

              return (
                <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span>{scopeText}</span>
                      {colorMeta && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                            <span
                              aria-hidden="true"
                              className={`inline-block w-2.5 h-2.5 rounded-xs border ${colorMeta.swatchClass}`}
                            />
                            <span>
                              {uiLang === 'zh' ? colorMeta.labelZh : colorMeta.labelEn}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Quick inline color switchers */}
                      <div className="flex items-center gap-1 mr-1.5">
                        {HIGHLIGHT_COLORS.map((c) => {
                          const cMeta = HIGHLIGHT_PALETTE[c];
                          const isSelected = item.color === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                onChangeItemColor(item.id, isSelected && item.note.trim() ? null : c)
                              }
                              title={`${t.highlightLabel}: ${uiLang === 'zh' ? cMeta.labelZh : cMeta.labelEn}`}
                              aria-label={`${t.highlightLabel}: ${uiLang === 'zh' ? cMeta.labelZh : cMeta.labelEn}`}
                              aria-pressed={isSelected}
                              className={`w-5 h-5 rounded-full border transition-transform cursor-pointer inline-flex items-center justify-center ${
                                cMeta.swatchClass
                              } ${
                                isSelected
                                  ? 'ring-2 ring-offset-1 ring-stone-800 dark:ring-stone-200 dark:ring-offset-[#111315] scale-105'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 text-stone-900" />}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => onEditItem(item)}
                        className="h-7 px-2 rounded text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{t.edit}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="h-7 px-2 rounded text-xs text-stone-500 dark:text-stone-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{t.remove}</span>
                      </button>
                    </div>
                  </div>

                  {item.scope === 'selection' && item.selectedText && (
                    <p
                      className={`text-xs sm:text-sm italic px-2 py-1 rounded ${
                        colorMeta
                          ? colorMeta.inlineMarkClass
                          : 'bg-stone-200/60 dark:bg-stone-800/70'
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
                      {t.highlightOnly}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sortedItems.length === 0 && !activeDraftForVerse && (
          <p className="text-xs text-stone-500 dark:text-stone-400">{t.empty}</p>
        )}

        {/* Inline Draft Composer */}
        {activeDraftForVerse && (
          <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
                {activeDraftForVerse.scope === 'verse'
                  ? t.wholeVerse
                  : `${t.selectedWording} (${
                      activeDraftForVerse.lang === 'zh' ? t.chineseTag : t.englishTag
                    })`}
              </div>

              {/* Color Swatches + Note Only */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-stone-500 dark:text-stone-400 mr-1 inline-flex items-center gap-1">
                  <Highlighter className="w-3.5 h-3.5" />
                  <span>{t.highlightLabel}:</span>
                </span>
                {HIGHLIGHT_COLORS.map((c) => {
                  const meta = HIGHLIGHT_PALETTE[c];
                  const selected = activeDraftForVerse.color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onChangeDraft({ ...activeDraftForVerse, color: c })
                      }
                      aria-pressed={selected}
                      aria-label={uiLang === 'zh' ? meta.labelZh : meta.labelEn}
                      className={`h-7 px-2 rounded border text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-[#1E3A5F] dark:border-[#7DA2D1] bg-white dark:bg-[#181A1E] text-stone-900 dark:text-stone-100 font-medium'
                          : 'border-stone-300/80 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-2.5 h-2.5 rounded-full border ${meta.swatchClass}`}
                      />
                      <span>{uiLang === 'zh' ? meta.labelZh : meta.labelEn}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    onChangeDraft({ ...activeDraftForVerse, color: null })
                  }
                  aria-pressed={activeDraftForVerse.color === null}
                  className={`h-7 px-2 rounded border text-xs transition-colors cursor-pointer whitespace-nowrap ${
                    activeDraftForVerse.color === null
                      ? 'border-[#1E3A5F] dark:border-[#7DA2D1] bg-white dark:bg-[#181A1E] text-stone-900 dark:text-stone-100 font-medium'
                      : 'border-stone-300/80 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {t.noteOnly}
                </button>
              </div>
            </div>

            {activeDraftForVerse.scope === 'selection' &&
              activeDraftForVerse.selectedText && (
                <p
                  className={`text-xs sm:text-sm italic px-2.5 py-1.5 rounded ${
                    activeDraftForVerse.color
                      ? HIGHLIGHT_PALETTE[activeDraftForVerse.color].inlineMarkClass
                      : 'bg-stone-200/70 dark:bg-stone-800/80'
                  } text-stone-800 dark:text-stone-200`}
                >
                  “{activeDraftForVerse.selectedText}”
                </p>
              )}

            <textarea
              ref={textareaRef}
              rows={3}
              value={activeDraftForVerse.note}
              onChange={(e) =>
                onChangeDraft({ ...activeDraftForVerse, note: e.target.value })
              }
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onSaveDraft();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelDraft();
                }
              }}
              placeholder={t.notePlaceholder}
              className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#181A1E] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus-visible:outline-2 focus-visible:outline-[#1E3A5F] dark:focus-visible:outline-[#7DA2D1] resize-y"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelDraft}
                className="h-9 px-3.5 rounded-md border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 whitespace-nowrap cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={
                  activeDraftForVerse.color === null &&
                  activeDraftForVerse.note.trim().length === 0
                }
                onClick={onSaveDraft}
                className="h-9 px-4 rounded-md bg-[#1E3A5F] dark:bg-[#7DA2D1] text-white dark:text-[#111315] text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
