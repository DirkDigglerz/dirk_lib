import { Autocomplete } from '@mantine/core';
import { fetchNui, type Vehicle } from 'dirk-cfx-react';
import { useEffect, useMemo, useState } from 'react';
import { useInputStyles } from './Controls';

/**
 * A vehicle, searched by display name or spawn name.
 *
 * `x-control: "vehicle"` used to be a bare text box — you had to know the spawn
 * name and type it exactly, and a typo produced a setting that silently matched
 * nothing. `model` next to it IS searchable, but it lists every model in the
 * game, so picking a car meant scrolling past props and peds.
 *
 * Searching on the NAME as well as the model matters: nobody knows `sultanrs`
 * from `casco` by heart, and the framework already tells us both.
 */
export function VehicleControl({
  value, onChange, disabled, compact,
}: {
  value: unknown;
  onChange: (next: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const styles = useInputStyles(compact);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Fetched directly rather than through cfx-react's `ensureVehicles`, which
  // guards itself with a module-level "already requested" flag — one early call
  // that came back empty is cached for the life of the page and nothing
  // retries. The catalogue page hit this and does the same.
  useEffect(() => {
    let live = true;
    fetchNui<Vehicle[]>('GET_VEHICLES', undefined, [])
      .then((data) => { if (live) setVehicles(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setVehicles([]); });
    return () => { live = false; };
  }, []);

  const current = typeof value === 'string' ? value : '';

  /**
   * Options are "Sultan RS — sultanrs", so the list is readable and the search
   * hits either half. The STORED value is always the spawn name, which is
   * pulled back out on pick.
   */
  const options = useMemo(() => {
    const needle = current.trim().toLowerCase();
    const labelled = vehicles.map((v) => ({
      label: v.name && v.name !== v.model ? `${v.name} — ${v.model}` : v.model,
      model: v.model,
    }));
    const hits = needle
      ? labelled.filter((o) => o.label.toLowerCase().includes(needle))
      : labelled;
    // Whatever is typed stays selectable even when it is not a known vehicle —
    // an addon car the framework has not been told about is still valid.
    const list = hits.slice(0, 100).map((o) => o.label);
    if (current && !list.includes(current)) list.unshift(current);
    return list;
  }, [vehicles, current]);

  return (
    <Autocomplete
      value={current}
      onChange={(next) => {
        // "Sultan RS — sultanrs" back to "sultanrs". A typed value with no
        // dash is taken as the spawn name it looks like.
        const dash = next.lastIndexOf(' — ');
        onChange(dash === -1 ? next : next.slice(dash + 3));
      }}
      data={options}
      disabled={disabled}
      placeholder="Search vehicles"
      limit={100}
      styles={{ ...styles, input: { ...styles.input, fontFamily: 'monospace' } }}
      style={{ flex: 1 }}
    />
  );
}
