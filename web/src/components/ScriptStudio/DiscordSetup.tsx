import { alpha, Flex, Text, useMantineTheme } from '@mantine/core';
import { fetchNui } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, ChevronDown, ExternalLink, Loader2, PlugZap, XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { effectiveValue, useStudio } from './store';
import { translate, useActiveLanguage, useBundles } from './studioLocale';
import { StudioButton } from './ui';

type Check = { id: string; ok: boolean; message: string };
type DiagnoseResult = { ok: boolean; checks: Check[] };

/**
 * The bit of the Discord section a schema walk cannot generate: a button that
 * proves the credentials work, and the six steps for getting them.
 *
 * A bot token is the one setting where "did I paste the right thing?" cannot be
 * answered by looking at it, so the old panel tested it against Discord and
 * reported per-check results. It also carried the walkthrough, because the
 * alternative is an admin alt-tabbing to find out what a Guild ID is.
 *
 * Rendered as an extra under the `discord` group rather than a setting of its
 * own - it belongs to the block, not to any one field.
 */
export function DiscordSetup({ resource, canEdit }: { resource: string; canEdit: boolean }) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // dirk_lib's own bundle - the panel's chrome, as opposed to a script's
  // setting labels, which come from that script.
  const language = useActiveLanguage();
  const bundles = useBundles();
  const t = (key: string, fallback: string) =>
    translate(bundles, language, 'dirk_lib', key, fallback);

  const entries = useStudio((state) => state.scripts.find((s) => s.resource === resource)?.entries ?? []);
  const draft = useStudio((state) => state.draft[resource]);

  const read = (path: string) => {
    const entry = entries.find((e) => e.path === path);
    if (!entry) return '';
    const value = effectiveValue(resource, entry);
    return typeof value === 'string' ? value : '';
  };

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      // Send what is TYPED, not what is saved. Testing the on-disk config meant
      // a fresh install always reported "fields empty" while the admin was
      // looking straight at the values they had just entered.
      const data = await fetchNui<DiagnoseResult>(
        'DISCORD_DIAGNOSE',
        { botToken: read('discord.botToken'), guildId: read('discord.guildId') },
        { ok: false, checks: [{ id: 'transport', ok: false, message: 'Browser preview — no server to ask' }] },
      );
      setResult(data);
    } finally {
      setTesting(false);
    }
  };

  const headerColor = result ? (result.ok ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.5)';
  const HeaderIcon = result ? (result.ok ? CheckCircle2 : XCircle) : PlugZap;

  return (
    <Flex direction="column" gap="xs" style={{ width: '100%' }}>
      {/* ── test ── */}
      <Flex
        direction="column" gap="xs"
        px="sm" py="xs"
        style={{
          background: alpha(theme.colors.dark[9], 0.45),
          border: `0.1vh solid ${alpha(result ? headerColor : theme.colors.dark[5], result ? 0.4 : 0.3)}`,
          borderRadius: theme.radius.xs,
        }}
      >
        <Flex align="center" gap="xs">
          <HeaderIcon size="1.8vh" color={headerColor} />
          <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.88)">Connection test</Text>
            <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.35)">
              {result
                ? (result.ok ? 'Everything checks out' : 'Something is not right')
                : 'Asks Discord whether these credentials actually work'}
            </Text>
          </Flex>
          {testing ? (
            <Flex align="center" gap="xs">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'flex' }}
              >
                <Loader2 size="1.5vh" color="rgba(255,255,255,0.5)" />
              </motion.div>
              <Text ff="Akrobat Bold" size="xxs" c="rgba(255,255,255,0.5)">Testing…</Text>
            </Flex>
          ) : (
            <StudioButton label="Test connection" onClick={runTest} disabled={!canEdit} />
          )}
        </Flex>

        <AnimatePresence initial={false}>
          {result && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              style={{ overflow: 'hidden' }}
            >
              <Flex direction="column" gap="0.3vh" pt="0.4vh">
                {result.checks.map((check) => (
                  <Flex key={check.id} align="center" gap="xs">
                    {check.ok
                      ? <CheckCircle2 size="1.3vh" color="#22c55e" />
                      : <XCircle size="1.3vh" color="#ef4444" />}
                    <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.35)" style={{ width: '10vh' }}>
                      {check.id}
                    </Text>
                    <Text ff="Akrobat SemiBold" size="xxs" c={check.ok ? 'rgba(255,255,255,0.7)' : '#ef4444'}>
                      {check.message}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>

      {/* ── guide ── */}
      <Flex
        direction="column"
        style={{
          background: alpha(theme.colors.dark[9], 0.35),
          border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
          borderRadius: theme.radius.xs,
        }}
      >
        <motion.button
          type="button"
          onClick={() => setGuideOpen((open) => !open)}
          whileHover={{ background: alpha(color, 0.05) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.7vh',
            padding: '0.7vh 0.9vh',
            background: 'transparent', border: 'none', borderRadius: 'inherit',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}
        >
          <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.8)" style={{ flex: 1 }}>
            {t('dirk_lib_discord_guide_toggle', 'How to create a bot')}
          </Text>
          <motion.div animate={{ rotate: guideOpen ? 180 : 0 }} style={{ display: 'flex' }}>
            <ChevronDown size="1.4vh" color="rgba(255,255,255,0.35)" />
          </motion.div>
        </motion.button>

        <AnimatePresence initial={false}>
          {guideOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <Flex
                direction="column" gap="xs" px="sm" pb="sm" pt="xxs"
                style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[5], 0.4)}` }}
              >
                {STEPS.map((step, index) => (
                  <Flex key={step.title} align="flex-start" gap="xs" pt="xs">
                    <Flex
                      align="center" justify="center"
                      w="2.2vh" h="2.2vh"
                      style={{
                        background: alpha(color, 0.14),
                        border: `0.1vh solid ${alpha(color, 0.4)}`,
                        borderRadius: '0.3vh',
                        flexShrink: 0,
                      }}
                    >
                      <Text ff="Akrobat Bold" size="xxs" c={color}>{index + 1}</Text>
                    </Flex>
                    <Flex direction="column" gap="0.1vh" style={{ flex: 1, minWidth: 0 }}>
                      <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.85)">
                        {t(`dirk_lib_discord_guide_${step.key}_title`, step.title)}
                      </Text>
                      <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.45)">
                        {t(`dirk_lib_discord_guide_${step.key}_body`, step.body)}
                      </Text>
                      {step.link && (
                        <Flex
                          component="a"
                          href={step.link.href}
                          target="_blank"
                          rel="noreferrer"
                          align="center" gap="0.4vh"
                          style={{ textDecoration: 'none', width: 'fit-content' }}
                        >
                          <ExternalLink size="1.1vh" color={color} />
                          <Text ff="Akrobat Bold" size="xxs" c={color}>
                            {t(`dirk_lib_discord_guide_${step.key}_link`, step.link.label)}
                          </Text>
                        </Flex>
                      )}
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>
    </Flex>
  );
}

/**
 * The setup guide, by locale key.
 *
 * These were carried over as hardcoded English, which quietly undid the one
 * thing they had going for them: dirk_lib already ships all fifteen of these
 * strings translated into every language it supports. The English here is the
 * fallback, not the source.
 */
const STEPS: { key: string; title: string; body: string; link?: { href: string; label: string } }[] = [
  {
    key: 'step1',
    title: 'Open the Developer Portal',
    body: 'Sign in with the Discord account that owns the server you want the bot to operate in.',
    link: { href: 'https://discord.com/developers/applications', label: 'Discord Developer Portal' },
  },
  {
    key: 'step2',
    title: 'Create a New Application',
    body: "Click 'New Application', give it a name (this becomes the bot's display name), and confirm.",
  },
  {
    key: 'step3',
    title: 'Grab the Bot Token',
    body: "Open the 'Bot' tab → click 'Reset Token' → copy the token and paste it into the Bot Token field above. The token is shown only once.",
  },
  {
    key: 'step4',
    title: 'Enable Server Members Intent',
    body: "Still on the Bot tab, scroll to 'Privileged Gateway Intents' and toggle 'Server Members Intent' on. Required for role / member lookups.",
  },
  {
    key: 'step5',
    title: 'Invite the Bot',
    body: "OAuth2 → URL Generator → tick 'bot' scope, leave permissions empty (read-only is fine), open the generated URL and add the bot to your server.",
  },
  {
    key: 'step6',
    title: 'Copy the Guild ID',
    body: "Enable Developer Mode in Discord (User Settings → Advanced), right-click your server icon → 'Copy Server ID' and paste into the Guild ID field above.",
  },
];
