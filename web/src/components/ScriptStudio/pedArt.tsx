import { alpha, useMantineTheme } from '@mantine/core';
import { User } from 'lucide-react';
import { useState } from 'react';

/**
 * Ped artwork.
 *
 * Its own file because both the ped LIST and the ped PICKER draw peds, and the
 * list opens the picker - putting the artwork in either one would have them
 * importing each other.
 */

/**
 * Where ped artwork comes from.
 *
 * Same shape as the vehicle catalogue's source. A model that host does not
 * have simply falls back - nothing here depends on the image existing, and a
 * server owner naming a custom ped will usually have no picture for it at all.
 */
export const PED_IMAGE = 'https://cdn.sky-systems.net/peds/%s.png';

export function pedImageUrl(model: string): string {
  return PED_IMAGE.replace('%s', model.toLowerCase());
}

/** One ped's picture, or a silhouette when there is none. */
export function PedArt({ model, size = '9vh' }: { model: string; size?: string }) {
  const theme = useMantineTheme();
  const [failed, setFailed] = useState(false);

  // Portrait, because a ped is a standing person. A square box fitted the
  // figure to its width and left air above the head and below the feet, so the
  // ped itself came out small in a tile that was not.
  const box = {
    width: `calc(${size} * 0.62)`,
    height: size,
    borderRadius: theme.radius.xs,
    background: alpha(theme.colors.dark[9], 0.6),
    border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.45)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  } as const;

  if (!model || failed) {
    return (
      <div style={box}>
        <User size="45%" color="rgba(255,255,255,0.25)" />
      </div>
    );
  }

  return (
    <div style={box}>
      <img
        src={pedImageUrl(model)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}
