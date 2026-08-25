import { alpha, Flex, Text, TextInput, useMantineTheme } from '@mantine/core';
import { ConfirmModal, Modal } from 'dirk-cfx-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, Eye, Lock, Pencil, Search, Shield, ShieldCheck, Trash2, UserPlus, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  MOCK_ACE_GRANTS, MOCK_ADMINS, MOCK_ONLINE,
  type AceGrant, type AceGrantLevel, type AdminEntry, type AdminLevel, type OnlinePlayer,
} from './mockAdmins';
import { useStudio } from './store';
import { StudioButton } from './ui';
import { useChrome } from './studioLocale';

/**
 * Who can open Script Studio, and what they may touch.
 *
 * Access arrives from three places and they are shown separately on purpose:
 * ACE groups come from server.cfg, the config-file list is the route back in
 * when the database is wrong (so it cannot be revoked here), and everything
 * else is managed on this page.
 */
export function AdminsPage({ canEdit }: { canEdit: boolean }) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const scripts = useStudio((s) => s.scripts);

  const [admins, setAdmins] = useState<AdminEntry[]>(MOCK_ADMINS);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminEntry | null>(null);
  const [revoking, setRevoking] = useState<AdminEntry | null>(null);

  const grouped = useMemo(() => ({
    config: admins.filter((a) => a.source === 'config'),
    panel: admins.filter((a) => a.source === 'panel'),
  }), [admins]);

  const save = (entry: AdminEntry) => {
    setAdmins((prev) => (prev.some((a) => a.id === entry.id)
      ? prev.map((a) => (a.id === entry.id ? entry : a))
      : [...prev, entry]));
    setEditing(null);
    setAdding(false);
  };

  return (
    <Flex
      direction="column" gap="lg" p="md"
      className="studio-scroll"
      style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
    >
      <AceBlock canEdit={canEdit} />

      {/* the route back in */}
      <Block
        icon={Lock}
        title={t('adminsPage.config_file', 'Config file')}
        description="Server-side, survives updates, cannot be revoked from this panel"
      >
        <Flex direction="column" gap="xxs">
          {grouped.config.map((entry) => (
            <AdminRow key={entry.id} entry={entry} scripts={scripts.length} locked />
          ))}
        </Flex>
      </Block>

      {/* the day-to-day list */}
      <Block
        icon={Users}
        title={t('adminsPage.panel_admins', 'Panel admins')}
        description="Added here, stored in the database"
        action={canEdit && (
          <StudioButton label={t('adminsPage.add_admin', 'Add admin')} icon={UserPlus} primary onClick={() => setAdding(true)} />
        )}
      >
        <Flex direction="column" gap="xxs">
          {grouped.panel.map((entry) => (
            <AdminRow
              key={entry.id}
              entry={entry}
              scripts={scripts.length}
              canEdit={canEdit}
              onEdit={() => setEditing(entry)}
              onRevoke={() => setRevoking(entry)}
            />
          ))}
          {grouped.panel.length === 0 && (
            <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.3)">
              {t('adminsPage.nobody_has_been_added_here_yet', 'Nobody has been added here yet.')}
            </Text>
          )}
        </Flex>
      </Block>

      <AnimatePresence>
        {(adding || editing) && (
          <AdminModal
            entry={editing}
            onSave={save}
            onClose={() => { setAdding(false); setEditing(null); }}
          />
        )}
        {revoking && (
          <ConfirmModal
            title={t('adminsPage.revoke_access', 'Revoke access')}
            description={`${revoking.name} loses access to Script Studio immediately. Anything they already saved stays.`}
            confirmLabel="Revoke"
            onConfirm={() => {
              setAdmins((prev) => prev.filter((a) => a.id !== revoking.id));
              setRevoking(null);
            }}
            onClose={() => setRevoking(null)}
            zIndex={10200}
          />
        )}
      </AnimatePresence>
    </Flex>
  );
}

/**
 * ACE access, reported honestly.
 *
 * We cannot read server.cfg - a resource only reads its own folder, and exec'd
 * files can be anywhere - and FiveM has no native to list principals. So this
 * shows the objects we gate on, and TESTS named principals against them with
 * IsPrincipalAceAllowed. Anything granted anywhere still works at login; this
 * list is about telling you which of your groups currently pass.
 */
const LEVELS: { value: AceGrantLevel; label: string; icon?: React.ElementType; color?: string }[] = [
  { value: 'edit', label: 'Can edit', icon: ShieldCheck },
  { value: 'view', label: 'View only', icon: Eye, color: '#4CC3DE' },
  { value: 'none', label: 'No access' },
];

