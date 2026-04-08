# Chinchón EvoLab — Spec de implementación

> Nueva pestaña dentro de Chinchón Lab que permite evolucionar bots de Chinchón mediante algoritmos genéticos. El usuario selecciona un bot "rival", y el sistema genera una población de variantes que compiten contra él hasta encontrar un bot superior.

---

## 1. Visión y flujo del usuario

### Flujo principal

```
┌─────────────────────────────────────────────────────────────┐
│  1. CONFIGURAR                                              │
│     • Elegir bot base (rival a superar)                     │
│     • Elegir bot semilla (punto de partida de la evolución) │
│     • Ajustar parámetros del algoritmo                      │
│                                                             │
│  2. EVOLUCIONAR                                             │
│     • Se genera población inicial mutando al semilla        │
│     • Cada generación:                                      │
│       – Evaluar fitness (partidas espejo vs rival)          │
│       – Seleccionar padres                                  │
│       – Cruzar y mutar → nueva generación                  │
│     • Visualizar progreso en tiempo real                    │
│                                                             │
│  3. RESULTADO                                               │
│     • Mostrar el mejor bot encontrado                       │
│     • Comparar sus parámetros vs el semilla original        │
│     • Exportar como bot custom a la lista de bots           │
└─────────────────────────────────────────────────────────────┘
```

### Conceptos clave

- **Bot rival (target)**: El bot contra el cual se mide el fitness. La población intenta *superarlo*, no imitarlo.
- **Bot semilla**: El punto de partida para generar la población inicial. Puede ser el mismo bot rival u otro distinto.
- **Individuo**: Una variante de `BotConfig` con parámetros mutados.
- **Fitness**: Win rate del individuo vs el rival en N partidas espejo.

---

## 2. Representación del individuo

### Por qué NO usar genoma binario

EvoLab usa `Uint8Array` binarios porque trabaja con problemas de bitstring y movimientos. Para bots de Chinchón, los parámetros son naturalmente:
- **Continuos** (0–10): `temperature`, `improvementThreshold`, etc.
- **Discretos acotados**: `maxFree` (0|1), `chinchonThreshold` (4|5|6), `evalScope` ('fast'|'full')
- **Booleanos**: `useScoreRules`
- **Estructurados**: `scoreRules` (array de `{minScore, maxResto}`)

Codificar todo en binario sería ineficiente y haría que crossover opere sobre bits sin significado semántico.

### Decisión: individuo = BotConfig directo

Cada individuo de la población es un `BotConfig` completo. Los operadores genéticos trabajan directamente sobre los campos del config, respetando sus tipos y rangos.

### Mapa de genes

Se define un **GeneMap** que describe cada parámetro mutable:

| Gen | Path | Tipo | Rango | Notas |
|-----|------|------|-------|-------|
| `global.temperature` | `global.temperature` | continuo | [0, 10] | Step de 1 entero |
| `global.mistakeRate` | `global.mistakeRate` | continuo | [0, 10] | Normalmente 0 (debug) |
| `draw.improvementThreshold` | `draw.improvementThreshold` | continuo | [0, 10] | |
| `draw.structuralPriority` | `draw.structuralPriority` | continuo | [0, 10] | |
| `draw.infoAversion` | `draw.infoAversion` | continuo | [0, 10] | |
| `draw.chinchonBias` | `draw.chinchonBias` | continuo | [0, 10] | |
| `draw.tempoPreference` | `draw.tempoPreference` | continuo | [0, 10] | |
| `discard.evalScope` | `discard.evalScope` | categórico | ['fast', 'full'] | |
| `discard.restoBias` | `discard.restoBias` | continuo | [0, 10] | |
| `discard.potentialBias` | `discard.potentialBias` | continuo | [0, 10] | |
| `discard.rankBias` | `discard.rankBias` | continuo | [0, 10] | |
| `discard.jokerProtection` | `discard.jokerProtection` | continuo | [0, 10] | |
| `cut.maxFree` | `cut.maxFree` | categórico | [0, 1] | |
| `cut.baseResto` | `cut.baseResto` | continuo | [0, 5] | |
| `cut.useScoreRules` | `cut.useScoreRules` | booleano | [true, false] | |
| `cut.scoreRules[i].maxResto` | `cut.scoreRules[i].maxResto` | continuo | [0, 5] | 4 reglas fijas |
| `cut.chinchonPursuit` | `cut.chinchonPursuit` | continuo | [0, 10] | |
| `cut.chinchonThreshold` | `cut.chinchonThreshold` | categórico | [4, 5, 6] | |
| `cut.minus10Pursuit` | `cut.minus10Pursuit` | continuo | [0, 10] | |
| `cut.deckUrgency` | `cut.deckUrgency` | continuo | [0, 10] | |
| `cut.leadProtection` | `cut.leadProtection` | continuo | [0, 10] | |
| `cut.desperationMode` | `cut.desperationMode` | continuo | [0, 10] | |

