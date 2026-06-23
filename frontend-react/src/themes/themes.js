/**
 * Apex POB Themes
 * Each theme defines sidebar/topbar/content colors and an Ant Design token set.
 * algorithmKey: 'default' | 'dark' — resolved in ThemeContext to the actual algorithm.
 */

const LAYOUT = {
  headerHeight:    56,
  sidebarWidth:    240,
  sidebarCollapsed: 56,
};

export const THEMES = [
  /* ── 1. Ocean Blue (default) ─────────────────────────── */
  {
    key:  'ocean-blue',
    name: 'Ocean Blue',
    preview: ['#1E2A3B', '#0078D4', '#FFFFFF', '#F3F4F8'],
    algorithmKey: 'default',
    colors: {
      ...LAYOUT,
      sidebarBg:           '#1E2A3B',
      sidebarBgHover:      'rgba(255,255,255,0.07)',
      sidebarActive:       'rgba(0,120,212,0.18)',
      sidebarActiveBorder: '#0078D4',
      sidebarText:         '#C9D1D9',
      sidebarTextActive:   '#FFFFFF',
      sidebarGroupLabel:   '#8892A4',
      topbarBg:            '#FFFFFF',
      topbarBorder:        '#E1E4E8',
      contentBg:           '#F3F4F8',
      accentBlue:          '#0078D4',
      accentBlueDark:      '#005A9E',
      topbarIconColor:     '#6B7A8D',
      topbarTextColor:     '#1F2937',
      topbarMutedColor:    '#9CA3AF',
      menuHoverBg:         '#F5F7FA',
    },
    antdToken: {
      colorPrimary:  '#0078D4',
      colorSuccess:  '#52c41a',
      colorWarning:  '#faad14',
      colorError:    '#ff4d4f',
      colorInfo:     '#0078D4',
      borderRadius:  6,
    },
  },

  /* ── 2. Forest Green ─────────────────────────────────── */
  {
    key:  'forest',
    name: 'Forest Green',
    preview: ['#14532d', '#16a34a', '#FFFFFF', '#f0fdf4'],
    algorithmKey: 'default',
    colors: {
      ...LAYOUT,
      sidebarBg:           '#14532d',
      sidebarBgHover:      'rgba(255,255,255,0.07)',
      sidebarActive:       'rgba(22,163,74,0.22)',
      sidebarActiveBorder: '#4ade80',
      sidebarText:         '#bbf7d0',
      sidebarTextActive:   '#FFFFFF',
      sidebarGroupLabel:   '#6ee7b7',
      topbarBg:            '#FFFFFF',
      topbarBorder:        '#d1fae5',
      contentBg:           '#f0fdf4',
      accentBlue:          '#16a34a',
      accentBlueDark:      '#15803d',
      topbarIconColor:     '#6B7A8D',
      topbarTextColor:     '#1F2937',
      topbarMutedColor:    '#9CA3AF',
      menuHoverBg:         '#f0fdf4',
    },
    antdToken: {
      colorPrimary:  '#16a34a',
      colorSuccess:  '#52c41a',
      colorWarning:  '#faad14',
      colorError:    '#ff4d4f',
      colorInfo:     '#16a34a',
      borderRadius:  6,
    },
  },

  /* ── 3. Midnight Purple ──────────────────────────────── */
  {
    key:  'midnight',
    name: 'Midnight Purple',
    preview: ['#1e1b4b', '#7c3aed', '#FFFFFF', '#f5f3ff'],
    algorithmKey: 'default',
    colors: {
      ...LAYOUT,
      sidebarBg:           '#1e1b4b',
      sidebarBgHover:      'rgba(255,255,255,0.07)',
      sidebarActive:       'rgba(124,58,237,0.22)',
      sidebarActiveBorder: '#a78bfa',
      sidebarText:         '#c4b5fd',
      sidebarTextActive:   '#FFFFFF',
      sidebarGroupLabel:   '#818cf8',
      topbarBg:            '#FFFFFF',
      topbarBorder:        '#e0e7ff',
      contentBg:           '#f5f3ff',
      accentBlue:          '#7c3aed',
      accentBlueDark:      '#6d28d9',
      topbarIconColor:     '#6B7A8D',
      topbarTextColor:     '#1F2937',
      topbarMutedColor:    '#9CA3AF',
      menuHoverBg:         '#f5f3ff',
    },
    antdToken: {
      colorPrimary:  '#7c3aed',
      colorSuccess:  '#52c41a',
      colorWarning:  '#faad14',
      colorError:    '#ff4d4f',
      colorInfo:     '#7c3aed',
      borderRadius:  6,
    },
  },

  /* ── 4. Sunset Orange ────────────────────────────────── */
  {
    key:  'sunset',
    name: 'Sunset',
    preview: ['#431407', '#ea580c', '#FFFFFF', '#fff7ed'],
    algorithmKey: 'default',
    colors: {
      ...LAYOUT,
      sidebarBg:           '#431407',
      sidebarBgHover:      'rgba(255,255,255,0.07)',
      sidebarActive:       'rgba(234,88,12,0.22)',
      sidebarActiveBorder: '#fb923c',
      sidebarText:         '#fed7aa',
      sidebarTextActive:   '#FFFFFF',
      sidebarGroupLabel:   '#f97316',
      topbarBg:            '#FFFFFF',
      topbarBorder:        '#ffedd5',
      contentBg:           '#fff7ed',
      accentBlue:          '#ea580c',
      accentBlueDark:      '#c2410c',
      topbarIconColor:     '#6B7A8D',
      topbarTextColor:     '#1F2937',
      topbarMutedColor:    '#9CA3AF',
      menuHoverBg:         '#fff7ed',
    },
    antdToken: {
      colorPrimary:  '#ea580c',
      colorSuccess:  '#52c41a',
      colorWarning:  '#faad14',
      colorError:    '#ff4d4f',
      colorInfo:     '#ea580c',
      borderRadius:  6,
    },
  },

  /* ── 5. Slate (Corporate) ────────────────────────────── */
  {
    key:  'slate',
    name: 'Slate',
    preview: ['#0f172a', '#64748b', '#FFFFFF', '#f1f5f9'],
    algorithmKey: 'default',
    colors: {
      ...LAYOUT,
      sidebarBg:           '#0f172a',
      sidebarBgHover:      'rgba(255,255,255,0.06)',
      sidebarActive:       'rgba(100,116,139,0.25)',
      sidebarActiveBorder: '#94a3b8',
      sidebarText:         '#94a3b8',
      sidebarTextActive:   '#FFFFFF',
      sidebarGroupLabel:   '#475569',
      topbarBg:            '#FFFFFF',
      topbarBorder:        '#e2e8f0',
      contentBg:           '#f1f5f9',
      accentBlue:          '#475569',
      accentBlueDark:      '#334155',
      topbarIconColor:     '#6B7A8D',
      topbarTextColor:     '#1F2937',
      topbarMutedColor:    '#9CA3AF',
      menuHoverBg:         '#f8fafc',
    },
    antdToken: {
      colorPrimary:  '#475569',
      colorSuccess:  '#52c41a',
      colorWarning:  '#faad14',
      colorError:    '#ff4d4f',
      colorInfo:     '#475569',
      borderRadius:  6,
    },
  },
];

export const DEFAULT_THEME_KEY = 'ocean-blue';
export const STORAGE_KEY       = 'pob_theme';

export const getTheme = (key) =>
  THEMES.find(t => t.key === key) ?? THEMES[0];