/**
 * Which ACE groups get which level - stored by dirk_lib, so it persists across
 * restarts without writing ACEs or editing anyone's server.cfg. A group granted
 * directly in cfg still works and shows here locked, because we can see it but
 * cannot take it away.
 */
function AceBlock({ canEdit }: { canEdit: boolean }) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const [grants, setGrants] = useState<AceGrant[]>(MOCK_ACE_GRANTS);
  const [adding, setAdding] = useState('');

  const setLevel = (principal: string, level: AceGrantLevel) =>
    setGrants((prev) => prev.map((g) => (g.principal === principal ? { ...g, level } : g)));

  const add = () => {
    const principal = adding.trim();
    if (!principal || grants.some((g) => g.principal === principal)) return;
    setGrants((prev) => [...prev, { principal, level: 'view', addedBy: 'Dirk' }]);
    setAdding('');
  };

  const remove = (principal: string) =>
    setGrants((prev) => prev.filter((g) => g.principal !== principal));

  return (
    <Block
      icon={Shield}
      title={t('adminsPage.ace_groups', 'ACE groups')}
      description="Stored here and re-applied on every start — no server.cfg edits"
    >
      <Flex direction="column" gap="xxs">
        {grants.map((grant) => {
          const none = grant.level === 'none';
          return (
            <Flex
              key={grant.principal}
              align="center" gap="sm" px="sm" py="0.7vh"
              style={{
                background: alpha(theme.colors.dark[8], none ? 0.3 : 0.5),
                border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.3)}`,
                borderRadius: theme.radius.xs,
              }}
            >
              {grant.fromCfg && <Lock size="1.3vh" color="rgba(255,255,255,0.4)" />}

              <Text
                ff="monospace" size="xs"
                c={none ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}
                style={{ minWidth: '20vh' }}
              >
                {grant.principal}
              </Text>

              {grant.fromCfg ? (
                <Flex align="center" gap="xs" style={{ flex: 1 }}>
                  <Pill icon={ShieldCheck} label={t('adminsPage.can_edit', 'Can edit')} color={color} />
                  <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
                    granted in server.cfg — cannot be changed here
                  </Text>
                </Flex>
              ) : (
                <Flex align="center" gap="xxs" style={{ flex: 1 }}>
                  {LEVELS.map((level) => {
                    const on = grant.level === level.value;
                    const tint = level.color ?? color;
                    return (
                      <motion.button
                        key={level.value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setLevel(grant.principal, level.value)}
                        whileTap={canEdit ? { scale: 0.97 } : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4vh',
                          padding: '0.35vh 0.8vh',
                          background: on ? alpha(tint, 0.16) : 'transparent',
                          border: `0.1vh solid ${on ? alpha(tint, 0.5) : alpha(theme.colors.dark[4], 0.45)}`,
                          borderRadius: theme.radius.xs,
                          cursor: canEdit ? 'pointer' : 'not-allowed',
                          opacity: canEdit ? 1 : 0.5,
                        }}
                      >
                        {level.icon && <level.icon size="1.1vh" color={on ? tint : 'rgba(255,255,255,0.35)'} />}
                        <Text
                          ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em"
                          c={on ? tint : 'rgba(255,255,255,0.45)'}
                        >
                          {level.label}
                        </Text>
                      </motion.button>
                    );
                  })}
                </Flex>
              )}

              {grant.addedBy && !grant.fromCfg && (
                <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)" style={{ flexShrink: 0 }}>
                  added by {grant.addedBy}
                </Text>
              )}

              {!grant.fromCfg && canEdit && (
                <RowButton icon={Trash2} label={t('adminsPage.remove', 'Remove')} danger onClick={() => remove(grant.principal)} />
              )}
            </Flex>
          );
        })}

        {canEdit && (
          <Flex gap="xs" align="center" pt="xxs">
            <TextInput
              value={adding}
              onChange={(e) => setAdding(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder={t('adminsPage.add_a_group_e_g_group_headadmin', 'Add a group, e.g. group.headadmin')}
              styles={inputStyles(theme, true)}
              style={{ flex: 1, maxWidth: '44vh' }}
            />
            <StudioButton label={t('adminsPage.add_group', 'Add group')} onClick={add} />
            <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">
              {t('adminsPage.fivem_cannot_list_groups_so_they_are_add', 'FiveM cannot list groups, so they are added by name.')}
            </Text>
          </Flex>
        )}
      </Flex>
    </Block>
  );
}

function Block({
  icon: Icon, title, description, action, children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <Flex direction="column" gap="xs">
      <Flex align="center" gap="xs">
        <Icon size="1.9vh" color={color} />
        <Text ff="Akrobat Bold" size="md" c="rgba(255,255,255,0.92)">{title}</Text>
        <Text ff="Akrobat SemiBold" size="xs" c="rgba(255,255,255,0.35)" style={{ flex: 1 }}>
          {description}
        </Text>
        {action}
      </Flex>
      {children}
    </Flex>
  );
}

function AdminRow({
  entry, scripts, locked, canEdit, onEdit, onRevoke,
}: {
  entry: AdminEntry;
  scripts: number;
  locked?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onRevoke?: () => void;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const editLevel = entry.level === 'edit';

  return (
    <Flex
      align="center" gap="sm" px="sm" py="xs"
      style={{
        background: alpha(theme.colors.dark[8], 0.5),
        border: `0.1vh solid ${alpha(theme.colors.dark[5], 0.35)}`,
        borderRadius: theme.radius.xs,
      }}
    >
      <Flex
        align="center" justify="center" w="3.4vh" h="3.4vh"
        style={{
          background: alpha(entry.online ? color : theme.colors.dark[6], entry.online ? 0.14 : 0.5),
          border: `0.1vh solid ${alpha(entry.online ? color : theme.colors.dark[4], entry.online ? 0.4 : 0.4)}`,
          borderRadius: theme.radius.xs, flexShrink: 0,
        }}
      >
        {locked ? <Lock size="1.5vh" color="rgba(255,255,255,0.5)" />
          : <Users size="1.5vh" color={entry.online ? color : 'rgba(255,255,255,0.4)'} />}
      </Flex>

      <Flex direction="column" style={{ minWidth: '18vh', lineHeight: 1.2 }}>
        <Flex align="center" gap="xs">
          <Text ff="Akrobat Bold" size="xs" c="rgba(255,255,255,0.9)">{entry.name}</Text>
          {entry.online && (
            <Flex w="0.6vh" h="0.6vh" style={{ background: color, borderRadius: '50%' }} />
          )}
        </Flex>
        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)">{entry.identifier}</Text>
      </Flex>

      <Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
        <Pill
          icon={editLevel ? ShieldCheck : Eye}
          label={editLevel ? 'Can edit' : 'View only'}
          color={editLevel ? color : '#4CC3DE'}
        />
        <Pill
          label={entry.scripts.length === 0 ? `All ${scripts} scripts` : entry.scripts.join(', ')}
          color="rgba(255,255,255,0.45)"
          muted
        />
      </Flex>

      {entry.addedBy && (
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)" style={{ flexShrink: 0 }}>
          {locked ? entry.addedBy : `added by ${entry.addedBy}${entry.addedAt ? ` · ${entry.addedAt}` : ''}`}
        </Text>
      )}

      {!locked && canEdit && (
        <Flex align="center" gap="xxs" style={{ flexShrink: 0 }}>
          <RowButton icon={Pencil} label={t('adminsPage.edit_access', 'Edit access')} onClick={onEdit} />
          <RowButton icon={Trash2} label={t('adminsPage.revoke', 'Revoke')} danger onClick={onRevoke} />
        </Flex>
      )}
    </Flex>
  );
}

function Pill({
  icon: Icon, label, color, muted,
}: { icon?: React.ElementType; label: string; color: string; muted?: boolean }) {
  return (
    <Flex
      align="center" gap="0.4vh" px="0.7vh" py="0.15vh"
      style={{
        background: muted ? 'transparent' : alpha(color, 0.12),
        border: `0.1vh solid ${muted ? alpha('#ffffff', 0.12) : alpha(color, 0.35)}`,
        borderRadius: '0.3vh',
        flexShrink: 0,
        maxWidth: '30vh',
      }}
    >
      {Icon && <Icon size="1.1vh" color={color} />}
      <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em" c={color} truncate>{label}</Text>
    </Flex>
  );
}

function RowButton({
  icon: Icon, label, onClick, danger,
}: { icon: React.ElementType; label: string; onClick?: () => void; danger?: boolean }) {
  const theme = useMantineTheme();
  const accent = danger ? '#ef4444' : theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ background: alpha(accent, 0.16), borderColor: alpha(accent, 0.5) }}
      whileTap={{ scale: 0.94 }}
      style={{
        aspectRatio: '1 / 1', height: '2.8vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
        borderRadius: theme.radius.xs,
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.55)',
      }}
      aria-label={label}
    >
      <Icon size="1.4vh" />
    </motion.button>
  );
}

/** Add or edit: pick the person, then what they may do and where. */
function AdminModal({
  entry, onSave, onClose,
}: {
  entry: AdminEntry | null;
  onSave: (next: AdminEntry) => void;
  onClose: () => void;
}) {
  const t = useChrome();
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];
  const scripts = useStudio((s) => s.scripts);

  const [name, setName] = useState(entry?.name ?? '');
  const [identifier, setIdentifier] = useState(entry?.identifier ?? '');
  const [level, setLevel] = useState<AdminLevel>(entry?.level ?? 'edit');
  const [scope, setScope] = useState<string[]>(entry?.scripts ?? []);
  const [query, setQuery] = useState('');

  const players = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MOCK_ONLINE.filter((p) =>
      !needle || p.name.toLowerCase().includes(needle) || p.identifier.includes(needle));
  }, [query]);

  const pick = (player: OnlinePlayer) => {
    setName(player.name);
    setIdentifier(player.identifier);
  };

  const toggleScript = (resource: string) => {
    setScope((prev) => (prev.includes(resource)
      ? prev.filter((r) => r !== resource)
      : [...prev, resource]));
  };

  const valid = identifier.trim().length > 6;

  return (
    <Modal
      title={entry ? `Edit ${entry.name}` : 'Add admin'}
      icon={UserPlus}
      iconColor={color}
      description="Access to Script Studio"
      onClose={onClose}
      width="86vh"
      height="72vh"
      zIndex={10100}
    >
      <Flex direction="column" flex={1} style={{ minHeight: 0 }}>
        <Flex flex={1} style={{ minHeight: 0 }}>
          {/* who */}
          {!entry && (
            <Flex
              direction="column" w="34vh"
              style={{ borderRight: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0, minHeight: 0 }}
            >
              <Flex p="xs" style={{ flexShrink: 0 }}>
                <TextInput
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  placeholder={t('adminsPage.search_online_players', 'Search online players')}
                  leftSection={<Search size="1.4vh" color="rgba(255,255,255,0.35)" />}
                  styles={inputStyles(theme)}
                  style={{ width: '100%' }}
                />
              </Flex>
              <Flex direction="column" gap="xxs" px="xs" className="studio-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {players.map((player) => {
                  const chosen = player.identifier === identifier;
                  return (
                    <motion.button
                      key={player.source}
                      type="button"
                      onClick={() => pick(player)}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.8vh',
                        padding: '0.6vh 0.8vh',
                        background: chosen ? alpha(color, 0.14) : alpha(theme.colors.dark[8], 0.4),
                        border: `0.1vh solid ${chosen ? alpha(color, 0.45) : 'transparent'}`,
                        borderRadius: theme.radius.xs,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <Flex direction="column" style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                        <Text ff="Akrobat Bold" size="xs" c={chosen ? color : 'rgba(255,255,255,0.85)'} truncate>
                          {player.name}
                        </Text>
                        <Text ff="monospace" size="xxs" c="rgba(255,255,255,0.3)" truncate>
                          {player.identifier}
                        </Text>
                      </Flex>
                      {player.existing && (
                        <Pill label={player.existing === 'config' ? 'in config' : 'has access'} color="rgba(255,255,255,0.4)" muted />
                      )}
                      {chosen && <Check size="1.4vh" color={color} />}
                    </motion.button>
                  );
                })}
              </Flex>
            </Flex>
          )}

          {/* what */}
          <Flex direction="column" gap="sm" p="sm" flex={1} className="studio-scroll" style={{ overflowY: 'auto', minHeight: 0 }}>
            <Field label={t('adminsPage.name', 'Name')}>
              <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)}
                placeholder={t('adminsPage.shown_in_logs', 'Shown in logs')} styles={inputStyles(theme)} style={{ width: '100%' }} />
            </Field>

            <Field label={t('adminsPage.identifier', 'Identifier')} hint="Server-side only — never sent to a regular player">
              <TextInput value={identifier} onChange={(e) => setIdentifier(e.currentTarget.value)}
                placeholder={t('adminsPage.license2', 'license2:...')} styles={inputStyles(theme, true)} style={{ width: '100%' }} />
            </Field>

            <Field label={t('adminsPage.level', 'Level')}>
              <Flex gap="xs">
                <Choice active={level === 'edit'} icon={ShieldCheck} label={t('adminsPage.can_edit', 'Can edit')}
                  description="Change and save settings" onClick={() => setLevel('edit')} />
                <Choice active={level === 'view'} icon={Eye} label={t('adminsPage.view_only', 'View only')}
                  description="Open the panel, change nothing" onClick={() => setLevel('view')} />
              </Flex>
            </Field>

            <Field label={t('adminsPage.scope', 'Scope')} hint="Which scripts they may configure">
              <Flex direction="column" gap="xxs">
                <Choice
                  active={scope.length === 0}
                  icon={Shield}
                  label={t('adminsPage.every_script', 'Every script')}
                  description="Including scripts installed later"
                  onClick={() => setScope([])}
                  wide
                />
                <Flex gap="xxs" wrap="wrap">
                  {scripts.map((script) => {
                    const on = scope.includes(script.resource);
                    return (
                      <motion.button
                        key={script.resource}
                        type="button"
                        onClick={() => toggleScript(script.resource)}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5vh',
                          padding: '0.5vh 0.9vh',
                          background: on ? alpha(color, 0.16) : 'transparent',
                          border: `0.1vh solid ${on ? alpha(color, 0.5) : alpha(theme.colors.dark[4], 0.5)}`,
                          borderRadius: theme.radius.xs,
                          cursor: 'pointer',
                        }}
                      >
                        {on && <Check size="1.2vh" color={color} />}
                        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.05em"
                          c={on ? color : 'rgba(255,255,255,0.6)'}>
                          {script.label}
                        </Text>
                      </motion.button>
                    );
                  })}
                </Flex>
              </Flex>
            </Field>
          </Flex>
        </Flex>

        <Flex
          align="center" justify="space-between" px="sm" py="xs"
          style={{ borderTop: `0.1vh solid ${alpha(theme.colors.dark[4], 0.4)}`, flexShrink: 0 }}
        >
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.3)">
            {t('adminsPage.granting_access_is_logged_like_any_other', 'Granting access is logged, like any other change.')}
          </Text>
          <Flex gap="xs">
            <StudioButton label={t('adminsPage.cancel', 'Cancel')} onClick={onClose} />
            <StudioButton
              label={entry ? 'Save access' : 'Grant access'}
              primary
              disabled={!valid}
              onClick={() => onSave({
                id: entry?.id ?? `db-${Date.now()}`,
                name: name || 'Unnamed',
                identifier: identifier.trim(),
                source: 'panel',
                level,
                scripts: scope,
                addedBy: 'Dirk',
                addedAt: '2026-08-19',
                online: MOCK_ONLINE.some((p) => p.identifier === identifier),
              })}
            />
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Flex direction="column" gap="0.4vh">
      <Flex align="baseline" gap="xs">
        <Text ff="Akrobat Bold" size="xxs" tt="uppercase" lts="0.1em" c="rgba(255,255,255,0.4)">
          {label}
        </Text>
        {hint && (
          <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.28)">{hint}</Text>
        )}
      </Flex>
      {children}
    </Flex>
  );
}

function Choice({
  active, icon: Icon, label, description, onClick, wide,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  wide?: boolean;
}) {
  const theme = useMantineTheme();
  const color = theme.colors[theme.primaryColor][5];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.8vh',
        flex: wide ? undefined : 1,
        width: wide ? '100%' : undefined,
        padding: '0.7vh 1vh',
        background: active ? alpha(color, 0.14) : alpha(theme.colors.dark[8], 0.4),
        border: `0.1vh solid ${active ? alpha(color, 0.5) : alpha(theme.colors.dark[5], 0.35)}`,
        borderRadius: theme.radius.xs,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <Icon size="1.6vh" color={active ? color : 'rgba(255,255,255,0.4)'} />
      <Flex direction="column" style={{ lineHeight: 1.15 }}>
        <Text ff="Akrobat Bold" size="xs" c={active ? color : 'rgba(255,255,255,0.85)'}>{label}</Text>
        <Text ff="Akrobat SemiBold" size="xxs" c="rgba(255,255,255,0.35)">{description}</Text>
      </Flex>
    </motion.button>
  );
}

function inputStyles(theme: ReturnType<typeof useMantineTheme>, mono = false) {
  return {
    input: {
      background: alpha(theme.colors.dark[9], 0.75),
      border: `0.1vh solid ${alpha(theme.colors.dark[4], 0.55)}`,
      color: 'rgba(255,255,255,0.9)',
      fontFamily: mono ? 'monospace' : 'Akrobat SemiBold',
      fontSize: '1.45vh',
      height: '3.4vh',
      minHeight: '3.4vh',
      borderRadius: theme.radius.xs,
    },
    section: { width: '2.6vh' },
  };
}
