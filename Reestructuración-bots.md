# Reestructuración funcional del configurador de bots en Chinchón Lab

## Contexto, reglas y estado actual del configurador

El repositorio **Ludario** (en entity["company","GitHub","code hosting platform"]) incluye varias herramientas lúdicas; entre ellas, **Chinchón Lab** está descrita como una “arena de estrategias para Chinchón con bots, simulaciones y replay de manos”, con capacidad para comparar bots, correr partidas espejo y jugar en modo interactivo. citeturn37view0 En el README también se indica la ruta de acceso dentro del sitio: `/#/tools/chinchon-lab`. citeturn37view2

### Reglas relevantes para el diseño de bots

En el repo hay una especificación de reglas para la variante argentina, que impacta directamente qué decisiones puede tomar un bot y qué “objetivos” estratégicos existen:

- El juego usa **baraja española** y el documento del repo indica **50 cartas totales** (incluyendo **2 comodines**). citeturn3view0  
- Cada jugador recibe **7 cartas**, y el jugador que empieza toma una **8va** y descarta primero. citeturn3view0  
- En cada turno: se roba del mazo o del descarte y luego se descarta una carta (con restricciones sobre comodines). citeturn3view0  
- Se juega/corta (cierre de la ronda) con restricciones importantes: **máximo 1 carta suelta**, su **resto ≤ 5**, y **no se puede cortar tirando un comodín**. citeturn3view0turn34view0  
- El comodín tiene reglas fuertes: no puede descartarse, y si queda suelto fuera de combinaciones puede tener un costo muy alto (en el documento se explicita el peso del comodín). citeturn3view0turn34view0turn20view0  
- El “chinchón” es una condición extrema: **7 cartas consecutivas del mismo palo y sin comodines**; el repo lo describe como victoria instantánea bajo esa condición. citeturn3view0turn34view0turn20view0  
- Si todas las cartas pueden cerrarse en melds sin sueltas, existe un resultado de **-10** (en la lógica del juego se modela como puntaje -10 en ese caso). citeturn3view0turn20view0  

Estas reglas hacen que, incluso con información parcial, haya tensiones reales (y deseables para variedad de bots): cortar pronto vs esperar -10, perseguir chinchón vs jugar “seguro”, arriesgarse con comodines vs limpiar la mano, etc. citeturn3view0turn20view0

### Cómo está hoy la pantalla de “Bots” en Chinchón Lab

En el estado actual, la pestaña **Bots** contiene un editor de bot con:

- Identidad (nombre, descripción, emoji y color). citeturn36view4  
- “Robo”: selector con **3 modos** y (si aplica) un umbral numérico:  
  - `always_deck` (“Solo del mazo”)  
  - `smart` (umbral `restoThreshold`)  
  - `aggressive` citeturn36view4turn36view5turn13view0turn20view0  
- “Descarte”: selector con **3 modos** (`default`, `high_rank`, `optimal`) y textos que los jerarquizan (p. ej., “Óptimo (más lento)” / “recomendado”). citeturn35view3turn29view3turn13view0  
- “Corte”: parámetros para tolerancia de sueltas (`maxFree`), umbral de resto (`baseResto`), modo adaptativo por puntaje (`useScoreRules` + `scoreRules`), y dos flags “especiales” (`pursueChinchon`, `chinchonRunMode`) con un `chinchonThreshold`. citeturn36view7turn36view8turn36view9turn13view0turn20view0  

Además, la lógica actual que decide si un bot toma del descarte se basa en comparar la calidad de la mano antes/después de tomar la carta visible, y el modo `always_deck` directamente fuerza a no tomar del descarte. citeturn20view0turn36view4

## Problema de diseño y criterios de una solución superadora

Tu crítica (y el objetivo del rediseño) apunta a algo muy concreto: **hoy el configurador “revela” jerarquías** y limita el espacio de estrategias.

