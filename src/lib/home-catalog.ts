export const FILTER_TAGS = [
  'Anotador',
  'Herramienta',
  'Registro',
  'Cartas',
  'Scoreboard',
  'Juego',
  'Libros',
  'Selector',
  'Externo',
  'PacMan',
  'Windows 98',
] as const

export type FilterTag = (typeof FILTER_TAGS)[number]

export type CoverCollection =
  | 'study'
  | 'casefile'
  | 'criollo'
  | 'laboratory'
  | 'ledger'
  | 'arcade'
  | 'retro98'
  | 'casino'

export type CoverStyle =
  | 'plate'
  | 'filigree'
  | 'stamped'
  | 'ledger'
  | 'neon'
  | 'window'
  | 'marquee'

type CatalogItemBase = {
  id: string
  icon: string
  tags: FilterTag[]
  chips: string[]
  title: string
  subtitle: string
  description: string
  collection: CoverCollection
  coverStyle: CoverStyle
  accent: string
  shelfLabel: string
}

export type InternalCatalogItem = CatalogItemBase & {
  kind: 'internal'
  to: string
}

export type ExternalCatalogItem = CatalogItemBase & {
  kind: 'external'
  href: string
}

export type CatalogItem = InternalCatalogItem | ExternalCatalogItem

export type FilterMeta = {
  eyebrow: string
  title: string
  description: string
}

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: '/tools/sudoku-killer',
    kind: 'internal',
    to: '/tools/sudoku-killer',
    icon: '🔢',
    tags: ['Herramienta'],
    chips: ['Sudoku', 'Killer', 'KrazyDad'],
    title: 'Sudoku Killer',
    subtitle: 'Resuelve cages, filtra dígitos y salta a PDFs de KrazyDad.',
    description: 'Solver de cages con filtros de dígitos, restricciones entre pares y acceso rápido a PDFs de KrazyDad.',
    collection: 'study',
    coverStyle: 'plate',
    accent: '#d3b36a',
    shelfLabel: 'Sudoku',
  },
  {
    id: 'external:dosto',
    kind: 'external',
    href: 'https://facundoraulbistolfi.github.io/dosto/',
    icon: '🪓',
    tags: ['Libros', 'Externo'],
    chips: ['Lectura', 'GitHub Pages'],
    title: 'Dosto',
    subtitle: 'Explora a Dostoievski con progreso, portadas y filtros temáticos.',
    description: 'Biblioteca personal interactiva de Dostoievski, con portadas ilustradas, progreso de lectura y filtros temáticos.',
    collection: 'study',
    coverStyle: 'filigree',
    accent: '#9b6f3f',
    shelfLabel: 'Lectura',
  },
  {
    id: '/tools/chinchon',
    kind: 'internal',
    to: '/tools/chinchon',
    icon: '🃏',
    tags: ['Anotador', 'Registro', 'Cartas', 'Scoreboard'],
    chips: ['Persistencia'],
    title: 'Anotador de Chinchón',
    subtitle: 'Marca rondas, chinchón y -10 con guardado de partida.',
    description: 'Configura jugadores, suma rondas, marca chinchón o -10, y guarda/carga el estado de la partida.',
    collection: 'criollo',
    coverStyle: 'filigree',
    accent: '#d77f45',
    shelfLabel: 'Naipes',
  },
  {
    id: '/tools/truco',
    kind: 'internal',
    to: '/tools/truco',
    icon: '🧉',
    tags: ['Anotador', 'Cartas', 'Scoreboard'],
    chips: ['Buenas/Malas'],
    title: 'Anotador de Truco',
    subtitle: 'Lleva buenas y malas con un tanteador criollo bien rápido.',
    description: 'Marcador de truco en palitos con buenas y malas, pensado para partidas rápidas entre nosotros y ellos.',
    collection: 'criollo',
    coverStyle: 'plate',
    accent: '#d9a23e',
    shelfLabel: 'Criollo',
  },
  {
    id: '/tools/chinchon-lab',
    kind: 'internal',
    to: '/tools/chinchon-lab',
    icon: '🧪',
    tags: ['Herramienta', 'Registro', 'Cartas'],
    chips: ['Arena', 'Bots', 'Pizarron'],
    title: 'Chinchón Lab',
    subtitle: 'Prueba bots, ensaya cortes y afina descarte en modo laboratorio.',
    description: 'Arena de bots y modo de juego para practicar cortes, chinchón y estrategia de descarte.',
    collection: 'laboratory',
    coverStyle: 'stamped',
    accent: '#63d2ab',
    shelfLabel: 'Lab',
  },
  {
    id: '/tools/pacman-memory',
    kind: 'internal',
    to: '/tools/pacman-memory',
    icon: '👻',
    tags: ['Juego', 'PacMan'],
    chips: ['Memoria', 'Multijugador'],
    title: 'Pac-Memory',
    subtitle: 'Memoria arcade multijugador con fantasmas, frutas y packs retro.',
    description: 'Juego de memoria con sprites retro de Pac-Man, Space Invaders, Tetris y más. Para 2-3 jugadores.',
    collection: 'arcade',
    coverStyle: 'neon',
    accent: '#53f4ff',
    shelfLabel: 'Arcade',
  },
  {
    id: '/tools/point-counter',
    kind: 'internal',
    to: '/tools/point-counter',
    icon: '➕',
    tags: ['Anotador', 'Registro', 'Scoreboard'],
    chips: ['Tap', 'Multijugador'],
    title: 'Contador de Puntos',
    subtitle: 'Suma puntos por jugador con taps rápidos y toolbox avanzada.',
    description: 'Marcador genérico por jugador con botones de color, suma rápida por toque y suma avanzada con long press.',
    collection: 'ledger',
    coverStyle: 'ledger',
    accent: '#68c7a6',
    shelfLabel: 'Mesa',
  },
  {
    id: '/tools/pacman-ludo',
    kind: 'internal',
    to: '/tools/pacman-ludo',
    icon: '🕹️',
    tags: ['Juego', 'PacMan'],
    chips: ['Tablero', 'Multijugador'],
    title: 'Pac-Ludo',
    subtitle: 'Corre al centro con fantasmas, capturas y caos de tablero.',
    description: 'Ludo temático de Pac-Man: movés fantasmas por el tablero, capturás rivales y llegás al centro.',
    collection: 'arcade',
    coverStyle: 'neon',
    accent: '#ffd34c',
    shelfLabel: 'Tablero',
  },

  {
    id: '/tools/sot',
    kind: 'internal',
    to: '/tools/sot',
    icon: '⛵',
    tags: ['Juego'],
    chips: ['Exploración', 'Roguelite', 'Mar'],
    title: 'Sea of Treasures',
    subtitle: 'Navega, explora y vuelve al puerto con el mayor botín posible.',
    description: 'Minijuego de exploración naval inspirado en el prototipo de sot.jsx: movete por un mapa, gestioná casco y víveres, y evitá tormentas mientras juntás oro.',
    collection: 'arcade',
    coverStyle: 'marquee',
    accent: '#4f8bd6',
    shelfLabel: 'Aventura',
  },
  {
    id: '/tools/evo-lab',
    kind: 'internal',
    to: '/tools/evo-lab',
    icon: '🧬',
    tags: ['Herramienta'],
    chips: ['Genético', 'Evolución', 'Simulación'],
    title: 'EvoLab',
    subtitle: 'Configura y observa un algoritmo genético evolucionando en vivo.',
    description: 'Laboratorio interactivo de algoritmos genéticos: ajustá selección, cruce y mutación, y mirá cómo una población se acerca al objetivo generación a generación.',
    collection: 'laboratory',
    coverStyle: 'stamped',
    accent: '#7c4dff',
    shelfLabel: 'Lab',
  },
  {
    id: 'external:mafia-god',
    kind: 'external',
    href: 'https://facundoraulbistolfi.github.io/mafia-god/',
    icon: '🔪',
    tags: ['Juego', 'Externo'],
    chips: ['Mafia', 'Sin narrador', 'Un celular'],
    title: 'Mafia God',
    subtitle: 'Dirige una partida de Mafia desde un solo celular, sin cartas ni narrador.',
    description: 'App web mobile first para jugar Mafia en grupo con un único dispositivo, revelación privada de roles y fases guiadas para evitar filtraciones accidentales.',
    collection: 'casefile',
    coverStyle: 'plate',
    accent: '#b55a49',
    shelfLabel: 'Mafia',
  },
  {
    id: 'external:win98maze',
    kind: 'external',
    href: 'https://facundoraulbistolfi.github.io/win98maze/',
    icon: '🖥️',
    tags: ['Juego', 'Windows 98', 'Externo'],
    chips: ['Laberinto'],
    title: 'Win98 Maze',
    subtitle: 'Recorre un laberinto 3D noventoso con minimapa configurable.',
    description: 'Laberinto 3D en primera persona con estética Windows 98, minimapa configurable y atmósfera retro.',
    collection: 'retro98',
    coverStyle: 'window',
    accent: '#12d1c8',
    shelfLabel: 'Win98',
  },
  {
    id: 'external:win98-battleship',
    kind: 'external',
    href: 'https://facundoraulbistolfi.github.io/win98_battleship/',
    icon: '🚢',
    tags: ['Juego', 'Windows 98', 'Externo'],
    chips: ['Batalla Naval'],
    title: 'Batalla Naval 98',
    subtitle: 'Hunde flotas con power-ups y estética Windows 98.',
    description: 'Batalla Naval con look Windows 98, power-ups, sonido retro y modos contra la compu o para dos jugadores.',
    collection: 'retro98',
    coverStyle: 'window',
    accent: '#4a8fff',
    shelfLabel: 'Win98',
  },
  {
    id: 'external:toca-toca',
    kind: 'external',
    href: 'https://facundoraulbistolfi.github.io/toca-toca/',
    icon: '🎡',
    tags: ['Selector', 'Externo'],
    chips: ['Ruleta', 'Casino', 'Turnos'],
    title: 'Toca Toca',
    subtitle: 'Gira una ruleta configurable para decidir turnos al instante.',
    description: 'Ruleta web configurable para decidir a quién le toca, con estadísticas persistentes y tono de casino.',
    collection: 'casino',
    coverStyle: 'marquee',
    accent: '#f2c55e',
    shelfLabel: 'Ruleta',
  },
]

