import { alpha, Flex, Loader, Text, useMantineTheme } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { load, REASONS } from './CustomControl';
import { Icon } from './Icon';
import { notify } from './Toasts';
import { studioQueryClient } from './studioQuery';
import { translate, useActiveLanguage, useBundles } from './studioLocale';
import type { ScriptPage as ScriptPageDef } from './types';

/**
 * A whole page supplied by the script that owns it.
 *
 * `x-component` covers a control standing in for one SETTING. Some of what the
 * per-script panels did was never a setting at all: fishing's Players screen
 * reads live server data, pages through it and acts on it. There is nothing in
 * the config for it to be, and inventing a fake entry just to have a mounting
 * point would put a setting in the schema that is not one.
 *
 * So a page is its own thing. dirk_lib supplies the frame, the theme, the
 * loader and a query client; the script supplies what goes in it, and keeps
 * every bit of knowledge about its own data.
 */
export function ScriptPage({
  resource, page, canEdit,
}: {
  resource: string;
  page: ScriptPageDef;
  canEdit: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const language = useActiveLanguage();
  const bundles = useBundles();

  const [state, setState] = useState<
    | { state: 'loading' }
    | { state: 'ready'; Component: React.ComponentType<Record<string, unknown>> }
    | { state: 'failed'; reason: string }
  >({ state: 'loading' });

  useEffect(() => {
    let live = true;
    setState({ state: 'loading' });
    load(resource, page.component)
      .then((Component) => {
        if (live) {
          setState({
            state: 'ready',
            Component: Component as unknown as React.ComponentType<Record<string, unknown>>,
          });
        }
      })
      .catch((error: Error) => {
        if (live) setState({ state: 'failed', reason: REASONS[error.message] ?? error.message });
      });
    return () => { live = false; };
  }, [resource, page.component]);

  return (
    <Flex direction="column" flex={1} p="md" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Flex align="flex-start" gap="xs" mb="0.6vh" style={{ flexShrink: 0 }}>
        <Flex align="center" gap="xs" style={{ flexShrink: 0 }}>
          <Icon name={page.icon} size="1.9vh" color={color} />
          <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)" lts="0.01em">
            {translate(bundles, language, resource, `studio.pages.${page.id}.label`, page.label)}
          </Text>
        </Flex>
        {page.description && (
          <Text
            ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)"
            style={{ flex: 1, minWidth: 0, lineHeight: 1.9 }}
          >
            {translate(
              bundles, language, resource,
              `studio.pages.${page.id}.description`, page.description,
            )}
          </Text>
        )}
      </Flex>

      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        {state.state === 'loading' && (
          <Flex align="center" justify="center" flex={1}>
            <Loader size="sm" color={color} />
          </Flex>
        )}

        {state.state === 'failed' && (
          <Flex
            direction="column" align="center" justify="center" gap="xs" flex={1} p="md"
            style={{
              background: alpha('#ef4444', 0.06),
              border: `0.1vh solid ${alpha('#ef4444', 0.3)}`,
              borderRadius: theme.radius.xs,
            }}
          >
            <AlertTriangle size="2.4vh" color="#ef4444" />
            <Text ff="Akrobat Bold" size="sm" c="#ef4444">
              {resource} could not supply this page
            </Text>
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.45)" ta="center">
              {state.reason}
            </Text>
            <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.25)">
              {page.component}
            </Text>
          </Flex>
        )}

        {state.state === 'ready' && (
          // Its own provider, because a script page is the first thing here
          // that fetches on its own schedule - a player list is paged, cached
          // and refetched, none of which the settings tree needs.
          <QueryClientProvider client={studioQueryClient}>
            <state.Component
              resource={resource}
              canEdit={canEdit}
              notify={notify}
              t={(key: string, fallback: string) => translate(
                bundles, language, resource, key, fallback,
              )}
            />
          </QueryClientProvider>
        )}
      </Flex>
    </Flex>
  );
}
