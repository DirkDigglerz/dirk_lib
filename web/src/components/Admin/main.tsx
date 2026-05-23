import { ConfigPanel, locale, useNuiEvent } from "dirk-cfx-react";
import { Languages, MessageCircle, Palette, Plug, ShieldCheck, Tag, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { defaultScriptConfig, type ScriptConfig } from "../../stores/useScriptConfig";
import AdvancedSection from "./AdvancedSection";
import AppearanceSection from "./AppearanceSection";
import BrandingSection from "./BrandingSection";
import BridgingSection from "./BridgingSection";
import DiscordSection from "./DiscordSection";
import GroupsSection from "./GroupsSection";
import LocalizationSection from "./LocalizationSection";
import ScriptConfigSection from "./ScriptConfigSection";

export default function AdminSection() {
  const [open, setOpen] = useState(false);

  // NAV_ITEMS lives inside the component so locale() is called on every
  // render — DirkProvider already subscribes to localeStore and re-renders
  // the tree when GET_LOCALES lands, so the labels resolve correctly as
  // soon as the dict is available. Defining at module scope froze the
  // labels to the keys themselves because import-time locale() runs
  // before any data has been fetched.
  const NAV_ITEMS = [
    { id: "appearance",   icon: Palette,        label: locale("dirk_lib_nav_appearance")    },
    { id: "branding",     icon: Tag,            label: locale("dirk_lib_nav_branding")      },
    { id: "localization", icon: Languages,      label: locale("dirk_lib_nav_localization")  },
    { id: "bridging",     icon: Plug,           label: locale("dirk_lib_nav_bridging")      },
    { id: "groups",       icon: Users,          label: locale("dirk_lib_nav_groups")        },
    { id: "discord",      icon: MessageCircle,  label: locale("dirk_lib_nav_discord")       },
    { id: "scriptConfig", icon: ShieldCheck,    label: locale("dirk_lib_nav_script_config") },
    { id: "advanced",     icon: Wrench,         label: locale("dirk_lib_nav_advanced")      },
  ] as const;

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
          {tab === "appearance"   && <AppearanceSection />}
          {tab === "branding"     && <BrandingSection />}
          {tab === "localization" && <LocalizationSection />}
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
