import { Autocomplete } from '@mantine/core';
import { loadModels, useModels } from 'dirk-cfx-react';
import { useEffect, useMemo } from 'react';
import { useInputStyles } from './Controls';

/**
 * A world/prop model name, searchable against the full GTA model list.
 *
 * NOT cfx-react's ModelSelect: that component exposes `style` but no `styles`,
 * so it renders at Mantine's default input sizing while every other control in
 * this panel is on the shared vh-based style - it stood out as visibly taller
 * and differently bordered from the field above it. Same model list, same
 * search, panel styling.
 */
export function ModelControl({
  value, onChange, disabled, compact,
}: {
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const styles = useInputStyles(compact);
  const { models, loading } = useModels();

  // the list is a ~1MB dynamic import, so it is only pulled once something asks
  useEffect(() => { loadModels(); }, []);

  const current = typeof value === 'string' ? value : '';

  // Mantine renders every option it is given; the full list is tens of
  // thousands, so it gets filtered down to what is being typed.
  const data = useMemo(() => {
    const needle = current.trim().toLowerCase();
    if (!needle) return models.slice(0, 100);
    const hits = models.filter((model) => model.toLowerCase().includes(needle));
    // keep whatever is typed selectable even when it is not a known model
    if (!hits.includes(current)) hits.unshift(current);
    return hits.slice(0, 100);
  }, [models, current]);

  return (
    <Autocomplete
      value={current}
      onChange={onChange}
      data={data}
      disabled={disabled}
      placeholder={loading ? 'Loading models...' : 'prop_...'}
      limit={100}
      comboboxProps={{ zIndex: 10800 }}
      styles={styles}
      style={{ flex: 1 }}
    />
  );
}