1. El configurador hoy incluye opciones “dominadas” o presentadas explícitamente como peores/mejores (p. ej. “Óptimo (más inteligente)” y “Nunca toma del descarte”). citeturn36view4turn35view3turn29view3turn20view0  
2. La personalización está reducida a pocas palancas (3×3×algunos umbrales), por lo que dos bots distintos terminan compartiendo conductas muy parecidas, y la variabilidad real queda en manos de hardcode o de unos pocos presets. citeturn13view0turn36view4turn35view3  
3. La interfaz actual enfatiza un set fijo de “modos”, más que un **lenguaje de decisiones**; esto choca con el propósito de un “lab” de bots, donde el configurador debería ser tan expresivo como sea posible (dentro de reglas y observables). citeturn37view0turn36view4  

### Criterios exigibles a un configurador de bots bien diseñado

Para una solución “superadora”, propongo estos criterios (alineados con literatura y práctica de AI en juegos):

- **Modularidad y escalabilidad**: cuando crecen las combinaciones y las situaciones, estructuras jerárquicas/modulares (como *behavior trees* o sistemas de decisión componibles) escalan mejor que lógicas monolíticas. citeturn24view2turn22view0turn24view3  
- **Customizability + variability** como objetivos explícitos de arquitectura: en diseño de AI para juegos, la variedad/variabilidad son requisitos del sistema, no un “extra”. Esto aparece muy claro en el análisis de escalabilidad y variedad de la AI de entity["video_game","Halo 2","2004 fps"] por entity["people","Damian Isla","game ai researcher"] (entity["company","Bungie","game developer"]), que discute cómo sostener repertorio, variedad y control del diseñador a medida que el sistema crece. citeturn22view0turn24view3  
- **Evitar “botones de optimalidad obvia”**: el configurador debería permitir trade-offs reales (ej. riesgo vs cierre rápido; ocultamiento vs mejora inmediata; corto plazo vs potencial), en lugar de ofrecer un “modo óptimo” que domina. Esto se logra moviendo el diseño hacia parametrización de objetivos/funciones de utilidad y hacia composición de reglas/políticas, no a un selector de “niveles”. citeturn24view1turn22view0turn24view3  
- **Soportar aleatoriedad controlada**: no como “jugar peor”, sino como *variabilidad intencional* (evitar determinismo explotable, generar estilos). A nivel de arquitectura, esto se suele implementar como selección probabilística entre opciones relevantes o mezcla de reglas. citeturn22view0turn24view1  

## Modelo propuesto: motor de decisión modular y declarativo

La propuesta no es “agregar más dropdowns”, sino **cambiar el modelo mental** de la pantalla: de “modo de robo + modo de descarte + modo de corte” hacia un **motor declarativo de decisiones** con tres políticas (Robo, Descarte, Corte), cada una compuesta por reglas/criterios con pesos, prioridades y/o mezcla probabilística.

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["game AI behavior tree diagram","utility AI action scoring diagram game development","dynamic scripting rulebase weights diagram"],"num_per_query":1}

### Estructura del motor

Cada decisión (robo, descarte, corte) se modela como:

1. **Observación** (inputs permitidos): lo que el bot “sabe” en ese punto. En tu requerimiento explícito, el bot puede usar:
   - su mano,
   - cartas restantes del mazo,
   - última carta del descarte,
   - puntos de cada jugador,
   - cuántas cartas el rival robó y se quedó, separando mazo vs descarte.

2. **Extracción de features** (derivadas): métricas calculadas a partir de observables (p. ej. resto actual, cantidad de sueltas, cercanía a -10, cercanía a chinchón). El repo ya calcula `resto` y `minFree` como parte del análisis de melds. citeturn20view0turn3view0  

3. **Evaluación por criterios**: set de criterios configurables que asignan puntajes (utilidad) o aplican reglas (hard/soft constraints).

4. **Resolución / selección**: mecanismo configurable para transformar puntajes/reglas en una acción final. El enfoque “prioritized list” vs “probabilistic” aparece explícitamente como técnicas estándar de selección en árboles/arquitecturas de AI. citeturn22view0turn24view3  

### Por qué este modelo cumple tu objetivo de “no obviedad”

