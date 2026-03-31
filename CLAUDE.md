# tabletop-helper — CLAUDE.md

Herramientas web para juegos de mesa, cartas y puzzles. Deployado en GitHub Pages.

🌐 **https://facundoraulbistolfi.github.io/tabletop-helper/**

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 18 |
| Lenguaje | TypeScript (strict) |
| Bundler | Vite 5 |
| Routing | React Router 6 — HashRouter |
| Estilos | CSS global + CSS Modules por tool |
| Testing | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

---

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo en localhost
npm run build      # type check + build de producción en dist/
npm run preview    # previsualizar el build local
npm test           # correr tests una vez (modo CI)
npm run test:watch # correr tests en modo watch (desarrollo)
```

---

## Estructura del proyecto

```
tabletop-helper/
├── public/
│   └── .nojekyll                  # evita que GitHub Pages procese con Jekyll
├── src/
│   ├── main.tsx                   # entrypoint: monta React + HashRouter
│   ├── App.tsx                    # definición de rutas
│   ├── vite-env.d.ts              # tipos de Vite (CSS modules, etc.)
│   ├── styles/
│   │   └── site.css               # estilos globales: topbar, cards, hero, layout
│   ├── components/
│   │   └── Topbar.tsx             # nav compartida, filtra el link de la página actual
│   ├── lib/
│   │   ├── sudoku-killer.ts       # lógica pura del solver (testeable)
│   │   └── sudoku-killer.test.ts  # tests de la lógica del solver
│   └── pages/
│       ├── Home.tsx               # landing con cards de las tools
│       ├── SudokuKiller.tsx       # solver de cages para Killer Sudoku
│       ├── SudokuKiller.module.css
│       ├── Chinchon.tsx           # anotador de puntajes para Chinchón
│       ├── Chinchon.module.css
│       ├── Truco.tsx              # anotador de truco (buenas/malas)
│       ├── Truco.module.css
│       ├── ChinchonArena.tsx      # arena de bots y modo de juego interactivo
│       ├── PacmanMemory.tsx       # memoria temática retro para 2–3 jugadores
│       └── PacmanLudo.tsx         # ludo temático de Pac-Man para 2–4 jugadores
├── index.html                     # entrypoint HTML de Vite
├── vite.config.ts                 # base: '/tabletop-helper/' para GitHub Pages
├── tsconfig.json                  # referencias a tsconfig.app.json y tsconfig.node.json
├── tsconfig.app.json              # config TS para src/ (strict, noUnusedLocals, etc.)
├── tsconfig.node.json             # config TS para vite.config.ts
└── .github/
    └── workflows/
        ├── ci.yml                 # PR check: tests + build (PRs y pushes a ramas)
        └── deploy.yml             # deploy: build → upload dist/ → GitHub Pages (solo main)
```

---

## Rutas

Usa **HashRouter**, por lo que las URLs tienen `#`:

| Ruta | Página |
|---|---|
| `/#/` | Home — landing con las tools |
| `/#/tools/sudoku-killer` | Sudoku Killer |
| `/#/tools/chinchon` | Anotador de Chinchón |
| `/#/tools/truco` | Anotador de Truco |
| `/#/tools/chinchon-lab` | Chinchón Lab |
| `/#/tools/pacman-memory` | Pac-Memory |
| `/#/tools/pacman-ludo` | Pac-Ludo |

HashRouter no requiere configuración de servidor, funciona en GitHub Pages sin 404.html.

---

## Estilos

- **`src/styles/site.css`** — estilos globales importados una sola vez en `main.tsx`. Contiene: topbar, brand, nav links, hero, cards, chips, layout (`.page`, `.grid`). Usa variables CSS (`--accent`, `--border`, `--muted`, etc.).
- **`src/pages/*.module.css`** — CSS Modules por tool. Se importan como `import styles from './Tool.module.css'` y se usan como `className={styles.panel}`. Evitan colisiones de nombres entre tools.
- Cada tool tiene su propio tema visual: Sudoku Killer usa fondo negro + `IBM Plex Mono`; Chinchón usa fondo verde + `Playfair Display`; Truco usa fondo inspirado en mesa de cartas.

