# 📚 Ludario

> Herramientas web para juegos de mesa, cartas, sudokus y puzzles.

[![CI](https://github.com/facundoraulbistolfi/ludario/actions/workflows/ci.yml/badge.svg)](https://github.com/facundoraulbistolfi/ludario/actions/workflows/ci.yml)
[![Deploy](https://github.com/facundoraulbistolfi/ludario/actions/workflows/deploy.yml/badge.svg)](https://github.com/facundoraulbistolfi/ludario/actions/workflows/deploy.yml)

**Sitio:** [facundoraulbistolfi.github.io/ludario](https://facundoraulbistolfi.github.io/ludario/)

La home funciona como biblioteca principal del proyecto y cada mini app comparte un botón flotante `📚` para volver al inicio sin toolbar pesado. Todo el catálogo vive en una sola grilla filtrable, con favoritos locales tanto para tools internas como para portales externos curados, y filtros pensados como etiquetas de uso o temática.

---

## Herramientas

### Sudoku Killer
Solver de cages para Killer Sudoku. Ingresás el tamaño de la cage y la suma objetivo, filtrás dígitos excluidos o requeridos, y ves todas las combinaciones válidas con la frecuencia de cada dígito. Incluye acceso rápido a PDFs de KrazyDad por dificultad y volumen.

### Anotador de Chinchón
Scoreboard completo para el juego de cartas Chinchón. Configura de 2 a 6 jugadores, suma rondas, registra chinchones y penalizaciones de −10, y guarda/carga el estado de la partida via clipboard.

### Anotador de Truco
Marcador de truco en palitos con soporte de buenas/malas, pensado para partidas rápidas entre “nosotros” y “ellos”.

### Chinchón Lab
Arena de estrategias para Chinchón con bots, simulaciones y replay de manos. Permite comparar comportamientos entre bots con métricas separadas de partidas, rondas, rondas espejo y rondas sin espejo, jugar contra una IA en modo interactivo y evolucionar bots con una pestaña `🧬 Evolución` que usa algoritmos genéticos con criterio de fitness configurable dentro del mismo lab.

### EvoLab
Laboratorio interactivo de algoritmos genéticos. Configura población, selección (torneo/ruleta), cruce y mutación, y observá cómo una población evoluciona generación a generación para acercarse a un patrón objetivo. Incluye curvas de fitness, inspector de individuo y presets didácticos.

### Pac-Memory
Juego de memoria con sprites retro de Pac-Man, Space Invaders, Tetris y más. Modo multijugador para 2–3 personas, turnos automáticos y animaciones de volteo.

### Pac-Ludo
Ludo temático de Pac-Man: elegís entre los cuatro fantasmas clásicos, Pac-Man o Ms. Pac-Man, movés sprites direccionales por el tablero, capturás rivales y buscás llegar al centro. Para 2–4 jugadores.

### Dosto
Portal externo invitado dentro de la home. Abre [Dosto](https://facundoraulbistolfi.github.io/dosto/), una biblioteca personal interactiva sobre Dostoievski publicada aparte en GitHub Pages.

### Win98 Maze
Portal externo invitado dentro de la home. Abre [Win98 Maze](https://facundoraulbistolfi.github.io/win98maze/), un laberinto 3D en primera persona con estética Windows 98.

### Batalla Naval 98
Portal externo invitado dentro de la home. Abre [Batalla Naval 98](https://facundoraulbistolfi.github.io/win98_battleship/), una batalla naval retro con look Windows 98 y power-ups.

### Toca Toca
Portal externo invitado dentro de la home. Abre [Toca Toca](https://facundoraulbistolfi.github.io/toca-toca/), una ruleta web estilo casino para decidir a quién le toca.

---


## Rutas

- `/#/` → Home
- `/#/tools/sudoku-killer` → Sudoku Killer
- `/#/tools/chinchon` → Anotador de Chinchón
- `/#/tools/truco` → Anotador de Truco
- `/#/tools/chinchon-lab` → Chinchón Lab
- `/#/tools/pacman-memory` → Pac-Memory
- `/#/tools/pacman-ludo` → Pac-Ludo
- `/#/tools/point-counter` → Contador de Puntos
- `/#/tools/evo-lab` → EvoLab

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 18 |
| Lenguaje | TypeScript (strict) |
| Bundler | Vite 5 |
| Routing | React Router 6 — HashRouter |
| Estilos | CSS global + hojas dedicadas cuando conviene + CSS Modules puntuales |
| Testing | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

---

## Desarrollo local

Node recomendado: **20.x** (el repo incluye `.nvmrc` y `package.json.engines` para alinear local con CI/GitHub Actions).

```bash
git clone https://github.com/facundoraulbistolfi/ludario.git
cd ludario
nvm use
npm install
npm run dev        # abre en http://localhost:5173/ludario/
```

Otros comandos:

```bash
npm run build      # type-check + build de producción en dist/
npm run preview    # previsualizar el build local
npm test           # correr tests (modo CI)
npm run test:watch # correr tests en modo watch
```

---

## Agregar una nueva herramienta

1. Crear `src/pages/MiTool.tsx` y `src/pages/MiTool.module.css`.
2. Agregar la ruta en `src/App.tsx`.
3. Agregar la entrada en `src/lib/home-catalog.ts` (`CATALOG_ITEMS`).
4. Si querés sumar un portal externo curado, agregalo ahí para que aparezca en la home sin route interna.
5. El botón flotante `📚` para volver al inicio ya se aplica desde `src/App.tsx`, así que no hace falta mantener una nav manual por tool.

Ver [CLAUDE.md](./CLAUDE.md) para convenciones detalladas del proyecto.

---

## Deploy

Cada push a `main` dispara el workflow `deploy.yml`, que buildea y despliega automáticamente en GitHub Pages. Los PRs corren el workflow `ci.yml` (tests + build) como check obligatorio.