export const FILTER_META: Record<FilterTag, FilterMeta> = {
  Anotador: {
    eyebrow: 'Mesa en curso',
    title: 'Anotadores al frente',
    description: 'Entradas pensadas para seguir una partida, anotar resultados y resolver la parte práctica sin frenar la mesa.',
  },
  Herramienta: {
    eyebrow: 'Utilidad central',
    title: 'Herramientas y laboratorios',
    description: 'Solvers, utilidades y espacios de práctica para cuando necesitás entender, probar o destrabar algo.',
  },
  Registro: {
    eyebrow: 'Memoria persistente',
    title: 'Entradas con registro',
    description: 'Herramientas que guardan historial, estado o progreso para volver más tarde sin empezar de cero.',
  },
  Cartas: {
    eyebrow: 'Baraja en mano',
    title: 'Universo de cartas',
    description: 'Todo lo conectado con mazos, partidas de cartas y pequeñas ayudas para seguirles el ritmo.',
  },
  Scoreboard: {
    eyebrow: 'Tanteador visible',
    title: 'Scoreboards y cuenta puntos',
    description: 'Marcadores rápidos para cuando la prioridad es tener el tanteo claro y accesible.',
  },
  Juego: {
    eyebrow: 'Desvío lúdico',
    title: 'Juegos y tableros',
    description: 'Experiencias jugables completas o pequeñas escapadas interactivas dentro del mismo compendio.',
  },
  Libros: {
    eyebrow: 'Estante editorial',
    title: 'Bibliotecas y lecturas',
    description: 'Entradas más contemplativas: catálogos, bibliotecas y proyectos pensados para recorrer con calma.',
  },
  Selector: {
    eyebrow: 'Decisión instantánea',
    title: 'Selectores y ruletas',
    description: 'Herramientas para decidir al azar, repartir turnos o resolver quién sigue sin vueltas.',
  },
  Externo: {
    eyebrow: 'Puertas vecinas',
    title: 'Portales externos',
    description: 'Proyectos que viven fuera de Ludario pero forman parte del mismo compendio curado.',
  },
  PacMan: {
    eyebrow: 'Retro arcade',
    title: 'Constelación PacMan',
    description: 'Entradas unidas por la misma vibra arcade y la iconografía de Pac-Man.',
  },
  'Windows 98': {
    eyebrow: 'Nostalgia de escritorio',
    title: 'Mundo Windows 98',
    description: 'Experiencias retro con estética de escritorio clásico, ventanas biseladas y sabor noventoso.',
  },
}