En lugar de ofrecer “opción A es más inteligente”, el sistema ofrece **perfiles de preferencias** y **trade-offs**:

- minimizar resto inmediato vs maximizar potencial futuro,  
- cortar rápido vs esperar oportunidades,  
- estrategia determinista vs estocástica,  
- perseguir chinchón vs reducir varianza,  
- “bloquear” (negar al rival) vs “acelerar” (cerrar).

Si el configurador permite combinar criterios, activar/desactivar por contexto y mezclar probabilísticamente, el “mejor” bot depende del metajuego, del rival y de la configuración de objetivos (que puede variar por estado), no de un toggle de “óptimo”. citeturn22view0turn24view1turn24view3  

## Especificación funcional de la nueva pantalla de bots

Esta sección describe una reestructuración completa de la pantalla **Bots**, en términos funcionales (qué se puede configurar, cómo se organiza y cómo se interpreta).

### Estructura de la UI

La pestaña **Bots** pasa de “un editor lineal” a un **taller de bots** con tres zonas:

**Zona A: Biblioteca**
- Lista de bots (built-in + custom), con filtros por “estilo” (tags) y por “familia” (plantillas).
- Acciones por bot: *Editar*, *Duplicar*, *Exportar*, *Eliminar*, *Benchmark rápido* (contra un bot baseline).
- Nota: a diferencia del estado actual, se elimina lenguaje como “recomendado/óptimo/más inteligente” en labels; se reemplaza por descripciones neutrales.

**Zona B: Editor**
- Se divide en pestañas internas:
  - Identidad
  - Estrategia
  - Prueba rápida
  - Compartir

**Zona C: Inspector (feedback inmediato)**
- “Qué está optimizando este bot”: muestra los pesos/criterios activos.
- “Qué ve el bot”: panel con los observables/featuress disponibles (para que el usuario no configure condiciones imposibles).
- “Simulación rápida”: minirreporte de 100–1000 partidas espejo (si el usuario lo dispara), reutilizando el concepto existente de partidas espejo. citeturn37view0turn35view4  

### Editor: Identidad

Configurable (similar a hoy, pero con dos agregados):

- Nombre (1–12), descripción (0–120), emoji y color. citeturn36view4turn13view0  
- Tags recuperables:
  - tags declarativos (p. ej. “agresivo”, “paciente”, “camaleón”) no afectan la lógica, solo catálogo.
  - tags derivados: el sistema sugiere tags según configuración (p. ej. alta aversión a riesgo ⇒ “conservador”).

### Editor: Estrategia

La estrategia se arma en dos niveles, ambos serializan a la misma estructura:

#### Modo rápido: “Sliders de estilo”
En lugar de 3 dropdowns, el usuario ajusta ejes parametrizables que se traducen a pesos y reglas:

- **Tempo de cierre**: preferencia por cortar con umbrales más laxos vs esperar -10/chinchón.
- **Apetito por chinchón**: cuánto sacrifica cierre rápido por perseguir chinchón.
- **Aversión al riesgo de comodín**: cuándo el comodín es un activo vs un pasivo peligroso.
- **Preferencia por potencial**: conservar semi-juegos (pares, conectores) vs limpiar sueltas siempre.
- **Sensibilidad al rival**: cuánto reacciona a los contadores del rival (robos retenidos).
- **Aleatoriedad / temperatura**: determinismo vs variación.
- **Decepción / ocultamiento**: penaliza acciones que “muestran” intención (por ejemplo, tomar descarte puede revelar interés; hoy no se modela como trade-off).  

Estos ejes no son “mejor/peor”: cada eje empuja el bot hacia comportamientos plausibles con ventajas y costos.

#### Modo avanzado: “Compositor de políticas”
El usuario configura 3 políticas: Robo, Descarte, Corte.

Cada política tiene:

