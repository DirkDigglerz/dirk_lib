import { Box, Flex, Text, useMantineTheme } from '@mantine/core';
import {
  createThemeResolver,
  DesignSurface,
  fromPortable,
  previewDesign,
  builtinComponents,
  componentCompat,
  type PortableManifest,
  type StudioComponent,
  type StudioDesign,
  type StudioManifest,
} from 'dirk-ui-studio/runtime';
import * as Lucide from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import portableJson from './fixtures/loadingPortable.json';
import { useChrome } from './studioLocale';

/**
 * Live design + component tiles for the hub.
 *
 * These used to be PNGs captured headlessly from dirk_loading. That was fine for
 * settling the layout and wrong to keep: the moment a component changed, the tile
 * would quietly go on showing last week's version with nothing to say it had.
 *
 * dirk_lib cannot import dirk_loading's manifest — it carries functions, and the
 * dependency would point the wrong way besides. So the resource emits a PORTABLE
 * manifest (see dirk-ui-studio core/portable.ts): plain JSON with images and
 * locale strings pre-resolved, which `fromPortable` turns back into something the
 * runtime renders. Everything behavioural is gone, which is exactly right — a
 * thumbnail reads `source.sample`, never live data.
 *
 * The fixture is currently checked in. When the design page stops being a mock the
 * same JSON arrives over the wire instead, and nothing here changes.
 */

const portable = portableJson as unknown as PortableManifest;

/** the Studio's own canvas colour — dirk-ui-studio src/editor/ui.tsx */
export const CANVAS = '#080a08';

/**
 * dirk_loading draws icons from Lucide by PascalCase name (see its iconSets.tsx).
 * dirk_lib has Lucide too, so only the DRAWING has to be re-supplied on this side
 * — the names survived the trip in the portable manifest.
 */
const renderIcon = (name: string, { size, color }: { size: number | string; color: string }) => {
  const Comp = (Lucide as unknown as Record<string, ComponentType<{ size?: number | string; color?: string }>>)[name];
  return Comp ? <Comp size={size} color={color} /> : null;
};

export const loadingManifest: StudioManifest = fromPortable(portable, renderIcon);
export const loadingDesigns: StudioDesign[] = portable.designs;

/**
 * Components come from the PACKAGE, not the payload — they are built in, so
 * shipping copies would only let the two drift. Their thumbnails render through
 * `previewDesign`, the same throwaway wrapper the editor's own panel uses, which
 * is what frames a small atom at its own extent instead of lost in a corner.
 */
export const loadingComponents: StudioComponent[] = [
  ...builtinComponents,
  ...(portable.components ?? []),
]
  // Same filter the editor's own panel applies: a component that needs a data
  // source or action this manifest does not have would render as a broken tile
  // and could not be dropped anyway.
  .filter((c) => componentCompat(c, loadingManifest).ok);

export const componentPreview = (component: StudioComponent): StudioDesign =>
  previewDesign(component, portable.kind);

/**
 * One tile: the design scaled to fit a 16:9 box and centred on the canvas colour.
 *
 * The scale is against the design's OWN reference, not a fixed 1600x900 — a
 * component's preview design is framed to its bounds, and assuming the full stage
 * would render it as a speck in the corner. Same maths as the real Gallery's Thumb.
 */
export function LiveThumb({
  design,
  manifest,
  ratio = 16 / 9,
}: {
  design: StudioDesign;
  manifest: StudioManifest;
  /** width ÷ height of the frame; designs and components both use 16:9 */
  ratio?: number;
}) {
  const t = useChrome();
  const theme = useMantineTheme();

  // measure rather than assume: the cards stretch to fill their grid track, so a
  // width guessed here would scale the surface for a box it is not in
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useLayoutEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const read = () => setBoxW(node.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const resolveColour = useMemo(
    () =>
      createThemeResolver({
        colors: theme.colors,
        primaryColor: theme.primaryColor,
        primaryShade: typeof theme.primaryShade === 'number' ? theme.primaryShade : (theme.primaryShade?.dark ?? 6),
      }),
    [theme],
  );

  const accent = theme.colors[theme.primaryColor][5];
  const ref = design.reference ?? { w: 1600, h: 900 };
  const boxH = boxW / ratio;
  const scale = Math.min(boxW / ref.w, boxH / ref.h);
  const offX = Math.max(0, (boxW - ref.w * scale) / 2);
  const offY = Math.max(0, (boxH - ref.h * scale) / 2);

  return (
    <Box
      ref={boxRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${ratio}`,
        overflow: 'hidden',
        backgroundColor: CANVAS,
        borderBottom: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      {/* boxW is 0 until the observer has measured; rendering at that point would
          scale everything to nothing and flash */}
      {boxW > 0 && design.elements.length ? (
        <Box
          style={{
            position: 'absolute',
            top: offY,
            left: offX,
            width: ref.w,
            height: ref.h,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        >
          <DesignSurface
            design={design}
            manifest={manifest}
            accent={accent}
            resolveColour={resolveColour}
            interactive={false}
          />
        </Box>
      ) : boxW > 0 ? (
        <Flex align="center" justify="center" h="100%">
          <Text tt="uppercase" style={{ fontSize: '1.1vh', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)' }}>
            {t('liveThumb.blank_canvas', 'Blank canvas')}
          </Text>
        </Flex>
      ) : null}
    </Box>
  );
}
