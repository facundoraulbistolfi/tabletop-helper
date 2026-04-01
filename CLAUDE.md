# ludario — CLAUDE.md

SPA estática con utilidades y minijuegos para juegos de mesa, cartas, puzzles y scorekeeping casual. El producto corre entero en el navegador y se publica en GitHub Pages.

Sitio público: **https://facundoraulbistolfi.github.io/ludario/**

Este archivo y `AGENTS.md` deben mantenerse alineados. Si cambia el catálogo, la arquitectura o las convenciones, actualizar ambos.

---

## Definición del producto

`ludario` no es una sola tool: es un hub de herramientas ligeras para jugar mejor o resolver más rápido desde el teléfono o la compu, sin instalación ni cuenta.

Hoy la app se organiza en tres grupos:

- **Puzzles**: solvers y utilidades lógicas.
- **Cartas**: scoreboards, simuladores y laboratorios de estrategia.
- **Juegos**: minijuegos y contadores reutilizables.

La experiencia principal arranca en `Home`, con catálogo, favoritos locales y filtros por categoría. Desde ahí se navega a tools independientes que comparten shell, navegación y convenciones de estado.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 18 |
| Lenguaje | TypeScript |
| Bundler | Vite 5 |
| Routing | React Router 6 + `HashRouter` |
| Estilos | CSS global + CSS puntual por página (`CSS Modules` y hojas globales específicas) |
| Testing | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

Notas importantes:

- La home usa **lazy loading** para todas las tools no-home.
- Hay **prefetch suave** de rutas desde `Home` y `Topbar`.
- `Chinchón Lab` usa **Web Worker** para simulación, torneo y benchmark, evitando bloquear el main thread.

---

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
npm run test:watch
```

`npm run build` hace type-check y build de producción.  
`npm test` corre Vitest en modo CI.

---

## Catálogo actual

### Home
- Ruta: `/#/`
- Catálogo principal de tools con favoritos persistidos en `localStorage`.
- Filtros por categoría (`Puzzles`, `Cartas`, `Juegos`).

### Sudoku Killer
- Ruta: `/#/tools/sudoku-killer`
- Solver de cages para Killer Sudoku.
- Genera combinaciones válidas, frecuencias y accesos rápidos a PDFs de KrazyDad.

### Anotador de Chinchón
- Ruta: `/#/tools/chinchon`
- Scoreboard multijugador para partidas de Chinchón.
- Estado serializable para copiar/cargar manualmente.

### Anotador de Truco
- Ruta: `/#/tools/truco`
- Marcador visual de buenas y malas.
- Pensado para tanteo rápido entre dos equipos.

### Chinchón Lab
- Rutas: `/#/tools/chinchon-lab` y alias `/#/tools/chinchon-arena`
- Tool más compleja del repo.
- Incluye:
  - simulación espejo entre bots,
  - torneo por fechas,
  - replay de partidas,
  - modo jugar contra bot,
  - editor/import/export de bots custom,
  - reglas integradas.
- Usa lógica pura en `src/lib/` y worker en `src/workers/chinchon-lab.worker.ts`.

### Pac-Memory
- Ruta: `/#/tools/pacman-memory`
- Juego de memoria multijugador con temática retro.

### Pac-Ludo
- Ruta: `/#/tools/pacman-ludo`
- Ludo temático de Pac-Man para 2–4 jugadores.

### Contador de Puntos
- Ruta: `/#/tools/point-counter`
- Marcador genérico por jugador con suma rápida, toolbox por long press y persistencia local.

---

## Rutas

La app usa **HashRouter**, por lo que todas las URLs públicas cuelgan de `/#/`.

| Ruta | Pantalla |
|---|---|
| `/#/` | Home |
| `/#/tools/sudoku-killer` | Sudoku Killer |
| `/#/tools/chinchon` | Anotador de Chinchón |
| `/#/tools/truco` | Anotador de Truco |
| `/#/tools/chinchon-lab` | Chinchón Lab |
| `/#/tools/chinchon-arena` | Alias legacy de Chinchón Lab |
| `/#/tools/pacman-memory` | Pac-Memory |
| `/#/tools/pacman-ludo` | Pac-Ludo |
| `/#/tools/point-counter` | Contador de Puntos |

HashRouter evita configuración extra de servidor y funciona bien en GitHub Pages.

---

## Arquitectura actual

### Shell de app

- `src/App.tsx`
  - define rutas;
  - deja `Home` eager;
  - lazy-load de las demás pages con `Suspense`.
- `src/lib/page-loaders.ts`
  - centraliza loaders;
  - expone `lazyPage`;
  - expone `prefetchRoute(path)`.
- `src/components/Topbar.tsx`
  - nav compartida;
  - drawer mobile;
  - indica la vista actual;
  - prefetch al hover/focus.

### Home

- `src/pages/Home.tsx`
  - define catálogo visible (`TOOLS`);
  - maneja favoritos;
  - usa `prefetchRoute`.

### Lógica pura

- `src/lib/`
  - prioriza lógica sin dependencias de React;
  - es la capa preferida para reglas, simulación, helpers y métricas testeables.

Módulos clave actuales:

- `sudoku-killer.ts`
- `chinchon-bot-game.ts`
- `chinchon-sim-metrics.ts`
- `chinchon-tournament.ts`
- `chinchon-arena-sim.ts`
- `chinchon-bot-presets.ts`
- `chinchon-lab-worker-types.ts`