**Total: ~27 genes** (contando cada scoreRule como un gen independiente).

### scoreRules: tratamiento especial

Las `scoreRules` tienen estructura fija en el sistema actual (4 reglas con `minScore` fijo en 0/25/50/75). Para la evolución:
- Los `minScore` se mantienen fijos (no se mutan).
- Solo se mutan los `maxResto` de cada regla (4 genes continuos en rango [0, 5]).
- Se fuerza que `maxResto` sea no-creciente: `rules[i].maxResto >= rules[i+1].maxResto`.

---

## 3. Operadores genéticos

### 3.1 Mutación

**Para parámetros continuos (0–10 o 0–5):**
- **Mutación gaussiana**: `nuevo = clamp(actual + N(0, σ), min, max)`
- σ (sigma) configurable por el usuario, default = 1.5
- Probabilidad de mutación por gen: configurable, default = 0.15 (15% de probabilidad de que cada gen mute)
- El resultado se redondea a entero (los parámetros del bot son enteros 0–10)

**Para parámetros categóricos:**
- **Mutación uniforme**: con la misma probabilidad por gen, se elige un valor aleatorio entre las opciones válidas
  - `evalScope`: 'fast' o 'full'
  - `maxFree`: 0 o 1
  - `chinchonThreshold`: 4, 5, o 6

**Para booleanos:**
- **Flip**: con la probabilidad de mutación, se invierte el valor

### 3.2 Crossover

**Para parámetros continuos:**
- **Blend crossover (BLX-α)**: dados padres `p1` y `p2`, el hijo toma un valor aleatorio en el rango `[min(p1,p2) - α*d, max(p1,p2) + α*d]` donde `d = |p1 - p2|` y `α = 0.3`
- Resultado clampeado al rango válido y redondeado a entero

**Para parámetros categóricos y booleanos:**
- **Crossover uniforme**: cada gen se hereda de uno u otro padre con probabilidad 0.5

**Tasa de crossover:** configurable, default = 0.8 (80% de las parejas se cruzan; el resto pasa un padre directo)

### 3.3 Selección

- **Selección por torneo** como default
  - `k` configurable (default = 3)
  - Consistente con lo que ya usa EvoLab

- **Selección por ruleta** como alternativa
  - Fitness-proporcional
  - Fallback a random si todos los fitness son 0

### 3.4 Elitismo

- Los mejores N individuos pasan intactos a la siguiente generación
- Default: `elitismCount = 2`
- Garantiza que nunca se pierde la mejor solución encontrada

---

## 4. Evaluación de fitness

### Mecanismo

```
fitness(individuo) =
  1. Compilar BotConfig → BotRuntime (buildBotFromConfig)
  2. Correr N partidas espejo: simulateGamePairWithBots(individuo, rival)
     – Cada partida espejo = 2 juegos (orientación A y B)
     – Total de juegos = N × 2
  3. fitness = (juegos ganados por individuo) / (juegos totales) × 1000
```

El fitness es un valor entre 0 y 1000, donde:
- **500** = empate (gana la mitad)
- **> 500** = el individuo supera al rival
- **1000** = victoria perfecta (gana todos los juegos)

### Cantidad de partidas por evaluación