1. **Resolver (cómo elige)**  
   Opciones (se elige 1 por política):
   - **Lista priorizada**: se evalúan reglas en orden; la primera aplicable decide (o bloquea/bonifica). Inspirado en esquemas “prioritized-list” citados como estándar en arquitecturas escalables. citeturn22view0turn24view3  
   - **Puntaje por utilidad**: cada acción recibe un puntaje por suma ponderada de consideraciones; se elige máximo. Este patrón es compatible con enfoques de “criterios con pesos” y con sistemas de reglas ponderadas (cercano a dinámicas de rulebases con pesos). citeturn24view1  
   - **Softmax / probabilístico**: se elige según distribución derivada de los puntajes (controlada por temperatura), para variabilidad efectiva. citeturn22view0turn24view1  
   - **Pool de scripts**: selecciona una “sub-estrategia” de un conjunto, con probabilidad proporcional a pesos (inspirado en selección proporcional por peso en rulebases). citeturn24view1  

2. **Reglas/consideraciones** (van “en orden” o “todas juntas”, según resolver)
   - Una regla tiene:  
     **Condición** + **Efecto** + (opcional) **peso/prioridad** + (opcional) **aplica solo en fase X**.

3. **Fases** (contextos)
   - Las políticas se pueden definir por “fase”: por ejemplo, *inicio/medio/final* según puntaje propio, *ganando/perdiendo* según diferencia, o *deck bajo* según cartas restantes.
   - Este concepto generaliza el `useScoreRules` actual, que hoy solo aplica al corte y segmenta por rangos de puntaje propio. citeturn13view0turn36view8  

### Editor: Prueba rápida

- Bot vs Bot: elige dos bots y corre N partidas espejo (ya existe el concepto y es central al lab). citeturn37view0turn35view4  
- Métricas que recomienda reportar (todas derivables sin “ver más” de lo permitido):
  - winrate,
  - % de cierres por corte con resto 5/4/3/2/1/0,
  - % de cierres -10,
  - % de chinchón,
  - promedio de turnos por ronda,
  - huella de comportamiento: % toma descarte, distribución de descartes por valor, etc.  

### Editor: Compartir

- Exportar/Importar como JSON versionado (v2), con validación y migración desde el schema actual (v1). El estado actual ya serializa configs y permite importarlas con sanitización. citeturn13view0turn35view2  
- Generador de “prompt” (si se mantiene la idea actual de prompt para crear bots): pero en v2 debe describir el lenguaje declarativo nuevo, no “3 modos”. Hoy ya existe un generador de prompt enfocado en el schema actual. citeturn35view1turn36view0  

## Catálogo extenso de parámetros configurables

A continuación detallo un catálogo funcional (qué parametrizar) para maximizar el espacio de bots posibles **sin** introducir opciones “claramente peores” por construcción.

Para mantenerlo usable, lo estructuro en: parámetros globales, y parámetros por política (Robo, Descarte, Corte). En cada caso aclaro: opciones (si se elige una o si se combinan), parámetros y significado.

### Parámetros globales del bot

**Motor**
- **Semilla de aleatoriedad** (opcional): permite reproducibilidad en pruebas (útil para comparar cambios en config).
- **Temperatura global** (0–1): cuánto “ruido” agrega a decisiones por utilidad; 0 ⇒ determinista; 1 ⇒ alta exploración.
- **Modo de fases** (se elige una estrategia de segmentación):
  - por puntaje propio (como el corte adaptativo actual) citeturn13view0turn36view8  
  - por diferencia de puntaje (ganando/perdiendo)  
  - por cartas en mazo (deck early/mid/late)  
  - combinada (permite jerarquía: primero por deck, luego por score, etc.)

**Objetivo macro (función de valor de ronda)**
- En vez de “ganar a toda costa”, el usuario configura qué prioriza el bot en decisiones locales. Esto evita que exista una “opción óptima” universal.
- Se modela como pesos (suman 1):
  - `w_win_round`: maximizar probabilidad de ganar la ronda.
  - `w_min_resto`: minimizar resto esperado.
  - `w_seek_minus10`: aumentar chances de cerrar -10.
  - `w_seek_chinchon`: aumentar chances de chinchón.
  - `w_reduce_variance`: jugar conservador (menos varianza).
  - `w_increase_variance`: jugar a “high roll” cuando conviene.

