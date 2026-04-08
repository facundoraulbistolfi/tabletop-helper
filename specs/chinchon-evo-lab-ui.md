# Chinchón EvoLab — Spec de UI

> Wireframes textuales y descripción de la interfaz de usuario para la pestaña "🧬 Evolución" dentro de Chinchón Lab.

---

## 1. Ubicación en el tab system

La pestaña se agrega al final de `LAB_TABS`, antes de "📜 Reglas":

```
🧪 Sim | 🏆 Torneo | 🎬 Partida | 🃏 Jugar | 🤖 Bots | 🧬 Evo | 📜 Reglas
                                                          ^^^^^^^^
```

- **Desktop**: "🧬 Evolución"
- **Mobile**: "🧬 Evo"

---

## 2. Estados de la pantalla

La pestaña tiene tres estados principales:

| Estado | Cuándo | Qué se muestra |
|--------|--------|----------------|
| **Config** | Antes de iniciar | Formulario de configuración |
| **Running** | Durante la evolución | Progreso en tiempo real |
| **Done** | Al terminar | Resultado final + acciones |

---

## 3. Estado: Config (antes de iniciar)

```
┌──────────────────────────────────────────────────────────┐
│  🧬 Evolución                                            │
│  Evolucioná un bot para que supere a un rival usando     │
│  algoritmos genéticos.                                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ▼ Bots                                        [abierto] │
│  ┌────────────────────────────────────────────┐          │
│  │  Bot rival (a superar)                     │          │
│  │  ┌──────────────────────────────────────┐  │          │
│  │  │ [▾ FacuTron 🤖                     ] │  │          │
│  │  └──────────────────────────────────────┘  │          │
│  │  Descripción del bot seleccionado...       │          │
│  │                                            │          │
│  │  Bot semilla (punto de partida)            │          │
│  │  ┌──────────────────────────────────────┐  │          │
│  │  │ [▾ FacuTron 🤖                     ] │  │          │
│  │  └──────────────────────────────────────┘  │          │
│  │  ☐ Usar el mismo bot como rival y semilla  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ▼ Población y evaluación                     [abierto]  │
│  ┌────────────────────────────────────────────┐          │
│  │  Población          ──●──────── 30         │          │
│  │  ? Cantidad de bots variantes por gen.     │          │
│  │                                            │          │
│  │  Partidas por evaluación ──●──── 30        │          │
│  │  ? Partidas espejo para medir win rate.    │          │
│  │                                            │          │
│  │  Generaciones máx.  ────●─────── 50        │          │
│  │                                            │          │
│  │  Elitismo           ●───────────── 2       │          │
│  │  ? Mejores individuos que pasan intactos.  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ▶ Operadores genéticos                      [cerrado]   │
│                                                          │
│  ▶ Condiciones de corte                      [cerrado]   │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │      [ 🧬 Iniciar evolución ]              │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Sección "Operadores genéticos" (expandible)

```
│  ▼ Operadores genéticos                       [abierto]  │
│  ┌────────────────────────────────────────────┐          │
│  │  Selección                                 │          │
│  │  ┌──────────────────────────────────────┐  │          │
│  │  │ [▾ Torneo                          ] │  │          │
│  │  └──────────────────────────────────────┘  │          │
│  │  k (tamaño torneo) ──●──────── 3          │          │
│  │                                            │          │
│  │  Tasa de cruce     ─────●────── 0.80       │          │
│  │  ? Prob. de que dos padres intercambien    │          │
│  │    material genético.                      │          │
│  │                                            │          │
│  │  Tasa de mutación  ───●──────── 0.15       │          │
│  │  ? Prob. de que cada gen mute.             │          │
│  │                                            │          │
│  │  Sigma (intensidad) ──●─────── 1.5         │          │
│  │  ? Desviación estándar de la perturbación  │          │
│  │    gaussiana. Más alto = cambios mayores.  │          │
│  └────────────────────────────────────────────┘          │
```

### Sección "Condiciones de corte" (expandible)

```
│  ▼ Condiciones de corte                       [abierto]  │
│  ┌────────────────────────────────────────────┐          │
│  │  ☑ Parar si el mejor supera al rival por   │          │
│  │    margen absoluto  ─────●──── 50 pts       │          │
│  │    (equivale a ~55% win rate)               │          │
│  │                                             │          │
│  │  ☑ Parar si el win rate supera              │          │
│  │    ────────────●────── 60%                  │          │
│  │                                             │          │
│  │  ☑ Parar por estancamiento después de       │          │
│  │    ──────●────── 15 generaciones sin mejora │          │
│  └─────────────────────────────────────────────┘         │
```

### Componentes usados

- **LabPanel**: título + subtítulo de la sección
- **LabAccordionSection**: secciones colapsables (Operadores, Condiciones de corte)
- **Select dropdown**: selección de bots (reutilizar pattern existente de selección de bots del modo Sim)
- **SliderField**: sliders con valor numérico (reutilizar pattern de EvoLab ConfigForm)
- **Checkbox**: para toggles de condiciones de corte y "mismo bot"

---

## 4. Estado: Running (durante la evolución)

```
┌──────────────────────────────────────────────────────────┐
│  🧬 Evolución                                            │
│  Evolucionando contra FacuTron 🤖...                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  Generación 23 / 50                        │          │
│  │  ████████████████████░░░░░░░░░░  46%       │          │
│  │                                            │          │
│  │  Partidas jugadas: 41,400                  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │          Curvas de fitness                  │          │
│  │                                            │          │
│  │  800│        ___──── Mejor                 │          │
│  │     │     __/                              │          │
│  │  600│  __/                                 │          │
│  │     │_/           ── Promedio              │          │
│  │  500│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (rival)     │          │
│  │     │                                      │          │
│  │  400│  \__                                 │          │
│  │     │     ─── Peor                         │          │
│  │  200│                                      │          │
│  │     └────────────────────────────          │          │
│  │      0    5   10   15   20   Gen           │          │
│  │                                            │          │
│  │  ── Mejor  ── Promedio  ── Peor            │          │
│  │  ─ ─ Línea rival (500)                     │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  Mejor actual                              │          │
│  │  Win rate: 57.3% (fitness: 573)            │          │
│  │  Generación encontrado: 18                 │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │         [ ⏹ Detener evolución ]            │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Notas sobre el gráfico de fitness