---

## Convenciones

- **Un archivo por page** en `src/pages/`. Si la page crece, crear subcarpeta `src/pages/<tool>/` con `index.tsx` + componentes internos.
- **Componentes compartidos** en `src/components/`.
- **Lógica pura en `src/lib/`** — funciones sin dependencias de React, fáciles de testear unitariamente.
- **Sin lógica de negocio en el CSS** — toda la lógica en TSX, los estilos sólo presentación.
- **Estado local** con `useState`/`useMemo`. Si el estado necesita compartirse entre pages, agregar un contexto o Zustand.
- **TypeScript strict**: `noUnusedLocals` y `noUnusedParameters` activos. El build falla si hay variables sin usar.

## Tests

- Framework: **Vitest** (integrado con Vite, sin config extra).
- Los tests viven junto al código que testean: `src/lib/foo.ts` → `src/lib/foo.test.ts`.
- Se priorizan tests de **lógica pura** en `src/lib/`. Los componentes React se pueden testear con `@testing-library/react` si se agrega en el futuro.
- El CI corre `npm test` antes del build. Si los tests fallan, el build no se ejecuta.

---

## Agregar una nueva tool

1. Crear `src/pages/MiTool.tsx` y `src/pages/MiTool.module.css`.
2. Agregar la ruta en `src/App.tsx`:
   ```tsx
   <Route path="/tools/mi-tool" element={<MiTool />} />
   ```
3. Agregar la card en `src/pages/Home.tsx` (array `TOOLS`).
4. Agregar el link en `src/components/Topbar.tsx` (array `NAV_LINKS`).

---

## Deploy

El workflow `.github/workflows/deploy.yml` se dispara en cada push a `main`:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20, caché de npm)
3. `npm ci`
4. `npm run build` → genera `dist/`
5. `actions/upload-pages-artifact@v3` con `path: dist`
6. `actions/deploy-pages@v4`

Para que funcione, en GitHub hay que habilitar **Settings → Pages → Source: GitHub Actions**.

La URL base de Vite está configurada como `/tabletop-helper/` en `vite.config.ts` para que los assets apunten al subpath correcto.

---

## Herramientas actuales

### Sudoku Killer (`src/pages/SudokuKiller.tsx`)

Solver de cages para Killer Sudoku. Lógica:
- La lógica pura está en `src/lib/sudoku-killer.ts` y tiene tests en `src/lib/sudoku-killer.test.ts`.
- `computeCombinations(target, cells, excluded, required)` — recursivo, genera todas las combinaciones válidas de dígitos para una cage.
- Estado con `useState`: `size`, `sum`, `digitStates`, `pairStates`, `activeTab`, `kdDifficulty`, `kdVolume`, `kdBook`.
- `excluded` y `required` son `useMemo` sobre `digitStates`.
- `combos` y `freq` son `useMemo` que se recomputan automáticamente.
- Tab "KrazyDad" genera links a PDFs de krazydad.com según dificultad/volumen/libro.

### Anotador de Chinchón (`src/pages/Chinchon.tsx`)

Scoreboard para el juego de cartas Chinchón. Lógica:
- Tipos: `Player { name, scores, eliminated, chinchon }`, `Phase = 'setup' | 'game' | 'over'`.
- Límite: 100 puntos → eliminado. Chinchón termina la partida instantáneamente.
- `addRound()` procesa los puntajes, actualiza eliminados, avanza el dealer.
- Estado de partida serializable a JSON (`copyState` / `applyLoad`) para persistencia manual via clipboard.
- Componente `LoadBox` separado dentro del mismo archivo para el panel de carga.

### Anotador de Truco (`src/pages/Truco.tsx`)

Marcador de truco entre dos equipos con estado persistente local:
- Tanteador visual de palitos con separación entre malas y buenas.
- Cambio de turno de mano, control de objetivo de puntos y reset rápido de partida.
- Persistencia en `localStorage` para continuar partidas entre recargas.
