import { Home, Search, Heart, Download, FolderOpen, ListMusic, Users, Settings as SettingsIcon, Plus } from 'lucide-react';

export const SIDEBAR_WIDTH = 232;
export const SIDEBAR_WIDTH_COMPACT = 68;

const GROUPS = [
  {
    label: null,
    items: [
      { key: 'home', label: 'Accueil', Icon: Home },
      { key: 'search', label: 'Rechercher', Icon: Search }
    ]
  },
  {
    label: 'Bibliothèque',
    items: [
      { key: 'favorites', label: 'Titres likés', Icon: Heart },
      { key: 'playlists', label: 'Playlists', Icon: ListMusic },
      { key: 'downloads', label: 'Téléchargements', Icon: Download },
      { key: 'local', label: 'Fichiers locaux', Icon: FolderOpen },
      { key: 'jam', label: 'Jam', Icon: Users }
    ]
  }
];

function NavItem({ item, active, compact, badge, onSelect }) {
  const { key, label, Icon } = item;
  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      className={`side-nav__item${active ? ' is-active' : ''}`}
      title={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
    >
      <span className="side-nav__rail" aria-hidden />
      <Icon size={19} strokeWidth={active ? 2.4 : 2} style={{ flexShrink: 0 }} />
      {!compact && <span className="truncate">{label}</span>}
      {badge > 0 && !compact && <span className="side-nav__badge">{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
}

/**
 * Navigation latérale : remplace la rangée de pilules qui débordait sur
 * plusieurs lignes. Se réduit aux icônes seules quand la fenêtre est étroite.
 */
export default function Sidebar({
  activeTab,
  onSelect,
  compact = false,
  counts = {},
  jamActive = false,
  onCreatePlaylist
}) {
  return (
    <nav
      className="side-nav"
      style={{ width: compact ? SIDEBAR_WIDTH_COMPACT : SIDEBAR_WIDTH }}
      aria-label="Navigation principale"
    >
      <div className="side-nav__scroll custom-scrollbar">
        {GROUPS.map((group, gi) => (
          <div key={group.label || `g${gi}`} className="side-nav__group">
            {group.label && !compact && <div className="side-nav__label">{group.label}</div>}
            {group.label && compact && <div className="side-nav__divider" />}
            {group.items.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={activeTab === item.key}
                compact={compact}
                badge={item.key === 'jam' && jamActive ? -1 : counts[item.key]}
                onSelect={onSelect}
              />
            ))}
            {group.label === 'Bibliothèque' && !compact && typeof onCreatePlaylist === 'function' && (
              <button type="button" className="side-nav__item side-nav__item--ghost" onClick={onCreatePlaylist}>
                <span className="side-nav__rail" aria-hidden />
                <Plus size={19} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span className="truncate">Nouvelle playlist</span>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="side-nav__footer">
        <NavItem
          item={{ key: 'settings', label: 'Paramètres', Icon: SettingsIcon }}
          active={activeTab === 'settings'}
          compact={compact}
          onSelect={onSelect}
        />
      </div>
    </nav>
  );
}
