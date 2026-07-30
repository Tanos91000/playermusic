/** Briques réutilisables de la fenêtre de paramètres. */

export function Section({ id, title, description, icon: Icon, children }) {
  return (
    <section id={id} className="set-section">
      <div className="set-section__head">
        {Icon && (
          <span className="set-section__icon" aria-hidden>
            <Icon size={17} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 className="set-section__title">{title}</h3>
          {description && <p className="set-section__desc">{description}</p>}
        </div>
      </div>
      <div className="set-section__body">{children}</div>
    </section>
  );
}

export function Row({ title, description, children, stacked = false }) {
  return (
    <div className={`set-row${stacked ? ' set-row--stacked' : ''}`}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h4 className="set-row__title">{title}</h4>
        {description && <p className="set-row__desc">{description}</p>}
      </div>
      {children != null && <div className="set-row__control">{children}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="set-toggle" aria-label={label}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="set-toggle__track">
        <span className="set-toggle__thumb" />
      </span>
    </label>
  );
}

export function Select({ value, onChange, options, label }) {
  return (
    <select className="set-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextField({ value, onChange, onBlur, placeholder, id, type = 'text', mono = false }) {
  return (
    <input
      id={id}
      type={type}
      autoComplete="off"
      spellCheck={false}
      className="set-input"
      style={mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' } : undefined}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}