**Reconocimiento de patrones (qué considera “potencial”)**
- Pesos y umbrales para valorar:
  - pares (dos cartas mismo número),
  - conectores (n y n±1 mismo palo),
  - “huecos” (n y n±2 mismo palo, con gap),
  - tríos parciales,
  - comodines como “pegamento” (valorados distinto según fase).

Estas preferencias alimentan Robo y Descarte; no son “mejor/peor” porque dependen de si el bot juega corto plazo vs potencial.

### Política de Robo

Acciones disponibles:
- **Tomar del mazo** (desconocido).
- **Tomar del descarte** (carta visible).

En el estado actual, el robo se decide por modo fijo y un umbral sobre mejora de resto (y/o minFree). citeturn20view0turn36view4turn36view5  
La propuesta es reemplazar “modo” por un **sistema de evaluación configurable**, con componentes combinables (no dominados).

#### Resolver (se elige 1)

- **Utilidad con softmax (recomendado para evitar determinismo)**: calcula `U(deck)` y `U(discard)` y elige con probabilidad proporcional a `exp(U/T)`.  
- **Lista priorizada de reglas**: “si pasa X, tomar descarte”; sino “si pasa Y, tomar mazo”; etc.  
- **Pool de scripts**: el bot elige un “sub-estilo de robo” al inicio de la ronda (o por fase) y lo mantiene (genera personalidad consistente). Inspirable en selección de reglas proporcional al peso. citeturn24view1  

#### Consideraciones configurables (se combinan; cada una tiene peso y curva)

Cada consideración devuelve un valor normalizado (-1..+1) que afecta `U(discard)` o `U(deck)`.

1. **Mejora inmediata (mano)**
   - Parámetros:
     - `weight_resto_improvement`
     - `weight_minFree_improvement`
     - curva: lineal / escalón / sigmoide (cómo crece la preferencia).
   - Significado: cuánto valora el bot mejorar *ya* la mano al tomar una carta visible.

2. **Costo de información (ocultamiento)**
   - Parámetros:
     - `info_cost_discard_take` (>=0)
     - activación por fase (p. ej. se vuelve más importante cuando se va ganando).
   - Significado: penaliza tomar del descarte por “revelar intención”. Esto convierte el “solo mazo” en un extremo justificable (alto deseo de ocultamiento), no en una opción “tonta”.

3. **Valor del “misterio” del mazo**
   - Parámetros:
     - `deck_exploration_bias`
     - `deck_endgame_decay_curve` (cómo cae el sesgo a medida que baja `deckRemaining`)
   - Significado: algunos bots prefieren mazo temprano (más incertidumbre favorable), pero cambian a descarte al final.

4. **Antibloqueo / tempo**
   - Parámetros:
     - `tempo_weight`: preferencia por tomar descarte si acelera posibilidad de cortar pronto.
     - `tempo_threshold`: define qué es “acelerar” (en términos de resto/minFree).
   - Significado: bots que “cortan en cuanto pueden” suelen tener estilo tempo.

5. **Reacción al rival (usando tus observables permitidos)**
   - Señales: `opp_kept_from_discard`, `opp_kept_from_deck`.
   - Parámetros:
     - `opp_discard_hunger_sensitivity`
     - `opp_deck_hunger_sensitivity`
     - regla: “si el rival viene reteniendo mucho del descarte, ajustar mi toma del descarte” (puede ser hacia + o hacia - según estilo).
   - Significado: permite bots que “se asustan” del rival, bots que lo “niegan”, bots indiferentes.

6. **Proto-objetivos vinculados a chinchón / -10**
   - Parámetros:
     - `seek_chinchon_weight_in_draw`
     - `seek_minus10_weight_in_draw`
     - `chinchon_distance_model` (definición de “cerca”: 4/5/6 cartas de corrida potencial).
   - Significado: extiende lo que hoy está hardcodeado como `pursueChinchon`/`chinchonThreshold` en corte a un criterio transversal. citeturn13view0turn36view9  

