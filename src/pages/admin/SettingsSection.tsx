import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Mount expensive editors on first use; retain their state while collapsed. */
export function SettingsSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [opened, setOpened] = useState(defaultOpen);
  return (
    <details
      className="settings-section"
      open={defaultOpen || undefined}
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>
        <span>
          <b>{title}</b>
          {description && <small>{description}</small>}
        </span>
        <ChevronDown size={18} />
      </summary>
      {opened && <div className="settings-section-body">{children}</div>}
    </details>
  );
}