- **Línea verde**: mejor fitness por generación
- **Línea amarilla**: fitness promedio por generación
- **Línea roja**: peor fitness por generación
- **Línea punteada horizontal en 500**: referencia del rival (50% = empate)
- Reutilizar el patrón SVG de `FitnessChart.tsx` de EvoLab, adaptado al rango 0–1000

### Actualización de progreso

- Se actualiza una vez por generación completada
- El gráfico crece a medida que se completan generaciones
- La barra de progreso muestra `generación actual / generaciones máx`

---

## 5. Estado: Done (resultado final)

```
┌──────────────────────────────────────────────────────────┐
│  🧬 Evolución                                            │
│  Evolución completada contra FacuTron 🤖                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  ✓ Evolución completada                    │          │
│  │                                            │          │
│  │  Razón de parada: Win rate target (60%)    │          │
│  │  Generaciones: 34 / 50                     │          │
│  │  Partidas totales: 61,200                  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │          Curvas de fitness                  │          │
│  │  (gráfico completo, igual que en Running)   │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  🏆 Mejor bot encontrado                   │          │
│  │                                            │          │
│  │  Win rate vs rival: 61.7%                  │          │
│  │  Fitness: 617 / 1000                       │          │
│  │                                            │          │
│  │  Comparación con semilla original:         │          │
│  │  ┌──────────────────────────────────────┐  │          │
│  │  │ Parámetro           Semilla  Evoluc. │  │          │
│  │  │ ─────────────────── ─────── ─────── │  │          │
│  │  │ draw.improvThreshold   3      5  ▲  │  │          │
│  │  │ draw.structPriority    5      7  ▲  │  │          │
│  │  │ draw.infoAversion      0      2  ▲  │  │          │
│  │  │ discard.restoBias      8      6  ▼  │  │          │
│  │  │ cut.baseResto          5      3  ▼  │  │          │
│  │  │ cut.chinchonPursuit    0      4  ▲  │  │          │
│  │  │ ... (solo parámetros que cambiaron)  │  │          │
│  │  └──────────────────────────────────────┘  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  Top 3 individuos                          │          │
│  │                                            │          │
│  │  🥇 #1  Win rate: 61.7%  Fitness: 617     │          │
│  │  🥈 #2  Win rate: 59.2%  Fitness: 592     │          │
│  │  🥉 #3  Win rate: 58.8%  Fitness: 588     │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  [ 💾 Guardar como bot custom ]            │          │
│  │  [ 🔄 Nueva evolución ]                   │          │
│  │  [ 🧪 Simular vs rival ]                  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tabla de comparación

- Solo muestra parámetros donde el valor cambió respecto al semilla original
- Flechas ▲/▼ indican dirección del cambio
- Valores resaltados con color si el cambio es significativo (diferencia ≥ 3)

### Acciones finales

| Botón | Acción |
|-------|--------|
| **💾 Guardar como bot custom** | Abre un mini-modal para nombrar el bot, elegir emoji y guardar en localStorage como custom bot. Usa el sistema de import existente. |
| **🔄 Nueva evolución** | Vuelve al estado Config, preservando la configuración actual. |
| **🧪 Simular vs rival** | Cambia al tab "🧪 Sim" con el bot evolucionado ya seleccionado contra el rival, para correr una simulación completa. |

---

## 6. Modal de guardado

```
┌───────────────────────────────────┐
│  Guardar bot evolucionado         │
│                                   │
│  Nombre: [Bot Evolucionado___]    │
│                                   │
│  Emoji:                           │
│  🧪 ⚡ 🎲 💎 🦾 🧠 🔥 🤡         │
│  🎯 🎭 🚀 💀 👻 🕷️ 🍀 🌟         │
│  (grid de emojis de CUSTOM_EMOJIS)│
│                                   │
│  Descripción: (auto-generada)     │
│  "Evolucionado vs FacuTron.       │
│   WR: 61.7% en 34 generaciones." │
│                                   │
│  [ Cancelar ]  [ Guardar ]        │
└───────────────────────────────────┘
```

- El nombre default se genera como `"Evo vs {rivalName}"`.
- El emoji default es 🧬.
- La descripción se auto-genera pero es editable.
- Al guardar, se agrega a `customConfigs` y se persiste en localStorage.

---

## 7. Responsive (mobile)

### Cambios para pantalla chica

- La tabla de comparación de parámetros se vuelve vertical (stacked):
  ```
  draw.improvThreshold
  Semilla: 3 → Evolucionado: 5 ▲
  ```
- Los sliders ocupan ancho completo.
- El gráfico de fitness se redimensiona al ancho disponible (SVG con `viewBox`).
- Los botones de acción se apilan verticalmente.
- Los accordions empiezan cerrados excepto "Bots" y "Población".

---

## 8. Componentes reutilizados del proyecto

| Componente | Origen | Uso en EvoLab |
|------------|--------|---------------|
| `LabPanel` | `chinchon-lab/Layout.tsx` | Wrapper de secciones |
| `LabAccordionSection` | `chinchon-lab/Layout.tsx` | Secciones colapsables de config |
| `LabTabBar` | `chinchon-lab/Layout.tsx` | Tab del lab (ya existe) |
| `StickyActionBar` | `chinchon-lab/Layout.tsx` | Barra de botón "Iniciar/Detener" |
| Selector de bots | `ChinchonArena.tsx` | Dropdown de selección de rival/semilla |
| `FitnessChart` (adaptado) | `evo-lab/FitnessChart.tsx` | Gráfico de fitness por generación |

### Componentes nuevos a crear

| Componente | Responsabilidad |
|------------|----------------|
| `EvoConfigForm` | Formulario de configuración (inline en ChinchonArena o subcomponente) |
| `EvoFitnessChart` | Adaptación de FitnessChart con línea de referencia en 500 |
| `EvoResultView` | Vista de resultado con tabla de comparación y top 3 |
| `EvoSaveModal` | Modal para nombrar y guardar el bot evolucionado |

**Nota**: Si ChinchonArena.tsx ya es muy grande (~2000 líneas), considerar extraer la UI de evolución a `src/pages/chinchon-lab/EvoTab.tsx` como subcomponente. Esto es consistente con el patrón de `src/pages/evo-lab/*.tsx`.

---

## 9. Interacciones y edge cases

### Bot rival = bot custom recién creado
- Funciona normal. El catálogo combina builtins + customs.
- Si el usuario borra el bot custom durante una evolución, la evolución sigue usando la copia en memoria.

### Evolución cancelada
- El botón "Detener" envía `cancel` al worker.
- Se muestra el estado Done con `stopReason: 'cancelled'`.
- Se puede guardar el mejor bot encontrado hasta ese momento.

### Todos los individuos pierden
- Si después de varias generaciones el mejor fitness sigue < 500, la UI muestra una nota:
  > "El mejor bot todavía no supera al rival. Probá con más generaciones o ajustá los operadores."

### Población converge rápido
- Si el stagnation limit se activa, la UI muestra:
  > "La evolución se detuvo por estancamiento (15 generaciones sin mejora)."

### Bot evolucionado ya existe
- Si el nombre elegido para guardar ya existe en customs, mostrar warning y pedir confirmación para reemplazar.