### Worker

- `src/workers/chinchon-lab.worker.ts`
  - corre simulación, torneo y benchmark de bots;
  - envía snapshots al main thread;
  - permite cancelación de jobs en progreso.

### Estilos

- `src/styles/site.css`
  - shell global, home, topbar, layout general.
- `src/styles/chinchon-arena-utilities.css`
  - capa visual específica de `Chinchón Lab`.
- `src/pages/*.module.css`
  - siguen siendo válidos para tools que conviene mantener aisladas.
  - Hoy `PointCounter` usa `PointCounter.module.css`.

Importante: ya no es correcto asumir “CSS Modules por tool” como regla universal. El repo mezcla CSS global del sitio, una hoja dedicada para `Chinchón Lab` y CSS Modules donde tienen sentido.

---

## Estructura del repo

```text
ludario/
├── public/
│   └── .nojekyll
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   └── Topbar.tsx
│   ├── lib/
│   │   ├── page-loaders.ts
│   │   ├── sudoku-killer.ts
│   │   ├── chinchon-bot-game.ts
│   │   ├── chinchon-sim-metrics.ts
│   │   ├── chinchon-tournament.ts
│   │   └── ...
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── SudokuKiller.tsx
│   │   ├── Chinchon.tsx
│   │   ├── Truco.tsx
│   │   ├── ChinchonArena.tsx
│   │   ├── PointCounter.tsx
│   │   ├── PacmanMemory.tsx
│   │   ├── PacmanLudo.tsx
│   │   └── chinchon-lab/
│   │       └── Layout.tsx
│   ├── styles/
│   │   ├── site.css
│   │   └── chinchon-arena-utilities.css
│   └── workers/
│       └── chinchon-lab.worker.ts
├── CHINCHON_REGLAS_ARGENTINAS.md
├── AGENTS.md
├── CLAUDE.md
├── README.md
└── vite.config.ts
```

---

## Convenciones de implementación

- Preferir lógica de negocio en `src/lib/`, no dentro de componentes.
- Mantener las pages como composición de UI + estado de vista; mover reglas y cálculos reutilizables afuera cuando crezcan.
- Si una page crece mucho:
  - crear subcarpeta en `src/pages/<tool>/`;
  - dejar layout/components internos allí.
- Mantener nombres de rutas, cards y navegación sincronizados entre:
  - `src/App.tsx`
  - `src/lib/page-loaders.ts`
  - `src/pages/Home.tsx`
  - `src/components/Topbar.tsx`
- No meter lógica de negocio en CSS.
- Si una feature pesada impacta interacción, considerar worker o extracción a helpers puros antes de seguir inflando el componente.

---

## Convenciones específicas de Chinchón Lab

`Chinchón Lab` es el módulo con más superficie funcional y donde más fácil es desalinear lógica, UI y reglamento.

Reglas de trabajo:

- La referencia normativa está en `CHINCHON_REGLAS_ARGENTINAS.md`.
- Cambios en corte, chinchón, comodines, espejo o scoring deben mantenerse alineados con:
  - `src/lib/chinchon-bot-game.ts`
  - `src/lib/chinchon-sim-metrics.ts`
  - `src/lib/chinchon-tournament.ts`
  - `src/pages/ChinchonArena.tsx`
- Si cambia comportamiento de simulación o torneo, agregar o actualizar tests en `src/lib/`.
- Si cambia la UX del lab, revisar mobile y desktop; es una pantalla muy densa y fácil de romper visualmente.

---

## Tests

Vitest corre sobre lógica pura del repo.

Suites actuales importantes:

- `src/lib/sudoku-killer.test.ts`
- `src/lib/chinchon-bot-game.test.ts`
- `src/lib/chinchon-sim-metrics.test.ts`
- `src/lib/chinchon-tournament.test.ts`

Convenciones:

- ubicar tests junto al módulo que testean;
- priorizar reglas, cálculos y agregaciones;
- no depender de componentes React salvo necesidad real.

El CI corre `npm test` antes de `npm run build`.

---

## Agregar una nueva tool

1. Crear la page en `src/pages/`.
2. Si necesita carga diferida, agregar loader en `src/lib/page-loaders.ts`.
3. Agregar la ruta en `src/App.tsx`.
4. Agregar la card en `src/pages/Home.tsx`.
5. Agregar el link en `src/components/Topbar.tsx`.
6. Si tiene lógica propia, crear helpers en `src/lib/` y tests si corresponde.
7. Si requiere estilo aislado, decidir entre CSS Module o hoja dedicada según el alcance.

---

## Deploy

El deploy productivo va a GitHub Pages.

Puntos importantes:

- `vite.config.ts` usa base `/ludario/`.
- GitHub Actions builda con Node 20.
- `deploy.yml` publica `dist/` en Pages.
- `ci.yml` corre tests + build en pushes y PRs.

Antes de mergear cambios grandes:

```bash
npm test
npm run build
```

---

## Resumen operativo

Cuando trabajes en este repo, asumí esto:

- es una app catálogo de tools, no una sola page;
- `Home`, `Topbar`, `App` y `page-loaders` forman el shell compartido;
- `Chinchón Lab` es el subsistema más complejo y merece cuidado especial;
- `AGENTS.md` y `CLAUDE.md` deben contar la misma verdad del proyecto.
