# tabletop-helper

> Herramientas web para juegos de mesa, cartas, sudokus y puzzles.

[![CI](https://github.com/facundoraulbistolfi/tabletop-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/facundoraulbistolfi/tabletop-helper/actions/workflows/ci.yml)
[![Deploy](https://github.com/facundoraulbistolfi/tabletop-helper/actions/workflows/deploy.yml/badge.svg)](https://github.com/facundoraulbistolfi/tabletop-helper/actions/workflows/deploy.yml)

**Sitio:** [facundoraulbistolfi.github.io/tabletop-helper](https://facundoraulbistolfi.github.io/tabletop-helper/)

---

## Herramientas

### Sudoku Killer
Solver de cages para Killer Sudoku. Ingresás el tamaño de la cage y la suma objetivo, filtrás dígitos excluidos o requeridos, y ves todas las combinaciones válidas con la frecuencia de cada dígito. Incluye acceso rápido a PDFs de KrazyDad por dificultad y volumen.

### Anotador de Chinchón
Scoreboard completo para el juego de cartas Chinchón. Configura de 2 a 6 jugadores, suma rondas, registra chinchones y penalizaciones de −10, y guarda/carga el estado de la partida via clipboard.

### Anotador de Truco
Marcador de truco en palitos con soporte de buenas/malas, pensado para partidas rápidas entre “nosotros” y “ellos”.

### Chinchón Lab
Arena de estrategias para Chinchón con bots, simulaciones y replay de manos. Permite comparar comportamientos entre bots, correr partidas espejo y jugar contra una IA en modo interactivo.

### Pac-Memory
Juego de memoria con sprites retro de Pac-Man, Space Invaders, Tetris y más. Modo multijugador para 2–3 personas, turnos automáticos y animaciones de volteo.

### Pac-Ludo
Ludo temático de Pac-Man: movés fichas de fantasmas por el tablero, capturás rivales y buscás llegar al centro. Para 2–4 jugadores.

---


## Rutas

- `/#/` → Home
- `/#/tools/sudoku-killer` → Sudoku Killer
- `/#/tools/chinchon` → Anotador de Chinchón
- `/#/tools/truco` → Anotador de Truco
- `/#/tools/chinchon-lab` → Chinchón Lab
- `/#/tools/pacman-memory` → Pac-Memory
- `/#/tools/pacman-ludo` → Pac-Ludo

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React 18 |
| Lenguaje | TypeScript (strict) |
| Bundler | Vite 5 |
| Routing | React Router 6 — HashRouter |
| Estilos | CSS global + CSS Modules por page |
| Testing | Vitest |
| Deploy | GitHub Actions → GitHub Pages |

---

## Desarrollo local

```bash
git clone https://github.com/facundoraulbistolfi/tabletop-helper.git
cd tabletop-helper
npm install
npm run dev        # abre en http://localhost:5173/tabletop-helper/
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
3. Agregar la card en `src/pages/Home.tsx` (array `TOOLS`).
4. Agregar el link en `src/components/Topbar.tsx` (array `NAV_LINKS`).

Ver [CLAUDE.md](./CLAUDE.md) para convenciones detalladas del proyecto.

---

## Deploy

Cada push a `main` dispara el workflow `deploy.yml`, que buildea y despliega automáticamente en GitHub Pages. Los PRs corren el workflow `ci.yml` (tests + build) como check obligatorio.