#### Parámetros de “miscalibration” controlada (para no ser trivialmente explotable)

- `mistake_rate` (0–x%): el bot, con baja probabilidad, elige la segunda mejor acción.  
  Esto no es “hacerlo peor” desde UI; es una forma de emular estilos humanos y de crear bots no deterministas, sin meter opciones dominadas.

### Política de Descarte

Acción: elegir **qué carta descartar** (cumpliendo reglas: el comodín no se descarta). citeturn3view0turn34view0turn20view0  
Hoy el sistema ofrece:
- descartar “por valor”,
- “por rango”,
- o “óptimo” por brute-force de las 8 opciones (con marketing de “más inteligente”). citeturn35view3turn29view3turn20view0  

La propuesta: un **scorer multicriterio** sobre candidatos de descarte, donde los criterios habilitan estilos y trade-offs.

#### Resolver (se elige 1)

- **Utilidad por suma ponderada** (y opcional softmax): puntuar cada carta candidata con un vector de criterios y decidir.
- **Lista priorizada de reglas**: “si tengo sueltas altas, tirar la más alta; si no, tirar la que rompe menos potencial”, etc.
- **Pool de estilos de descarte**: el bot sortea su estilo por ronda (p. ej. “limpiador”, “constructor”, “táctico”) según pesos.

#### Reglas/criterios configurables (se combinan, cada uno con peso)

1. **Minimización de resto (corto plazo)**  
   - `w_after_discard_resto` (peso de “resto después del descarte, según mejor meld”).
   - `w_after_discard_minFree`.

2. **Preservación de potencial (largo plazo)**
   - `w_keep_pairs` (no tirar cartas que completan pares).
   - `w_keep_connectors` (no tirar conectores de escalera).
   - `w_keep_same_suit_density` (no romper acumulación de palo).
   - `gap_tolerance` (cuánto valora (n, n+2) como potencial de escalera).

3. **Gestión de comodín**
   - `joker_protection_level`: cuánto prioriza conservar estructura donde el comodín sea “cerrable” y no quede suelto (recordando que su costo suelto es muy alto). citeturn3view0turn20view0  
   - `joker_as_bridge_bias`: usar comodín para completar corridas vs para grupos.

4. **Control de “señal” al rival (decepción)**
   - `signal_suppression_weight`: descartar cartas que confundan respecto a tu objetivo (p. ej. si estás juntando un palo, evitar descartar ese palo, o al revés según estilo).
   - Importante: esto genera estilos; no es “mejor” siempre.

5. **Penalización por regalar “cartas universalmente útiles”**
   - Con info limitada (solo última carta visible y contadores), se puede aproximar “utilidad general”:
     - cartas medias (4–7) suelen ser más flexibles para corridas,
     - cartas que son “conectoras” con muchas otras en el mazo.
   - Parámetros:
     - `opp_help_avoidance_weight`
     - `opp_help_model` (cómo estima qué ayuda: por valor, por centralidad de rank, por palo; configurable).

6. **Regla de consistencia**
   - `discard_style_inertia`: evita cambios bruscos (para personalidad).
   - Implementación funcional: penaliza descartar una carta que contradiga decisiones previas de ese turno (por ejemplo, si robó del descarte una carta y luego la tira: puede ser válido, pero se controla con un peso, no se prohíbe).

7. **Reacción al rival con los contadores**
   - Si el rival “retiene mucho” (de mazo o descarte), el bot puede:
     - acelerar limpieza (descartar para cortar pronto),
     - o jugar a bloqueo (no “alimentar” descartes).
   - Parámetros:
     - `opp_pressure_response`: {acelerar, bloquear, ignorar, aleatorio ponderado}
     - umbrales: `opp_kept_discard_threshold`, `opp_kept_deck_threshold`.

#### Curvas y combinadores

Cada criterio puede usar:
- lineal,
- escalón por umbral,
- sigmoide (cambio suave),
- “campana” (preferir valores intermedios).

Esto es clave para evitar que el sistema sea “siempre igual”: distintos bots ponderan distinto y reaccionan distinto.

