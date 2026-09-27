import type { NoticeListItem } from '@shared/api/types.ts';
import { CATEGORIES, type Category } from '@shared/categories.ts';
import type { CSSProperties } from 'react';

export { CATEGORIES, type Category };

/** Chip tint per AI category — one distinct, accessible color per category (tokens.css). */
export const CATEGORY_TINT: Record<Category, string> = {
  장학금: 'var(--cat-scholarship)',
  학사: 'var(--lavender)',
  '모집/선발': 'var(--cat-recruit)',
  '행사/특강': 'var(--tint-event)',
  '취업/진로': 'var(--tint-career)',
  국제교류: 'var(--tint-intl)',
  '시설/생활': 'var(--tint-life)',
  기타: 'transparent',
};

/** Filter value for notices that have no AI analysis yet. */
export const PENDING_FILTER = '분석 대기';

/**
 * The notice's category color as a CSS custom property (--cat), for anywhere that colors an
 * event chip by category instead of a plain chip (calendar, the home page's "다가오는 일정" list).
 * 기타's card tint is intentionally "transparent" (a plain outline chip in the list), but a
 * transparent fill/border would make a filled/outlined event chip unreadable, so it substitutes
 * a real dark neutral (--cat-other) there instead.
 */
export function categoryCssVar(notice: NoticeListItem): CSSProperties | undefined {
  if (!notice.analysis) return undefined;
  const tint = CATEGORY_TINT[notice.analysis.category];
  return { '--cat': tint === 'transparent' ? 'var(--cat-other)' : tint } as CSSProperties;
}