- **Configurable por el usuario**: slider entre 10 y 200 partidas espejo
- **Default recomendado: 30** (compromiso entre estabilidad estadística y velocidad)
- Más partidas = fitness más estable pero evaluación más lenta
- Nota: una evaluación de fitness con 30 partidas = 60 juegos completos

### Costo computacional

```
Costo por generación:
  = populationSize × simsPerEval × 2 juegos cada uno
  
Ejemplo con defaults:
  = 30 individuos × 30 sims × 2 = 1800 juegos por generación

Si cada juego toma ~0.5ms en el worker:
  = ~0.9 segundos por generación
  = ~90 segundos para 100 generaciones
```

Este costo es manejable para el worker, pero justifica:
- Reportar progreso por generación
- Permitir cancelación
- Considerar poblaciones y sims más chicas como defaults

---

## 5. Condiciones de corte

El algoritmo se detiene cuando se cumple **cualquiera** de estas condiciones:

### 5.1 Máximo de generaciones
- Configurable, default = 50
- Siempre activo como safety net

### 5.2 Superación absoluta del rival
- **Condición**: `bestFitness >= 500 + margenAbsoluto`
- `margenAbsoluto` configurable en puntos de fitness (default = 50, equivalente a win rate de 55%)
- El usuario puede desactivar esta condición

### 5.3 Superación relativa del rival
- **Condición**: el mejor individuo gana ≥ X% de los juegos contra el rival
- `winRateTarget` configurable como porcentaje (default = 60%)
- Equivalencia: `bestFitness >= winRateTarget × 10`
- Alternativa a la superación absoluta; el usuario elige cuál usar

### 5.4 Estancamiento (opcional)
- Si el mejor fitness no mejora en K generaciones consecutivas, parar
- `stagnationLimit` configurable (default = 15)
- Evita quemar ciclos cuando la evolución convergió
- Desactivable por el usuario

### Lógica combinada

```typescript
function shouldStop(state: EvoState, config: EvoConfig): StopReason | null {
  if (state.generation >= config.maxGenerations)
    return 'max_generations'
  
  if (config.absoluteMargin != null && state.bestFitness >= 500 + config.absoluteMargin)
    return 'absolute_margin'
  
  if (config.winRateTarget != null && state.bestFitness >= config.winRateTarget * 10)
    return 'win_rate_target'
  
  if (config.stagnationLimit != null && state.stagnationCount >= config.stagnationLimit)
    return 'stagnation'
  
  return null  // seguir
}
```

---

## 6. Arquitectura del worker

### Decisión: extender el worker existente

El `chinchon-lab.worker.ts` ya maneja simulación, torneo y benchmark. Agregar un nuevo tipo de mensaje `runEvolution` es consistente con el patrón existente y evita crear un segundo worker.

### Flujo en el worker

```
Main thread                        Worker
    │                                 │
    │─── runEvolution(config) ───────>│
    │                                 │
    │    ┌────────────────────────┐   │
    │    │ 1. Generar población   │   │
    │    │    inicial mutando     │   │
    │    │    al bot semilla      │   │
    │    │                        │   │
    │    │ 2. Para cada gen:      │   │
    │    │   a. Evaluar fitness   │   │
    │    │      de cada individuo │   │
    │    │      (N partidas vs    │   │
    │    │       rival)           │   │
    │    │   b. Selección         │   │
    │    │   c. Crossover         │   │
    │    │   d. Mutación          │   │
    │    │   e. Elitismo          │   │
    │    │   f. Chequear corte    │   │
    │<── │   g. Reportar progreso │   │
    │    │                        │   │
    │    │ 3. Reportar resultado  │   │
    │    │    final               │   │
    │    └────────────────────────┘   │
    │                                 │
    │<── evoProgress(gen, metrics) ───│  (cada generación)
    │<── evoDone(bestBot, stats) ─────│  (al terminar)
    │                                 │
    │─── cancel ─────────────────────>│  (en cualquier momento)
```

### Yield points

Para no bloquear el worker (y permitir cancelación):
- `await yieldToMessages()` después de cada generación
- Dentro de la evaluación de fitness, yield cada ~50 juegos si la población es grande

---

## 7. Protocolo de mensajes worker