### Política de Corte

Acción: **cortar ahora** o **no cortar** (seguir jugando), sujeto a reglas estrictas del juego. citeturn3view0turn34view0turn20view0  
En el estado actual, “cortar” se reduce a umbrales (máx sueltas, resto ≤ X) con un opcional adaptativo por puntaje propio, y flags de “perseguir chinchón” o “modo corrida”. citeturn13view0turn36view8turn36view9  

La propuesta: un sistema donde **cortar** sea una decisión con utilidad, que compite contra “seguir” con una evaluación de riesgo/beneficio, **usando los observables permitidos** (puntajes de ambos jugadores, deckRemaining, contadores del rival).

#### Resolver (se elige 1)

- **Regla por umbral** (modo simple): mantiene compatibilidad con el modelo actual (resto y sueltas). citeturn13view0turn36view7  
- **Utilidad comparar “cortar” vs “seguir”**: recomendado para que no haya un “umbral obvio” universal.
- **Probabilístico condicionado**: sobre todo cuando los puntajes están parejos o el deck está alto (más espacio para estilos).

#### Parámetros configurables (extensión del modelo actual)

1. **Restricciones de legalidad (no negociables)**
   - max sueltas y max resto legal (según reglas). citeturn3view0turn34view0  
   - Nota: el configurador debe guiar al usuario para no crear bots ilegales.

2. **Umbral base (compatibilidad)**
   - `maxFreeAllowed` (0 o 1, como hoy). citeturn36view7turn13view0  
   - `baseRestoTarget` (0..5, como hoy). citeturn36view8turn13view0  
   - Pero ya no se presenta como “mejor”: se integra a fases y utilidad.

3. **Fases completas (generalización de scoreRules)**
   - En lugar de 4 rangos fijos de puntaje propio, permitir que el usuario defina N reglas por fase:
     - condición de fase (ej. `myScore>=75`, `deckRemaining<=10`, `scoreDelta<=-20`),
     - target dinámico (`restoTarget`, `maxFreeTarget`),
     - y además pesos para objetivos (buscar -10/chinchón).
   - Motivación: hoy el corte adaptativo segmenta solo por puntaje propio y con 4 entradas fijas. citeturn13view0turn36view8  

4. **Evaluación de riesgo (seguir vs cortar)**
   - Inputs permitidos:
     - `deckRemaining`,
     - `myScore`, `oppScore`,
     - `opp_kept_from_deck`, `opp_kept_from_discard`.
   - Parámetros:
     - `risk_aversion`: cuánto penaliza “seguir” cuando el rival parece estar progresando.
     - `deck_urgency_curve`: cuando el mazo está bajo, sube la urgencia por cerrar.
     - `lead_protection`: si voy ganando en el match (menor puntaje), corto antes para reducir varianza.
     - `desperation_mode`: si voy perdiendo por X, habilito estrategias de alta varianza (buscar chinchón / -10).

5. **Persecución de -10 y chinchón como objetivos (no como toggles)**
   - En el repo, “perseguir chinchón” y “modo corrida” hoy son flags que fuerzan “solo cortar con mano perfecta” en ciertos patrones. citeturn36view9turn13view0turn20view0  
   - En v2, esto se vuelve:
     - `w_seek_minus10_in_cut`
     - `w_seek_chinchon_in_cut`
     - `chinchon_pursuit_activation`: definido como condición configurable (no solo 5/6 cartas).
   - Crucial: esto crea bots “cazadores” y “anti-cazadores” sin que uno sea universalmente superior.

## Ejemplos de configuraciones para mostrar la versatilidad

No son “presets mejores”: son demostraciones de que, con el modelo propuesto, pueden existir estilos genuinamente distintos y comparables.

### Bot “Ocultista” (casi nunca toma descarte, pero no es “tonto”)

- Robo:
  - alto `info_cost_discard_take`,
  - moderado `deck_exploration_bias`,
  - toma descarte solo si reduce `minFree` (mejora estructural fuerte).
