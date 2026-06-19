import { ConfigPanel, locale, localeStore, useNuiEvent } from "dirk-cfx-react";
import { MessageCircle, Palette, Plug, ShieldCheck, SlidersHorizontal, Users, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultScriptConfig, type ScriptConfig } from "../../stores/useScriptConfig";
import AdvancedSection from "./AdvancedSection";
import AppearanceSection from "./AppearanceSection";
import BasicSection from "./BasicSection";
import BridgingSection from "./BridgingSection";
import DiscordSection from "./DiscordSection";
import GroupsSection from "./GroupsSection";
import ScriptConfigSection from "./ScriptConfigSection";

export default function AdminSection() {
  const [open, setOpen] = useState(false);

  // Subscribe to the locale dict so the left-nav labels refresh LIVE when an
  // admin switches language. locale() reads the latest dict but does NOT
  // subscribe a component on its own, so NAV_ITEMS is memoised against the
  // locales object — when the dict changes (GET_LOCALES on load, or the
  // UPDATE_DIRK_LIB_LOCALES broadcast on a live language switch) the labels
  // re-resolve without needing a resource restart. (The panels already
  // refreshed because they re-render off the settings store; the nav didn't.)
  const locales = localeStore((s) => s.locales);
  const NAV_ITEMS = useMemo(() => [
    { id: "basic",        icon: SlidersHorizontal, label: locale("dirk_lib_nav_basic")       },
    { id: "appearance",   icon: Palette,        label: locale("dirk_lib_nav_appearance")    },
    { id: "bridging",     icon: Plug,           label: locale("dirk_lib_nav_bridging")      },
    { id: "groups",       icon: Users,          label: locale("dirk_lib_nav_groups")        },
    { id: "discord",      icon: MessageCircle,  label: locale("dirk_lib_nav_discord")       },
    { id: "scriptConfig", icon: ShieldCheck,    label: locale("dirk_lib_nav_script_config") },
    { id: "advanced",     icon: Wrench,         label: locale("dirk_lib_nav_advanced")      },
  ] as const, [locales]);

  useNuiEvent("OPEN_ADMIN_SECTION", () => setOpen(true));
  useNuiEvent("CLOSE_ADMIN_SECTION", () => setOpen(false));

  return (
    <ConfigPanel<ScriptConfig>
      navItems={NAV_ITEMS}
      title={locale("dirk_lib_panel_title")}
      open={open}
      defaultConfig={defaultScriptConfig}
      resetConfirmText="dirk_lib"
    >
      {(tab) => (
        <>
          {tab === "basic"        && <BasicSection />}
          {tab === "appearance"   && <AppearanceSection />}
          {tab === "bridging"     && <BridgingSection />}
          {tab === "groups"       && <GroupsSection />}
          {tab === "discord"      && <DiscordSection />}
          {tab === "scriptConfig" && <ScriptConfigSection />}
          {tab === "advanced"     && <AdvancedSection />}
        </>
      )}
    </ConfigPanel>
  );
}
