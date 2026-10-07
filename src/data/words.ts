import type { Lang } from '../engine/keyboard';
import { EN_WORDS } from './en-words';
import { TH_WORDS } from './th-words';

export const WORDS: Record<Lang, readonly string[]> = { en: EN_WORDS, th: TH_WORDS };
