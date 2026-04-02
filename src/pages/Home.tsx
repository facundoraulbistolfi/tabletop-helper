import { useDeferredValue, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  CATALOG_ITEMS,
  FILTER_META,
  FILTER_TAGS,
  FAVORITES_STORAGE_KEY,
  LEGACY_FAVORITES_STORAGE_KEY,
  type CatalogItem,
  type FilterTag,
  getFavoriteCatalogItems,
  getVisibleCatalogItems,
  normalizeSearchTerm,
  sortCatalogItemsByFavorites,
} from '../lib/home-catalog'
import { prefetchRoute } from '../lib/page-loaders'
import '../styles/home.css'

function loadFavorites(): Set<string> {
  try {
    const current = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (current) return new Set(JSON.parse(current) as string[])

    const legacy = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY)
    if (!legacy) return new Set()

    const migrated = new Set(JSON.parse(legacy) as string[])
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...migrated]))
    localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY)
    return migrated
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favs]))
  localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY)
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function HomeDivider({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 180"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 116c86-4 120-62 191-62 74 0 112 74 193 74s127-56 202-56 105 42 176 42 115-64 190-64 124 44 248 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M42 124h1116"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="4 14"
        opacity="0.3"
      />
      <circle cx="176" cy="92" r="10" fill="currentColor" opacity="0.18" />
      <circle cx="598" cy="62" r="14" fill="currentColor" opacity="0.18" />
      <circle cx="1012" cy="82" r="12" fill="currentColor" opacity="0.18" />
    </svg>
  )
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterTag | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites)
  const [flippedCards, setFlippedCards] = useState<Set<string>>(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const normalizedSearch = normalizeSearchTerm(searchQuery)
  const favoriteItems = getFavoriteCatalogItems(CATALOG_ITEMS, favorites)
  const visibleItems = getVisibleCatalogItems(CATALOG_ITEMS, activeFilter, deferredSearchQuery)
  const orderedItems = sortCatalogItemsByFavorites(visibleItems, favorites)
  const visibleFavoriteCount = getFavoriteCatalogItems(visibleItems, favorites).length
  const hasSearch = normalizedSearch.length > 0
  const totalExternalCount = CATALOG_ITEMS.filter(item => item.kind === 'external').length
  const libraryEyebrow = activeFilter ? FILTER_META[activeFilter].eyebrow : 'Biblioteca viva'
  const libraryTitle = activeFilter ? FILTER_META[activeFilter].title : 'Un gran compendio'
  const libraryDescription = activeFilter
    ? FILTER_META[activeFilter].description
    : 'Todo vive en la misma biblioteca: herramientas internas, portales curados y favoritos al frente.'

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }

  function warmCatalogItem(item: CatalogItem) {
    if (item.kind === 'internal') prefetchRoute(item.to)
  }

  function toggleCardFace(id: string) {
    setFlippedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderCatalogAction(item: CatalogItem, className: string, label: string) {
    if (item.kind === 'external') {
      return (
        <a
          className={className}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      )
    }

    return (
      <Link
        className={className}
        to={item.to}
        onMouseEnter={() => warmCatalogItem(item)}
        onFocus={() => warmCatalogItem(item)}
      >
        {label}
      </Link>
    )
  }

  function openFavoritesView() {
    setActiveFilter(null)
    setSearchQuery('')
    scrollToSection('catalog-section')
  }

  function renderQuickLink(item: CatalogItem) {
    const content = (
      <>
        <span aria-hidden="true">{item.icon}</span>
        <span>{item.title}</span>
      </>
    )

    if (item.kind === 'external') {
      return (
        <a
          key={`shortcut-${item.id}`}
          className="home-stage__quicklink"
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      )
    }

    return (
      <Link
        key={`shortcut-${item.id}`}
        className="home-stage__quicklink"
        to={item.to}
        onMouseEnter={() => warmCatalogItem(item)}
        onFocus={() => warmCatalogItem(item)}
      >
        {content}
      </Link>
    )
  }

  function renderCatalogFolio(item: CatalogItem) {
    const isFavorite = favorites.has(item.id)
    const isFlipped = flippedCards.has(item.id)
    const actionLabel = item.kind === 'external' ? 'Visitar' : 'Abrir'
    const primaryTag = item.tags[0]
    const detailChips = [...new Set([...item.chips, ...item.tags.slice(1)])].slice(0, 4)
    const bookStyle = { '--book-accent': item.accent } as CSSProperties

    return (
      <article
        key={item.id}
        className={`home-book home-book--${item.collection} home-book--${item.coverStyle}${isFavorite ? ' is-favorite' : ''}${item.kind === 'external' ? ' is-external' : ''}${isFlipped ? ' is-flipped' : ''}`}
        style={bookStyle}
      >
        <div className="home-book__spine" aria-hidden="true" />
        <button
          type="button"
          className={`home-book__bookmark${isFavorite ? ' is-active' : ''}`}
          aria-label={isFavorite ? `Quitar ${item.title} de favoritos` : `Agregar ${item.title} a favoritos`}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(item.id)}
        >
          <span aria-hidden="true">{isFavorite ? '★' : '✦'}</span>
        </button>
        <button
          type="button"
          className={`home-book__flip-corner${isFlipped ? ' is-active' : ''}`}
          aria-label={isFlipped ? `Volver a la tapa de ${item.title}` : `Ver más info de ${item.title}`}
          aria-pressed={isFlipped}
          aria-expanded={isFlipped}
          onClick={() => toggleCardFace(item.id)}
        >
          <span className="home-book__flip-corner-fold" aria-hidden="true" />
          <span className="home-book__flip-corner-mark" aria-hidden="true">{isFlipped ? '↺' : 'i'}</span>
        </button>

        <div className="home-book__scene">
          <div className="home-book__face home-book__face--front" aria-hidden={isFlipped}>
            <div className="home-book__cover-top">
              <div className="home-book__cover-labels">
                <span className="home-book__category">{primaryTag}</span>
              </div>
              {item.kind === 'external' && (
                <span className="home-book__seal" title="Enlace externo" aria-label="Enlace externo">
                  <span aria-hidden="true">↗</span>
                  <span className="home-book__seal-label" aria-hidden="true">ext</span>
                </span>
              )}
            </div>

            <div className="home-book__title-block">
              <span className="home-book__symbol" aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p className="home-book__byline">{item.subtitle}</p>
            </div>

            <div className="home-book__ornament" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="home-book__face-actions">
              {renderCatalogAction(item, 'cta home-cta home-cta--book', actionLabel)}
            </div>
          </div>

          <div className="home-book__face home-book__face--back" aria-hidden={!isFlipped}>
            <div className="home-book__back-top">
              <span className="home-book__back-kicker">{`Coleccion ${item.shelfLabel}`}</span>
              <span className="home-book__back-icon" aria-hidden="true">{item.icon}</span>
            </div>

            <div className="home-book__back-copy">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>

            <div className="home-book__chips">
              {detailChips.map(chip => (
                <span key={chip} className="home-book__chip">{chip}</span>
              ))}
            </div>

            <div className="home-book__face-actions">
              {renderCatalogAction(item, 'cta home-cta home-cta--book', actionLabel)}
            </div>
          </div>
        </div>
      </article>
    )
  }

  const emptyTitle = hasSearch
    ? `No encontre resultados para "${searchQuery.trim()}".`
    : activeFilter
      ? `No hay entradas visibles en ${activeFilter}.`
      : 'No hay entradas para mostrar.'
  const emptyCopy = hasSearch
    ? 'Proba con otro nombre, una etiqueta o cambiando el filtro activo.'
    : 'Probá volver a "Todos" para revisar el compendio completo.'

  return (
    <main className="page page--home" id="main-content">
      <section className="home-stage" aria-labelledby="home-title">
        <div className="home-stage__mist home-stage__mist--far" aria-hidden="true" />
        <div className="home-stage__mist home-stage__mist--near" aria-hidden="true" />
        <div className="home-stage__glow home-stage__glow--left" aria-hidden="true" />
        <div className="home-stage__glow home-stage__glow--right" aria-hidden="true" />

        <div className="home-stage__frame">
          {favoriteItems.length > 0 && (
            <div className="home-stage__quicklinks" aria-label="Favoritas destacadas">
              <span className="home-stage__quicklinks-label">Favoritas</span>
              {favoriteItems.slice(0, 3).map(renderQuickLink)}
            </div>
          )}

          <div className="home-stage__content">
            <div className="home-stage__copy">
              <div className="home-kicker">Bosque encantado de herramientas</div>
              <div className="home-stage__title-row">
                <h1 id="home-title">
                  <span className="home-stage__title-mark" aria-hidden="true">📚</span>
                  <span>Ludario</span>
                  <span className="home-stage__title-mark" aria-hidden="true">📚</span>
                </h1>
              </div>
              <p className="home-stage__lede">
                Una biblioteca nocturna para partidas, puzzles y mesas de cartas: todo convive en el
                mismo estante, con favoritos al frente y sin instalar nada.
              </p>

              <div className="home-stage__actions">
                <button
                  type="button"
                  className="cta home-cta home-cta--primary"
                  onClick={() => scrollToSection('catalog-section')}
                >
                  Abrir compendio
                </button>
                {favoriteItems.length > 0 && (
                  <button
                    type="button"
                    className="cta home-cta home-cta--secondary"
                    onClick={openFavoritesView}
                  >
                    Ir a favoritas
                  </button>
                )}
              </div>

              <div className="home-stage__notes" aria-label="Resumen del catálogo">
                <span>{CATALOG_ITEMS.length} entradas</span>
                <span>{favoriteItems.length > 0 ? `${favoriteItems.length} favoritas` : `${totalExternalCount} portales externos`}</span>
              </div>
            </div>
          </div>
        </div>

        <HomeDivider className="home-stage__divider" />
      </section>

      <section
        className="home-library"
        id="catalog-section"
        aria-labelledby="catalog-title"
      >
        <div className="home-library__header">
          <div>
            <div className="home-kicker home-kicker--small">{libraryEyebrow}</div>
            <h2 id="catalog-title">{libraryTitle}</h2>
          </div>
          <p>{libraryDescription}</p>
        </div>

        <div className="home-search-panel">
          <label className="home-search" htmlFor="home-search-input">
            <span className="home-search__label">Buscar por nombre, etiqueta o chip</span>
            <div className="home-search__control" role="search">
              <span className="home-search__icon" aria-hidden="true">⌕</span>
              <input
                id="home-search-input"
                type="search"
                value={searchQuery}
                placeholder="Ej: anotador, PacMan, externo, lectura"
                onChange={event => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="home-search__clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => setSearchQuery('')}
                >
                  Limpiar
                </button>
              )}
            </div>
          </label>

          <div className="home-filter-bar" role="toolbar" aria-label="Filtrar por etiqueta">
            <button
              type="button"
              className={`home-filter-btn${activeFilter === null ? ' is-active' : ''}`}
              aria-pressed={activeFilter === null}
              onClick={() => setActiveFilter(null)}
            >
              Todos
            </button>
            {FILTER_TAGS.map(filterTag => (
              <button
                type="button"
                key={filterTag}
                className={`home-filter-btn${activeFilter === filterTag ? ' is-active' : ''}`}
                aria-pressed={activeFilter === filterTag}
                onClick={() => setActiveFilter(activeFilter === filterTag ? null : filterTag)}
              >
                {filterTag}
              </button>
            ))}
            <span className="home-filter-bar__count">
              {visibleItems.length} visibles de {CATALOG_ITEMS.length}
              {visibleFavoriteCount > 0 ? ` · ${visibleFavoriteCount} favoritas` : ''}
            </span>
          </div>
        </div>

        {orderedItems.length > 0 ? (
          <div className="home-book-grid home-book-grid--library" aria-label="Biblioteca completa">
            {orderedItems.map(renderCatalogFolio)}
          </div>
        ) : (
          <div className="home-empty-state">
            <div className="home-kicker home-kicker--small">Estante despejado</div>
            <h3>{emptyTitle}</h3>
            <p>{emptyCopy}</p>
          </div>
        )}
      </section>

      <footer className="home-closing">
        <HomeDivider className="home-closing__divider" />
        <p>
          📚 Ludario sigue siendo una colección liviana para jugar mejor desde el teléfono o la compu.
          Si querés ver el detrás de escena, el código vive en{' '}
          <a
            href="https://github.com/facundoraulbistolfi/ludario"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