### Main → Worker

```typescript
type RunEvolutionRequest = {
  type: 'runEvolution'
  jobId: number
  customConfigs: BotConfig[]       // bots custom del usuario
  rivalBotIndex: number            // índice en el catálogo
  seedBotIndex: number             // índice en el catálogo
  
  // Parámetros del algoritmo
  populationSize: number           // default 30
  simsPerEval: number              // partidas espejo por evaluación de fitness
  maxGenerations: number           // default 50
  elitismCount: number             // default 2
  
  // Operadores
  mutationRate: number             // prob por gen, default 0.15
  mutationSigma: number            // desviación estándar gaussiana, default 1.5
  crossoverRate: number            // prob de cruce, default 0.8
  selectionMethod: 'tournament' | 'roulette'
  tournamentK: number              // default 3
  
  // Condiciones de corte
  absoluteMargin: number | null    // default 50
  winRateTarget: number | null     // default 60 (porcentaje)
  stagnationLimit: number | null   // default 15
}
```

### Worker → Main (progreso)

```typescript
type EvoProgressMessage = {
  type: 'evoProgress'
  jobId: number
  generation: number
  
  // Métricas de fitness
  bestFitness: number              // 0–1000
  avgFitness: number
  worstFitness: number
  
  // Win rate del mejor individuo
  bestWinRate: number              // 0–100 porcentaje
  
  // Historial para gráfico
  fitnessHistory: Array<{
    generation: number
    best: number
    avg: number
    worst: number
  }>
  
  // Progreso general
  progress: number                 // 0–100
  evaluationsThisGen: number       // partidas jugadas esta generación
  totalEvaluations: number         // partidas totales acumuladas
}
```

### Worker → Main (resultado final)

```typescript
type EvoDoneMessage = {
  type: 'evoDone'
  jobId: number
  
  // Mejor bot encontrado
  bestConfig: BotConfig
  bestFitness: number
  bestWinRate: number
  
  // Estadísticas del run
  totalGenerations: number
  totalEvaluations: number
  stopReason: 'max_generations' | 'absolute_margin' | 'win_rate_target' | 'stagnation' | 'cancelled'
  
  // Top 3 individuos para comparación
  topConfigs: BotConfig[]
  topFitnesses: number[]
  
  // Historial completo de fitness
  fitnessHistory: Array<{
    generation: number
    best: number
    avg: number
    worst: number
  }>
}
```

---

## 8. Generación de la población inicial

La población inicial se genera a partir del **bot semilla**:

```
1. Clonar el config del bot semilla N veces
2. Aplicar mutación a cada clon (excepto al primer individuo que queda intacto)
3. La mutación inicial usa σ más alto (sigma × 2) para mayor diversidad
4. Evaluar fitness de todos vs el rival
```

El primer individuo (copia exacta del semilla) sirve como baseline. Si el semilla = rival, su fitness esperado es ~500 (empate consigo mismo).

### Variantes posibles

- **Semilla = rival**: La evolución parte del mismo bot e intenta encontrar variantes que lo superen. Útil para mejorar un bot ya bueno.
- **Semilla ≠ rival**: La evolución parte de otro bot e intenta adaptarlo para ganarle al rival. Útil para explorar estrategias distintas.

---

## 9. Integración con Chinchón Lab

### Nuevo tab

Agregar a `LAB_TABS` en `ChinchonArena.tsx`:

```typescript
{ value: "evo", label: "🧬 Evolución", shortLabel: "🧬 Evo" }
```

### Estado en ChinchonArena

```typescript
// Estado de EvoLab
const [evoConfig, setEvoConfig] = useState<EvoLabConfig>(defaultEvoConfig)
const [evoRunning, setEvoRunning] = useState(false)
const [evoProgress, setEvoProgress] = useState<EvoProgressState | null>(null)
const [evoResult, setEvoResult] = useState<EvoDoneMessage | null>(null)
```

### Reset al cambiar de tab

Agregar `resetEvoState()` al `handleTabChange` existente.

### Worker message handler

Extender el `onmessage` del worker existente para manejar `evoProgress` y `evoDone`.

