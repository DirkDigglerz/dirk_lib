import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { motion } from 'framer-motion';
import {
  BookOpen, Boxes, History, Library, Save, Search, ShieldCheck, SlidersHorizontal,
} from 'lucide-react';
import { useStudio } from './store';
import { translate, useActiveLanguage, useBundles } from './studioLocale';
import { Icon } from './main';

/**
 * Where `/dirk_config` lands.
 *
 * Opening straight into whichever script sorted first meant the panel appeared
 * to be about that script, and an admin who wanted a different one had to
 * notice the rail first. Landing nowhere makes the rail the obvious next move,
 * and gives somewhere to say what this thing actually is.
 *
 * `/dirk_fishing` still opens fishing directly - someone naming a script has
 * already chosen.
 */
export function HomePage() {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const scripts = useStudio((s) => s.scripts);

  // Panel chrome, so it resolves against dirk_lib's own bundle rather than
  // whichever script happens to be selected. This page was written with the
  // English inline, which is why it stayed English while everything around it
  // translated.
  const language = useActiveLanguage();
  const bundles = useBundles();
  const t = (key: string, fallback: string) =>
    translate(bundles, language, 'dirk_lib', `studio.${key}`, fallback);

  const configurable = scripts.filter((s) => !s.shared);
  const shared = scripts.find((s) => s.shared);
  const settingCount = scripts.reduce((sum, s) => sum + s.entries.length, 0);

  return (
    <Flex
      direction="column" gap="lg" p="xl"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <Flex direction="column" gap="xs">
        <Flex align="center" gap="sm">
          <SlidersHorizontal size="3vh" color={color} />
          <Text ff="Akrobat Bold" size="xl" c="rgba(255,255,255,0.95)" tt="uppercase" lts="0.04em">
            {t('home.title', 'Script Studio')}
          </Text>
        </Flex>
        <Text ff="Akrobat SemiBold" size="sm" c="rgba(255,255,255,0.45)" style={{ maxWidth: '90vh' }}>
          {t('home.subtitle', "Every dirk script's settings, in one place. Pick a script on the left to edit it, or use the pages below the rail for things that span all of them.")}
        </Text>
      </Flex>

      <Flex gap="sm" wrap="wrap">
        <Stat icon={Boxes} value={String(configurable.length)} label={configurable.length === 1 ? t('home.stat.script', 'script') : t('home.stat.scripts', 'scripts')} />
        <Stat icon={SlidersHorizontal} value={String(settingCount)} label={t('home.stat.settings', 'settings')} />
        {shared && <Stat icon={Library} value={t('home.stat.shared', 'Shared')} label={t('home.stat.sharedHelp', 'settings every script uses')} wide />}
      </Flex>

      {configurable.length > 0 && (
        <Flex direction="column" gap="xs">
          <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.12em" c="rgba(255,255,255,0.35)">
            {t('home.detected', 'Detected on this server')}
          </Text>
          <Flex gap="xs" wrap="wrap">
            {configurable.map((script) => (
              <motion.button
                key={script.resource}
                type="button"
                onClick={() => useStudio.setState({ activeResource: script.resource, activePage: null })}
                whileHover={{ y: -2, background: alpha(color, 0.12) }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.9vh',
                  padding: '1vh 1.4vh',
                  background: alpha(theme.colors.dark[9], 0.5),
                  border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.5)}`,
                  borderRadius: theme.radius.xs,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Icon name={script.icon} size="2vh" color={color} />
                <Flex direction="column" style={{ lineHeight: 1.25 }}>
                  <Text ff="Akrobat Bold" size="sm" c="rgba(255,255,255,0.9)">{script.label}</Text>
                  <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">
                    {script.resource} · v{script.version} · {script.entries.length} {t('home.stat.settings', 'settings')}
                  </Text>
                </Flex>
              </motion.button>
            ))}
          </Flex>
        </Flex>
      )}

      <Flex direction="column" gap="xs">
        <Text ff="Akrobat Bold" size="xs" tt="uppercase" lts="0.12em" c="rgba(255,255,255,0.35)">
          {t('home.how', 'How this works')}
        </Text>
        <Flex direction="column" gap="xxs">
          <Note icon={Save} title={t('home.note.save.title', 'Nothing saves until you press Save')}>
            {t('home.note.save.body', 'Edits are staged. The bar at the bottom counts them, Undo and Redo step through them, and Discard throws the lot away.')}
          </Note>
          <Note icon={History} title={t('home.note.overrides.title', 'Only what you changed is stored')}>
            {t('home.note.overrides.body', "A setting you never touch keeps following the script's own default, so improvements that ship in an update actually reach this server. Change history shows who changed what, and lets you put it back.")}
          </Note>
          <Note icon={Search} title={t('home.note.search.title', 'Search covers everything')}>
            {t('home.note.search.body', 'Names, descriptions, setting paths and list rows \u2014 across the whole script.')}
          </Note>
          <Note icon={ShieldCheck} title={t('home.note.serverOnly.title', 'Some settings never leave the server')}>
            {t('home.note.serverOnly.body', 'Tokens, webhooks and keys are marked SERVER ONLY. They are editable here and are never sent to players.')}
          </Note>
          <Note icon={BookOpen} title={t('home.note.invalid.title', 'Red means it will not save')}>
            {t('home.note.invalid.body', 'A setting outside its allowed range blocks saving and says why. Greyed-out settings are switched off by another setting, which is named on the row.')}
          </Note>
        </Flex>
      </Flex>
    </Flex>
  );
}

function Stat({
  icon: StatIcon, value, label, wide,
}: { icon: React.ElementType; value: string; label: string; wide?: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex
      align="center" gap="sm" px="lg" py="sm"
      style={{
        background: alpha(theme.colors.dark[9], 0.5),
        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}`,
        borderRadius: theme.radius.xs,
        minWidth: wide ? '32vh' : '20vh',
      }}
    >
      <StatIcon size="2.4vh" color={color} />
      <Flex direction="column" style={{ lineHeight: 1.15 }}>
        <Text ff="Akrobat Bold" size="lg" c="rgba(255,255,255,0.92)">{value}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.4)">{label}</Text>
      </Flex>
    </Flex>
  );
}

function Note({
  icon: NoteIcon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  const theme = useMantineTheme();

  return (
    <Flex
      align="flex-start" gap="sm" px="sm" py="xs"
      style={{
        background: alpha(theme.colors.dark[9], 0.35),
        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <NoteIcon size="1.7vh" color="rgba(255,255,255,0.4)" style={{ marginTop: '0.3vh', flexShrink: 0 }} />
      <Flex direction="column" style={{ lineHeight: 1.35 }}>
        <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)">{title}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.42)">{children}</Text>
      </Flex>
    </Flex>
  );
}