export const FAVORITES_STORAGE_KEY = 'ludario-favorites'
export const LEGACY_FAVORITES_STORAGE_KEY = 'tabletop-favorites'

export function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function catalogItemMatchesSearch(item: CatalogItem, query: string): boolean {
  if (!query) return true

  const haystack = normalizeSearchTerm([
    item.title,
    item.subtitle,
    item.description,
    item.shelfLabel,
    ...item.tags,
    ...item.chips,
  ].join(' '))

  return haystack.includes(query)
}

export function getVisibleCatalogItems(
  items: CatalogItem[],
  activeFilter: FilterTag | null,
  searchQuery: string,
): CatalogItem[] {
  const normalizedQuery = normalizeSearchTerm(searchQuery)

  return items.filter(item => {
    const matchesFilter = activeFilter === null || item.tags.includes(activeFilter)
    return matchesFilter && catalogItemMatchesSearch(item, normalizedQuery)
  })
}

export function getFavoriteCatalogItems(items: CatalogItem[], favorites: Set<string>): CatalogItem[] {
  return items.filter(item => favorites.has(item.id))
}

export function sortCatalogItemsByFavorites(items: CatalogItem[], favorites: Set<string>): CatalogItem[] {
  const favoriteItems = items.filter(item => favorites.has(item.id))
  const regularItems = items.filter(item => !favorites.has(item.id))

  return [...favoriteItems, ...regularItems]
}
