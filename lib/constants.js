/**
 * LeetVault — Constants  (ES module — imported by service-worker & lib)
 *
 * Language maps, organization modes, status tags, and default settings.
 */

/* ------------------------------------------------------------------ */
/*  Language → file extension                                         */
/* ------------------------------------------------------------------ */

/** Maps Monaco language IDs *and* LeetCode display names (lowercased) to extensions. */
export const LANG_EXT_MAP = Object.freeze({
  // Monaco IDs
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  python: 'py',
  python3: 'py',
  javascript: 'js',
  typescript: 'ts',
  csharp: 'cs',
  go: 'go',
  ruby: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  rust: 'rs',
  scala: 'scala',
  php: 'php',
  dart: 'dart',
  racket: 'rkt',
  erlang: 'erl',
  elixir: 'ex',
  mysql: 'sql',
  mssql: 'sql',
  oraclesql: 'sql',
  // LeetCode display names (normalised)
  'c++': 'cpp',
  'c#': 'cs',
});

/* ------------------------------------------------------------------ */
/*  Comment syntax per file extension  (for optional header)          */
/* ------------------------------------------------------------------ */

export const COMMENT_SYNTAX = Object.freeze({
  cpp:   { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  c:     { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  java:  { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  py:    { line: '#',  blockStart: '"""',   blockEnd: '"""' },
  js:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  ts:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  cs:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  go:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  rb:    { line: '#',  blockStart: '=begin', blockEnd: '=end' },
  swift: { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  kt:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  rs:    { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  scala: { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  php:   { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  dart:  { line: '//', blockStart: '/*',    blockEnd: '*/'  },
  rkt:   { line: ';',  blockStart: '#|',    blockEnd: '|#'  },
  erl:   { line: '%',  blockStart: null,    blockEnd: null   },
  ex:    { line: '#',  blockStart: null,    blockEnd: null   },
  sql:   { line: '--', blockStart: '/*',    blockEnd: '*/'  },
});

/* ------------------------------------------------------------------ */
/*  Organisation modes                                                */
/* ------------------------------------------------------------------ */

export const ORG_MODES = Object.freeze({
  FLAT:       'flat',
  DIFFICULTY: 'difficulty',
  CATEGORY:   'category',
  HYBRID:     'hybrid',
});

/* ------------------------------------------------------------------ */
/*  Status tags                                                       */
/* ------------------------------------------------------------------ */

export const STATUS_TAGS = Object.freeze({
  'Accepted':              'AC',
  'Wrong Answer':          'WA',
  'Runtime Error':         'RE',
  'Time Limit Exceeded':   'TLE',
  'Memory Limit Exceeded': 'MLE',
  'Compile Error':         'CE',
  'Output Limit Exceeded': 'OLE',
});

/* ------------------------------------------------------------------ */
/*  Default user settings                                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS = Object.freeze({
  orgMode:            ORG_MODES.FLAT,
  includeStatusTag:   false,
  includeDescription: false,
  theme:              'system',
});
