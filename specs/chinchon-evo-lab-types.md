# Chinchón EvoLab — Tipos propuestos

> Definiciones TypeScript para el módulo `src/lib/chinchon-evo-lab.ts` y las extensiones al worker.

---

## 1. Tipos del módulo de evolución

### GeneDescriptor — descripción de cada gen mutable

```typescript
/**
 * Describe un gen individual dentro de un BotConfig.
 * Se usa para saber cómo mutar y cruzar cada parámetro.
 */
type GeneType = 'continuous' | 'categorical' | 'boolean'

type GeneDescriptor =
  | {
      type: 'continuous'
      path: string          // e.g. "draw.improvementThreshold"
      min: number
      max: number
      integer: boolean      // si el resultado debe redondearse
    }
  | {
      type: 'categorical'
      path: string
      options: (string | number)[]   // e.g. ['fast', 'full'] o [4, 5, 6]
    }
  | {
      type: 'boolean'
      path: string
    }
```

### GENE_MAP — catálogo de todos los genes

```typescript
/**
 * Array estático con la descripción de cada gen mutable de BotConfig.
 * Se excluyen campos de identidad (id, name, emoji, color, etc.)
 * y los minScore de scoreRules (que se mantienen fijos).
 */
const GENE_MAP: GeneDescriptor[] = [
  // global
  { type: 'continuous', path: 'global.temperature',       min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'global.mistakeRate',        min: 0, max: 10, integer: true },

  // draw
  { type: 'continuous', path: 'draw.improvementThreshold', min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.structuralPriority',   min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.infoAversion',         min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.chinchonBias',         min: 0, max: 10, integer: true },
  { type: 'continuous', path: 'draw.tempoPreference',      min: 0, max: 10, integer: true },

  // discard
  { type: 'categorical', path: 'discard.evalScope',       options: ['fast', 'full'] },
  { type: 'continuous',  path: 'discard.restoBias',        min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'discard.potentialBias',    min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'discard.rankBias',         min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'discard.jokerProtection',  min: 0, max: 10, integer: true },

  // cut
  { type: 'categorical', path: 'cut.maxFree',             options: [0, 1] },
  { type: 'continuous',  path: 'cut.baseResto',            min: 0, max: 5,  integer: true },
  { type: 'boolean',     path: 'cut.useScoreRules' },
  { type: 'continuous',  path: 'cut.scoreRules.0.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous',  path: 'cut.scoreRules.1.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous',  path: 'cut.scoreRules.2.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous',  path: 'cut.scoreRules.3.maxResto', min: 0, max: 5, integer: true },
  { type: 'continuous',  path: 'cut.chinchonPursuit',      min: 0, max: 10, integer: true },
  { type: 'categorical', path: 'cut.chinchonThreshold',    options: [4, 5, 6] },
  { type: 'continuous',  path: 'cut.minus10Pursuit',       min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'cut.deckUrgency',          min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'cut.leadProtection',       min: 0, max: 10, integer: true },
  { type: 'continuous',  path: 'cut.desperationMode',      min: 0, max: 10, integer: true },
]
```

### EvoIndividual — individuo de la población

```typescript
type EvoIndividual = {
  id: number
  config: BotConfig
  fitness: number             // 0–1000 (win rate × 10)
  winRate: number             // 0–100 porcentaje
  gamesPlayed: number         // partidas totales jugadas en evaluación
  gamesWon: number            // partidas ganadas
  meta?: {
    parentAId?: number
    parentBId?: number
    mutatedGenes?: string[]   // paths de los genes que mutaron
  }
}
```

### EvoPopulation — snapshot de la población

```typescript
type EvoPopulation = {
  generation: number
  individuals: EvoIndividual[]
}
```

### EvoMetricsTick — métricas por generación

```typescript
type EvoMetricsTick = {
  generation: number
  bestFitness: number         // 0–1000
  avgFitness: number
  worstFitness: number
  bestWinRate: number         // 0–100
  avgWinRate: number
  diversity: number           // 0–1 (varianza normalizada de los parámetros)
}
```

### EvoConfig — configuración completa del run

```typescript
type EvoConfig = {
  // Bots
  rivalBotIndex: number       // índice en el catálogo combinado
  seedBotIndex: number        // índice en el catálogo combinado

  // Población
  populationSize: number      // 10–100, default 30
  simsPerEval: number         // 10–200, default 30
  maxGenerations: number      // 10–500, default 50
  elitismCount: number        // 0–10, default 2

  // Operadores
  mutationRate: number        // 0.01–0.5, default 0.15
  mutationSigma: number       // 0.5–5.0, default 1.5
  crossoverRate: number       // 0.0–1.0, default 0.8
  selectionMethod: 'tournament' | 'roulette'
  tournamentK: number         // 2–7, default 3

  // Condiciones de corte
  absoluteMargin: number | null    // puntos de fitness sobre 500, default 50
  winRateTarget: number | null     // porcentaje, default 60
  stagnationLimit: number | null   // generaciones sin mejora, default 15
}
```

