export type VolumeId = 'ot' | 'nt' | 'bofm' | 'dc-testament' | 'pgp';

export interface ScriptureBook {
  key: string;
  slug: string;
  usfm: string | null;
  bibleBookId: number | null;
  chapters: number;
  en: string;
  zh: string;
}

export interface ScriptureVolume {
  id: VolumeId;
  en: string;
  zh: string;
  books: ScriptureBook[];
}

export interface CatalogBook extends ScriptureBook {
  volume: VolumeId;
  volumeEn: string;
  volumeZh: string;
}

export const SCRIPTURE_VOLUMES: ScriptureVolume[] = [
  {
    id: 'ot',
    en: 'Old Testament (KJV / CUNP)',
    zh: '舊約聖經 (KJV / 和合本)',
    books: [
      { key: 'gen', slug: 'gen', usfm: 'GEN', bibleBookId: 1, chapters: 50, en: 'Genesis', zh: '創世記' },
      { key: 'ex', slug: 'ex', usfm: 'EXO', bibleBookId: 2, chapters: 40, en: 'Exodus', zh: '出埃及記' },
      { key: 'lev', slug: 'lev', usfm: 'LEV', bibleBookId: 3, chapters: 27, en: 'Leviticus', zh: '利未記' },
      { key: 'num', slug: 'num', usfm: 'NUM', bibleBookId: 4, chapters: 36, en: 'Numbers', zh: '民數記' },
      { key: 'deut', slug: 'deut', usfm: 'DEU', bibleBookId: 5, chapters: 34, en: 'Deuteronomy', zh: '申命記' },
      { key: 'josh', slug: 'josh', usfm: 'JOS', bibleBookId: 6, chapters: 24, en: 'Joshua', zh: '約書亞記' },
      { key: 'judg', slug: 'judg', usfm: 'JDG', bibleBookId: 7, chapters: 21, en: 'Judges', zh: '士師記' },
      { key: 'ruth', slug: 'ruth', usfm: 'RUT', bibleBookId: 8, chapters: 4, en: 'Ruth', zh: '路得記' },
      { key: '1-sam', slug: '1-sam', usfm: '1SA', bibleBookId: 9, chapters: 31, en: '1 Samuel', zh: '撒母耳記上' },
      { key: '2-sam', slug: '2-sam', usfm: '2SA', bibleBookId: 10, chapters: 24, en: '2 Samuel', zh: '撒母耳記下' },
      { key: '1-kgs', slug: '1-kgs', usfm: '1KI', bibleBookId: 11, chapters: 22, en: '1 Kings', zh: '列王紀上' },
      { key: '2-kgs', slug: '2-kgs', usfm: '2KI', bibleBookId: 12, chapters: 25, en: '2 Kings', zh: '列王紀下' },
      { key: '1-chr', slug: '1-chr', usfm: '1CH', bibleBookId: 13, chapters: 29, en: '1 Chronicles', zh: '歷代志上' },
      { key: '2-chr', slug: '2-chr', usfm: '2CH', bibleBookId: 14, chapters: 36, en: '2 Chronicles', zh: '歷代志下' },
      { key: 'ezra', slug: 'ezra', usfm: 'EZR', bibleBookId: 15, chapters: 10, en: 'Ezra', zh: '以斯拉記' },
      { key: 'neh', slug: 'neh', usfm: 'NEH', bibleBookId: 16, chapters: 13, en: 'Nehemiah', zh: '尼希米記' },
      { key: 'esth', slug: 'esth', usfm: 'EST', bibleBookId: 17, chapters: 10, en: 'Esther', zh: '以斯帖記' },
      { key: 'job', slug: 'job', usfm: 'JOB', bibleBookId: 18, chapters: 42, en: 'Job', zh: '約伯記' },
      { key: 'ps', slug: 'ps', usfm: 'PSA', bibleBookId: 19, chapters: 150, en: 'Psalms', zh: '詩篇' },
      { key: 'prov', slug: 'prov', usfm: 'PRO', bibleBookId: 20, chapters: 31, en: 'Proverbs', zh: '箴言' },
      { key: 'eccl', slug: 'eccl', usfm: 'ECC', bibleBookId: 21, chapters: 12, en: 'Ecclesiastes', zh: '傳道書' },
      { key: 'song', slug: 'song', usfm: 'SNG', bibleBookId: 22, chapters: 8, en: 'Song of Solomon', zh: '雅歌' },
      { key: 'isa', slug: 'isa', usfm: 'ISA', bibleBookId: 23, chapters: 66, en: 'Isaiah', zh: '以賽亞書' },
      { key: 'jer', slug: 'jer', usfm: 'JER', bibleBookId: 24, chapters: 52, en: 'Jeremiah', zh: '耶利米書' },
      { key: 'lam', slug: 'lam', usfm: 'LAM', bibleBookId: 25, chapters: 5, en: 'Lamentations', zh: '耶利米哀歌' },
      { key: 'ezek', slug: 'ezek', usfm: 'EZK', bibleBookId: 26, chapters: 48, en: 'Ezekiel', zh: '以西結書' },
      { key: 'dan', slug: 'dan', usfm: 'DAN', bibleBookId: 27, chapters: 12, en: 'Daniel', zh: '但以理書' },
      { key: 'hosea', slug: 'hosea', usfm: 'HOS', bibleBookId: 28, chapters: 14, en: 'Hosea', zh: '何西阿書' },
      { key: 'joel', slug: 'joel', usfm: 'JOL', bibleBookId: 29, chapters: 3, en: 'Joel', zh: '約珥書' },
      { key: 'amos', slug: 'amos', usfm: 'AMO', bibleBookId: 30, chapters: 9, en: 'Amos', zh: '阿摩司書' },
      { key: 'obad', slug: 'obad', usfm: 'OBA', bibleBookId: 31, chapters: 1, en: 'Obadiah', zh: '俄巴底亞書' },
      { key: 'jonah', slug: 'jonah', usfm: 'JON', bibleBookId: 32, chapters: 4, en: 'Jonah', zh: '約拿書' },
      { key: 'micah', slug: 'micah', usfm: 'MIC', bibleBookId: 33, chapters: 7, en: 'Micah', zh: '彌迦書' },
      { key: 'nahum', slug: 'nahum', usfm: 'NAM', bibleBookId: 34, chapters: 3, en: 'Nahum', zh: '那鴻書' },
      { key: 'hab', slug: 'hab', usfm: 'HAB', bibleBookId: 35, chapters: 3, en: 'Habakkuk', zh: '哈巴谷書' },
      { key: 'zeph', slug: 'zeph', usfm: 'ZEP', bibleBookId: 36, chapters: 3, en: 'Zephaniah', zh: '西番雅書' },
      { key: 'hag', slug: 'hag', usfm: 'HAG', bibleBookId: 37, chapters: 2, en: 'Haggai', zh: '哈該書' },
      { key: 'zech', slug: 'zech', usfm: 'ZEC', bibleBookId: 38, chapters: 14, en: 'Zechariah', zh: '撒迦利亞書' },
      { key: 'mal', slug: 'mal', usfm: 'MAL', bibleBookId: 39, chapters: 4, en: 'Malachi', zh: '瑪拉基書' },
    ],
  },
  {
    id: 'nt',
    en: 'New Testament (KJV / CUNP)',
    zh: '新約聖經 (KJV / 和合本)',
    books: [
      { key: 'matt', slug: 'matt', usfm: 'MAT', bibleBookId: 40, chapters: 28, en: 'Matthew', zh: '馬太福音' },
      { key: 'mark', slug: 'mark', usfm: 'MRK', bibleBookId: 41, chapters: 16, en: 'Mark', zh: '馬可福音' },
      { key: 'luke', slug: 'luke', usfm: 'LUK', bibleBookId: 42, chapters: 24, en: 'Luke', zh: '路加福音' },
      { key: 'john', slug: 'john', usfm: 'JHN', bibleBookId: 43, chapters: 21, en: 'John', zh: '約翰福音' },
      { key: 'acts', slug: 'acts', usfm: 'ACT', bibleBookId: 44, chapters: 28, en: 'Acts', zh: '使徒行傳' },
      { key: 'rom', slug: 'rom', usfm: 'ROM', bibleBookId: 45, chapters: 16, en: 'Romans', zh: '羅馬書' },
      { key: '1-cor', slug: '1-cor', usfm: '1CO', bibleBookId: 46, chapters: 16, en: '1 Corinthians', zh: '哥林多前書' },
      { key: '2-cor', slug: '2-cor', usfm: '2CO', bibleBookId: 47, chapters: 13, en: '2 Corinthians', zh: '哥林多後書' },
      { key: 'gal', slug: 'gal', usfm: 'GAL', bibleBookId: 48, chapters: 6, en: 'Galatians', zh: '加拉太書' },
      { key: 'eph', slug: 'eph', usfm: 'EPH', bibleBookId: 49, chapters: 6, en: 'Ephesians', zh: '以弗所書' },
      { key: 'philip', slug: 'philip', usfm: 'PHP', bibleBookId: 50, chapters: 4, en: 'Philippians', zh: '腓立比書' },
      { key: 'col', slug: 'col', usfm: 'COL', bibleBookId: 51, chapters: 4, en: 'Colossians', zh: '歌羅西書' },
      { key: '1-thes', slug: '1-thes', usfm: '1TH', bibleBookId: 52, chapters: 5, en: '1 Thessalonians', zh: '帖撒羅尼迦前書' },
      { key: '2-thes', slug: '2-thes', usfm: '2TH', bibleBookId: 53, chapters: 3, en: '2 Thessalonians', zh: '帖撒羅尼迦後書' },
      { key: '1-tim', slug: '1-tim', usfm: '1TI', bibleBookId: 54, chapters: 6, en: '1 Timothy', zh: '提摩太前書' },
      { key: '2-tim', slug: '2-tim', usfm: '2TI', bibleBookId: 55, chapters: 4, en: '2 Timothy', zh: '提摩太後書' },
      { key: 'titus', slug: 'titus', usfm: 'TIT', bibleBookId: 56, chapters: 3, en: 'Titus', zh: '提多書' },
      { key: 'philem', slug: 'philem', usfm: 'PHM', bibleBookId: 57, chapters: 1, en: 'Philemon', zh: '腓利門書' },
      { key: 'heb', slug: 'heb', usfm: 'HEB', bibleBookId: 58, chapters: 13, en: 'Hebrews', zh: '希伯來書' },
      { key: 'james', slug: 'james', usfm: 'JAS', bibleBookId: 59, chapters: 5, en: 'James', zh: '雅各書' },
      { key: '1-pet', slug: '1-pet', usfm: '1PE', bibleBookId: 60, chapters: 5, en: '1 Peter', zh: '彼得前書' },
      { key: '2-pet', slug: '2-pet', usfm: '2PE', bibleBookId: 61, chapters: 3, en: '2 Peter', zh: '彼得後書' },
      { key: '1-jn', slug: '1-jn', usfm: '1JN', bibleBookId: 62, chapters: 5, en: '1 John', zh: '約翰一書' },
      { key: '2-jn', slug: '2-jn', usfm: '2JN', bibleBookId: 63, chapters: 1, en: '2 John', zh: '約翰二書' },
      { key: '3-jn', slug: '3-jn', usfm: '3JN', bibleBookId: 64, chapters: 1, en: '3 John', zh: '約翰三書' },
      { key: 'jude', slug: 'jude', usfm: 'JUD', bibleBookId: 65, chapters: 1, en: 'Jude', zh: '猶大書' },
      { key: 'rev', slug: 'rev', usfm: 'REV', bibleBookId: 66, chapters: 22, en: 'Revelation', zh: '啟示錄' },
    ],
  },
  {
    id: 'bofm',
    en: 'Book of Mormon',
    zh: '摩爾門經',
    books: [
      { key: '1-ne', slug: '1-ne', usfm: null, bibleBookId: null, chapters: 22, en: '1 Nephi', zh: '尼腓一書' },
      { key: '2-ne', slug: '2-ne', usfm: null, bibleBookId: null, chapters: 33, en: '2 Nephi', zh: '尼腓二書' },
      { key: 'jacob', slug: 'jacob', usfm: null, bibleBookId: null, chapters: 7, en: 'Jacob', zh: '雅各書' },
      { key: 'enos', slug: 'enos', usfm: null, bibleBookId: null, chapters: 1, en: 'Enos', zh: '以諾書' },
      { key: 'jarom', slug: 'jarom', usfm: null, bibleBookId: null, chapters: 1, en: 'Jarom', zh: '雅龍書' },
      { key: 'omni', slug: 'omni', usfm: null, bibleBookId: null, chapters: 1, en: 'Omni', zh: '奧姆奈書' },
      { key: 'w-of-m', slug: 'w-of-m', usfm: null, bibleBookId: null, chapters: 1, en: 'Words of Mormon', zh: '摩爾門語' },
      { key: 'mosiah', slug: 'mosiah', usfm: null, bibleBookId: null, chapters: 29, en: 'Mosiah', zh: '摩賽亞書' },
      { key: 'alma', slug: 'alma', usfm: null, bibleBookId: null, chapters: 63, en: 'Alma', zh: '阿爾瑪書' },
      { key: 'hel', slug: 'hel', usfm: null, bibleBookId: null, chapters: 16, en: 'Helaman', zh: '希拉曼書' },
      { key: '3-ne', slug: '3-ne', usfm: null, bibleBookId: null, chapters: 30, en: '3 Nephi', zh: '尼腓三書' },
      { key: '4-ne', slug: '4-ne', usfm: null, bibleBookId: null, chapters: 1, en: '4 Nephi', zh: '尼腓四書' },
      { key: 'morm', slug: 'morm', usfm: null, bibleBookId: null, chapters: 9, en: 'Mormon', zh: '摩爾門書' },
      { key: 'ether', slug: 'ether', usfm: null, bibleBookId: null, chapters: 15, en: 'Ether', zh: '以太書' },
      { key: 'moro', slug: 'moro', usfm: null, bibleBookId: null, chapters: 10, en: 'Moroni', zh: '摩羅乃書' },
    ],
  },
  {
    id: 'dc-testament',
    en: 'Doctrine and Covenants',
    zh: '教義和聖約',
    books: [
      { key: 'dc', slug: 'dc', usfm: null, bibleBookId: null, chapters: 138, en: 'D&C', zh: '教義和聖約' },
    ],
  },
  {
    id: 'pgp',
    en: 'Pearl of Great Price',
    zh: '無價珍珠',
    books: [
      { key: 'moses', slug: 'moses', usfm: null, bibleBookId: null, chapters: 8, en: 'Moses', zh: '摩西書' },
      { key: 'abr', slug: 'abr', usfm: null, bibleBookId: null, chapters: 5, en: 'Abraham', zh: '亞伯拉罕書' },
      { key: 'js-m', slug: 'js-m', usfm: null, bibleBookId: null, chapters: 1, en: 'Joseph Smith—Matthew', zh: '約瑟·斯密——馬太' },
      { key: 'js-h', slug: 'js-h', usfm: null, bibleBookId: null, chapters: 1, en: 'Joseph Smith—History', zh: '約瑟·斯密——歷史' },
      { key: 'a-of-f', slug: 'a-of-f', usfm: null, bibleBookId: null, chapters: 1, en: 'Articles of Faith', zh: '信條' },
    ],
  },
];