---

## 10. Archivos a crear/modificar

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/lib/chinchon-evo-lab.ts` | Lógica pura: operadores genéticos para BotConfig, generación de población, evaluación de fitness, condiciones de corte |
| `src/lib/chinchon-evo-lab.test.ts` | Tests de mutación, crossover, fitness, condiciones de corte |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/lib/chinchon-lab-worker-types.ts` | Agregar `RunEvolutionRequest`, `EvoProgressMessage`, `EvoDoneMessage` |
| `src/workers/chinchon-lab.worker.ts` | Agregar handler para `runEvolution`, loop de evolución |
| `src/pages/ChinchonArena.tsx` | Agregar tab "🧬 Evolución", estado, UI, handler de mensajes del worker |
| `src/styles/chinchon-arena-utilities.css` | Estilos para la nueva pestaña (config form, fitness chart, result view) |

### Notas

- **No se crea un worker nuevo**: se extiende el existente.
- **No se modifican los bots existentes**: la evolución solo lee configs y crea nuevos.
- **La lógica pura va en `src/lib/`**: consistente con las convenciones del repo.
- **El resultado se exporta como custom bot**: usa el sistema de import/export existente (`sanitizeImportConfig`, localStorage).

---

## 11. Consideraciones de performance

### Cuello de botella: evaluación de fitness

Cada evaluación requiere correr múltiples juegos completos de Chinchón. Esto es CPU-bound pero ya corre en un Web Worker, por lo que no bloquea la UI.

### Optimizaciones posibles

1. **Batching de evaluaciones**: Evaluar varios individuos en secuencia sin yield entre cada uno (yield solo entre batches de ~5 individuos).

2. **Fitness caching parcial**: Si un individuo de la élite no cambió, no re-evaluar su fitness. (Ahorra `elitismCount × simsPerEval` juegos por generación.)

3. **Evaluación progresiva**: Para generaciones tempranas, usar menos sims por evaluación (e.g., 10). Aumentar a medida que la población converge. Esto acelera las primeras generaciones donde la señal es fuerte.

4. **Early stopping por individuo**: Si después de la mitad de las partidas el win rate es < 20%, abortar la evaluación de ese individuo (es claramente malo). Asignar fitness proporcional a las partidas jugadas.

### Tamaños recomendados por default

| Parámetro | Default | Rango UI | Justificación |
|-----------|---------|----------|---------------|
| Población | 30 | 10–100 | Compromiso diversidad/velocidad |
| Sims/eval | 30 | 10–200 | 60 juegos por individuo, estabilidad razonable |
| Generaciones máx | 50 | 10–500 | ~45 segundos con defaults |
| Elitismo | 2 | 0–10 | Preserva las 2 mejores soluciones |
| Tasa mutación | 0.15 | 0.01–0.5 | 15% de genes mutan por individuo |
| Sigma mutación | 1.5 | 0.5–5.0 | Perturbación moderada en escala 0–10 |
| Tasa crossover | 0.8 | 0.0–1.0 | 80% de parejas se cruzan |
| Tournament k | 3 | 2–7 | Presión selectiva moderada |

### Estimaciones de tiempo

| Escenario | Población | Sims/eval | Generaciones | Juegos totales | Tiempo estimado |
|-----------|-----------|-----------|-------------|----------------|-----------------|
| Rápido | 20 | 15 | 30 | 18,000 | ~9s |
| Default | 30 | 30 | 50 | 90,000 | ~45s |
| Exhaustivo | 60 | 100 | 200 | 2,400,000 | ~20min |

---

## 12. Extensiones futuras (fuera de scope de v1)

Estas ideas quedan documentadas pero NO se implementan en la primera versión:

- **Coevolución**: dos poblaciones que evolucionan una contra la otra (en vez de un rival fijo).
- **Multi-objetivo**: optimizar win rate Y tiempo de juego simultáneamente.
- **Islas**: varias subpoblaciones con migración periódica.
- **Historial de evoluciones**: guardar runs anteriores para comparar.
- **Replay del mejor bot**: poder ver partidas del bot evolucionado en el visor de partidas existente.
