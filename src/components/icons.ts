import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Contrast,
  Copy,
  Download,
  Ear,
  ExternalLink,
  Eye,
  Flame,
  Gauge,
  GraduationCap,
  History,
  House,
  Info,
  Languages,
  Layers,
  Lightbulb,
  ListChecks,
  ListFilter,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  Mic,
  MicOff,
  Minus,
  Monitor,
  Moon,
  NotebookPen,
  Package,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Route,
  Ruler,
  RotateCcw,
  Search,
  SkipForward,
  Square,
  Settings2,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Sun,
  Tag,
  Trash2,
  Turtle,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Type,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icon set, behind a seam.
 *
 * Lucide (ISC, ~1,600 icons, one 24px grid and a 2px stroke throughout) is the
 * vendor, and this is the only file allowed to know that — the same rule
 * `src/app/services.ts` applies to TTS and storage, for the same reason. A
 * screen asks for `practice`, not for `Target`, so changing icon sets is an edit
 * to this map rather than to forty call sites, and the map itself is the list of
 * every concept the app has an icon for.
 *
 * Names are *semantic*, never pictorial: `listen` rather than `ear`. A pictorial
 * name is how two screens end up illustrating the same idea with different
 * glyphs, and how a better icon for an idea becomes unadoptable because six
 * files hard-coded the old drawing's name.
 */
export const ICONS = {
  // Navigation destinations. These are the app's five nouns, so they get the
  // most distinct silhouettes in the set rather than the most literal ones.
  /* Where a learner lands: the course itself, not an activity. It is the one
     nav name that is pictorial, because a house is what every app on the phone
     has trained the thumb to look for in that position — and a more semantic
     drawing would be worse at the only job it has. */
  home: House,
  practice: Target,
  read: BookOpen,
  browse: Search,
  progress: ChartColumn,
  settings: Settings2,

  // Chrome and movement.
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,
  expand: ChevronDown,
  collapse: ChevronUp,
  next: ChevronRight,
  previous: ChevronLeft,
  skip: SkipForward,
  update: RefreshCw,
  share: Share2,
  copy: Copy,
  link: ExternalLink,
  add: Plus,
  remove: Minus,
  download: Download,
  delete: Trash2,

  // Audio and voice.
  speak: Volume2,
  listen: Ear,
  record: Mic,
  play: Play,
  pause: Pause,
  stop: Square,
  /* "Say it more slowly" — the one place a picture beats a word, and the reason
     the app had a turtle emoji here before the set existed. */
  slow: Turtle,
  again: RotateCcw,
  silent: VolumeX,
  recordOff: MicOff,

  // Theme, which is the one place a pictorial name *is* the semantic one.
  themeLight: Sun,
  themeDark: Moon,
  themeSystem: Monitor,
  /* The contrast axis, which is a separate choice from the palette. */
  contrast: Contrast,

  // Verdicts and learning state. `correct`/`incorrect` are the graded pair;
  // `check` is a plain tick for a list, and deliberately not the same drawing.
  correct: CircleCheck,
  incorrect: CircleX,
  check: Check,
  hint: Lightbulb,
  reveal: Eye,
  explain: Info,
  unknown: CircleHelp,

  // Content and filters.
  topic: Tag,
  filter: ListFilter,
  level: Layers,
  language: Languages,
  word: Type,
  grammar: Ruler,
  passage: NotebookPen,
  /* A content pack: an add-on with its own version, licence and contents. */
  pack: Package,
  /* A mission — a route through material towards one real-world outcome. */
  mission: Route,
  /* A batch: a bounded set of material the learner assembled, worked through
     until absorbed. A checklist rather than a stack, because what makes one
     legible is how much of it is done. */
  batch: ListChecks,
  shuffle: Shuffle,

  // Reference facets: the kinds of thing a card says *about* a phrase, as
  // opposed to the phrase itself. Each one is a colour and a glyph in
  // `src/styles/semantics.ts`, so the set here and the hue set there have to
  // stay the same length.
  /* What it says in the learner's own language. Deliberately not `language`,
     which is the target-language axis — the same drawing for both would say
     that choosing Spanish and reading an English gloss are one idea. */
  meaning: MessageSquareQuote,
  /* An authored aside about a phrase: when to use it, what it implies. */
  note: StickyNote,
  /* Who you may say this to — the `tu`/`usted` choice, and its consequences. */
  audience: Users,
  /* How it sounds: casual, formal, slang, vulgar. */
  tone: MessageCircle,
  /* Where it is said. A pin rather than a globe: the fact is regional. */
  place: MapPin,

  // Progress and reward. Kept few on purpose: every icon here is a claim about
  // what a learner achieved, and the app only makes claims it can evidence.
  due: Clock,
  history: History,
  streak: Flame,
  mastered: Trophy,
  improving: TrendingUp,
  slipping: TrendingDown,
  accuracy: Gauge,
  quick: Zap,
  memory: Brain,
  study: GraduationCap,
  new: Sparkles,
  tune: SlidersHorizontal,
  theme: Palette,
  waveform: Waves,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Matched to the type an icon sits beside, from the `--icon-*` primitives. */
export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Every name in the set, sorted — what the style guide enumerates so a new
 * entry in the map above appears on that page without anyone editing it.
 */
export const ICON_NAMES = Object.keys(ICONS).sort() as readonly IconName[];
