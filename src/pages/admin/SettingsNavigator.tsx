import { Children, isValidElement, useId, useState, type ReactNode } from 'react';
import { SettingsSection } from './SettingsSection';

type Panel = { title: string; description?: string; children: ReactNode };
/** Visible section navigation: editing tools are never hidden behind expandable trays. */
export function SettingsNavigator({ children }: { children: ReactNode }) {
  const panels = Children.toArray(children).filter(
    (child) => isValidElement<Panel>(child) && child.type === SettingsSection,
  );
  const [selected, setSelected] = useState(0);
  const id = useId();
  const active = Math.min(selected, panels.length - 1);
  return (
    <div className="settings-navigator">
      <nav className="editor-section-nav" aria-label="أدوات الخلفية">
        {panels.map(
          (panel, index) =>
            isValidElement<Panel>(panel) && (
              <button
                type="button"
                key={panel.props.title}
                aria-current={index === active ? 'page' : undefined}
                aria-controls={id}
                onClick={() => setSelected(index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {panel.props.title}
              </button>
            ),
        )}
      </nav>
      {panels.map(
        (panel, index) =>
          isValidElement<Panel>(panel) &&
          index === active && (
            <section
              className="editor-section-content"
              id={id}
              key={panel.props.title}
              aria-label={panel.props.title}
            >
              <div className="editor-panel-heading">
                <h2>{panel.props.title}</h2>
                {panel.props.description && <p>{panel.props.description}</p>}
              </div>
              {panel.props.children}
            </section>
          ),
      )}
    </div>
  );
}
