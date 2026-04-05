import { lazy, type LazyExoticComponent, type ComponentType } from 'react'

type PageModule = { default: ComponentType }
type PageLoader = () => Promise<PageModule>

export const pageLoaders = {
  sudokuKiller: () => import('../pages/SudokuKiller'),
  chinchon: () => import('../pages/Chinchon'),
  pacmanMemory: () => import('../pages/PacmanMemory'),
  pacmanLudo: () => import('../pages/PacmanLudo'),
  chinchonLab: () => import('../pages/ChinchonArena'),
  truco: () => import('../pages/Truco'),
  pointCounter: () => import('../pages/PointCounter'),
  evoLab: () => import('../pages/EvoLab'),
} satisfies Record<string, PageLoader>

const routePrefetchers: Record<string, PageLoader> = {
  '/tools/sudoku-killer': pageLoaders.sudokuKiller,
  '/tools/chinchon': pageLoaders.chinchon,
  '/tools/pacman-memory': pageLoaders.pacmanMemory,
  '/tools/pacman-ludo': pageLoaders.pacmanLudo,
  '/tools/chinchon-lab': pageLoaders.chinchonLab,
  '/tools/chinchon-arena': pageLoaders.chinchonLab,
  '/tools/truco': pageLoaders.truco,
  '/tools/point-counter': pageLoaders.pointCounter,
  '/tools/evo-lab': pageLoaders.evoLab,
}

const prefetchedRoutes = new Set<string>()

export function lazyPage(loader: PageLoader): LazyExoticComponent<ComponentType> {
  return lazy(loader)
}

export function prefetchRoute(path: string) {
  const load = routePrefetchers[path]
  if (!load || prefetchedRoutes.has(path)) return
  prefetchedRoutes.add(path)
  void load()
}