### StopReason — razón de parada

```typescript
type StopReason =
  | 'max_generations'
  | 'absolute_margin'
  | 'win_rate_target'
  | 'stagnation'
  | 'cancelled'
```

---

## 2. Tipos del worker (extensiones)

### RunEvolutionRequest

```typescript
type RunEvolutionRequest = WorkerJobBase & {
  type: 'runEvolution'
  rivalBotIndex: number
  seedBotIndex: number
  populationSize: number
  simsPerEval: number
  maxGenerations: number
  elitismCount: number
  mutationRate: number
  mutationSigma: number
  crossoverRate: number
  selectionMethod: 'tournament' | 'roulette'
  tournamentK: number
  absoluteMargin: number | null
  winRateTarget: number | null
  stagnationLimit: number | null
}
```

### EvoProgressMessage

```typescript
type EvoProgressMessage = {
  type: 'evoProgress'
  jobId: number
  generation: number
  bestFitness: number
  avgFitness: number
  worstFitness: number
  bestWinRate: number
  progress: number                 // 0–100
  totalEvaluations: number
  fitnessHistory: EvoMetricsTick[]
}
```

### EvoDoneMessage

```typescript
type EvoDoneMessage = {
  type: 'evoDone'
  jobId: number
  bestConfig: BotConfig
  bestFitness: number
  bestWinRate: number
  totalGenerations: number
  totalEvaluations: number
  stopReason: StopReason
  topConfigs: BotConfig[]
  topFitnesses: number[]
  fitnessHistory: EvoMetricsTick[]
}
```

### Extensión del union type

```typescript
// Agregar a LabWorkerRequest:
type LabWorkerRequest =
  | RunSimRequest
  | RunTournamentRequest
  | RunBenchmarkRequest
  | RunEvolutionRequest      // ← nuevo
  | CancelRequest

// Agregar a LabWorkerMessage:
type LabWorkerMessage =
  | SimProgressMessage
  | BenchmarkProgressMessage
  | TournamentProgressMessage
  | EvoProgressMessage       // ← nuevo
  | EvoDoneMessage           // ← nuevo
```

---

## 3. Funciones exportadas por chinchon-evo-lab.ts

```typescript
// ── Gene map ──
export const GENE_MAP: GeneDescriptor[]

// ── Helpers de acceso a genes ──
export function getGeneValue(config: BotConfig, path: string): number | string | boolean
export function setGeneValue(config: BotConfig, path: string, value: number | string | boolean): BotConfig

// ── Operadores genéticos ──
export function mutateConfig(
  config: BotConfig,
  rate: number,
  sigma: number,
  rng: () => number,
): { config: BotConfig; mutatedGenes: string[] }

export function crossoverConfigs(
  parentA: BotConfig,
  parentB: BotConfig,
  rate: number,
  rng: () => number,
): [BotConfig, BotConfig]

export function selectParent(
  population: EvoIndividual[],
  method: 'tournament' | 'roulette',
  tournamentK: number,
  rng: () => number,
): number

// ── Población ──
export function generateInitialPopulation(
  seed: BotConfig,
  size: number,
  mutationRate: number,
  mutationSigma: number,
  rng: () => number,
): BotConfig[]

// ── Fitness ──
export function evaluateFitness(
  individual: BotConfig,
  rival: BotRuntime,
  sims: number,
  allBots: BotRuntime[],
): { winRate: number; fitness: number; gamesWon: number; gamesPlayed: number }

// ── Condiciones de corte ──
export function checkStopCondition(
  generation: number,
  bestFitness: number,
  stagnationCount: number,
  config: EvoConfig,
): StopReason | null

// ── Diversidad ──
export function computeDiversity(
  population: EvoIndividual[],
): number

// ── Utilidades de exportación ──
export function prepareForExport(
  config: BotConfig,
  name: string,
  emoji: string,
): BotConfig
```

---

## 4. Estructura del scoreRules constraint

Después de cualquier operación genética sobre scoreRules, se debe forzar la constraint de no-crecimiento:

```typescript
/**
 * Asegura que maxResto sea no-creciente a medida que minScore sube.
 * Es decir: rules[0].maxResto >= rules[1].maxResto >= rules[2].maxResto >= rules[3].maxResto
 */
function enforceScoreRulesConstraint(rules: ScoreRule[]): ScoreRule[] {
  const result = rules.map(r => ({ ...r }))
  for (let i = 1; i < result.length; i++) {
    if (result[i].maxResto > result[i - 1].maxResto) {
      result[i].maxResto = result[i - 1].maxResto
    }
  }
  return result
}
```

Esta función se aplica como post-procesamiento de mutación y crossover.