export const ALL_BOOKS: CatalogBook[] = SCRIPTURE_VOLUMES.flatMap((vol) =>
  vol.books.map((book) => ({
    ...book,
    volume: vol.id,
    volumeEn: vol.en,
    volumeZh: vol.zh,
  }))
);

export const BOOK_CATALOG: Record<string, CatalogBook> = Object.fromEntries(
  ALL_BOOKS.map((book) => [book.key, book])
);

export function getAdjacentChapter(
  bookKey: string,
  chapter: number,
  direction: 'prev' | 'next'
): { book: string; chapter: number } | null {
  const current = BOOK_CATALOG[bookKey];
  if (!current) return null;

  if (direction === 'prev') {
    if (chapter > 1) {
      return { book: bookKey, chapter: chapter - 1 };
    }
    const idx = ALL_BOOKS.findIndex((b) => b.key === bookKey);
    if (idx > 0) {
      const prevBook = ALL_BOOKS[idx - 1];
      return { book: prevBook.key, chapter: prevBook.chapters };
    }
    return null;
  }

  if (chapter < current.chapters) {
    return { book: bookKey, chapter: chapter + 1 };
  }
  const idx = ALL_BOOKS.findIndex((b) => b.key === bookKey);
  if (idx >= 0 && idx < ALL_BOOKS.length - 1) {
    const nextBook = ALL_BOOKS[idx + 1];
    return { book: nextBook.key, chapter: 1 };
  }
  return null;
}