- Descarte:
  - alto `signal_suppression_weight`,
  - prioriza mantener densidad de palo (prepara corridas).
- Corte:
  - si va ganando, baja tolerancia a riesgo (corta antes);
  - si va perdiendo, sube `w_seek_minus10_in_cut`.

### Bot “Constructor” (maximiza potencial, tolera sueltas bajas)

- Robo:
  - valora conectores y pares; puede tomar descarte aunque no baje “resto” si mejora potencial.
- Descarte:
  - altísimo `w_keep_connectors` y `w_keep_pairs`,
  - descarta puntos altos *solo si* no rompen estructura.
- Corte:
  - no corta con resto 5 habitualmente; prefiere -10 más seguido.

### Bot “Presionador” (reacciona a contadores del rival)

- Si `opp_kept_from_discard` crece rápido:
  - Robo: más dispuesto a tomar descarte para “vaciar” oportunidades.
  - Corte: aumenta urgencia por cortar (reduce rounds largos).
- Si `opp_kept_from_deck` crece:
  - interpreta que rival busca mejoría “oculta”; acelera cierre para reducir el tiempo de construcción.

### Bot “Camaleón” (pool de scripts por ronda)

- Al inicio de cada ronda (o al entrar en “fase”):
  - elige una sub-estrategia de un pool: {tempo, constructor, ocultista, cazador},
  - probabilidad proporcional a pesos (como idea general de rulebase ponderada). citeturn24view1  
- Esto crea variedad intra-match sin necesidad de parámetros dominados.

## Implicancias de implementación y compatibilidad

### Qué habría que exponer al bot (alineado con tu lista de información)

Hoy, la lógica de simulación/estrategia en la librería usa firmas reducidas:
- `canCut(m7, score, hand)` recibe solo **puntaje propio** (no el del rival). citeturn20view0turn13view0  
- La decisión de robo usa el `top` del descarte y el modo `drawConfig`, pero no incorpora “deckRemaining” como input explícito del bot (aunque existe como `deck.length`). citeturn20view0turn35view4  
- Se contabilizan cartas “retenidas” durante rondas (`dr[p]++` si la carta robada no se descarta inmediatamente), pero no se separa por fuente (mazo vs descarte) en la estructura expuesta a estrategias. citeturn20view0  

Para cumplir tu requerimiento funcional (y habilitar el espacio de bots propuesto), el motor debería pasar a las políticas un objeto de observación unificado, por ejemplo:

- `hand`
- `deckRemaining`
- `topDiscard`
- `scores: { me, opp }`
- `opponentKept: { fromDeck, fromDiscard }`

La separación `fromDeck/fromDiscard` requiere instrumentar el motor (hoy se distingue internamente el origen en la rama de robo, pero no queda persistido como contador separado). citeturn20view0turn35view4  

### Migración desde el esquema actual

El repo ya implementa carga/guardado de configs custom y sanitización de imports, con límites como `MAX_CUSTOM_BOTS`. citeturn13view0turn36view4  
La migración funcional recomendada:

- Configs v1 se importan como v2 usando un “traductor”:
  - `draw.mode` se mapea a pesos iniciales de Robo (por ejemplo, `always_deck` => alto costo de info o alto sesgo deck).
  - `discard.mode` se mapea a pesos de Descarte (por ejemplo, `optimal` => alto peso a minimización de resto inmediato).
  - `cut.*` se convierte a una fase simple de Corte con umbrales equivalentes.

Así, ningún usuario pierde bots existentes, pero el nuevo sistema deja de “encorsetar” el crecimiento futuro.

### Riesgo de complejidad y cómo mitigarlo en UX

El riesgo típico de sistemas configurables es terminar en una UI inabordable. El enfoque “modo rápido + modo avanzado” y el uso de **inspectores** (qué ve el bot, qué criterios están activos, por qué tomó una decisión) apuntan a mantener la herramienta usable sin sacrificar expresividad—principio alineado con el énfasis en “customizability” y “explicitness” para escalar sistemas de AI en juegos. citeturn24view3turn22view0turn24view2