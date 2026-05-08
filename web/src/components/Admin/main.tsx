import { ConfigPanel, locale, useNuiEvent } from "dirk-cfx-react";
import { Languages, Palette, Plug, ShieldCheck, Tag, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { defaultScriptConfig, type ScriptConfig } from "../../stores/useScriptConfig";
import AdvancedSection from "./AdvancedSection";
import AppearanceSection from "./AppearanceSection";
import BrandingSection from "./BrandingSection";
import BridgingSection from "./BridgingSection";
import GroupsSection from "./GroupsSection";
import LocalizationSection from "./LocalizationSection";
import ScriptConfigSection from "./ScriptConfigSection";

// NAV_ITEMS labels are resolved at module load via locale(...). Locale data
// is fetched on NUI mount, so the first call may return the key itself
// briefly — that's the same behaviour every locale-aware section uses.
const NAV_ITEMS = [
  { id: "appearance",   icon: Palette,     label: locale("dirk_lib_nav_appearance")    },
  { id: "branding",     icon: Tag,         label: locale("dirk_lib_nav_branding")      },
  { id: "localization", icon: Languages,   label: locale("dirk_lib_nav_localization")  },
  { id: "bridging",     icon: Plug,        label: locale("dirk_lib_nav_bridging")      },
  { id: "groups",       icon: Users,       label: locale("dirk_lib_nav_groups")        },
  { id: "scriptConfig", icon: ShieldCheck, label: locale("dirk_lib_nav_script_config") },
  { id: "advanced",     icon: Wrench,      label: locale("dirk_lib_nav_advanced")      },
] as const;

export default function AdminSection() {
  const [open, setOpen] = useState(false);

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
          {tab === "scriptConfig" && <ScriptConfigSection />}
          {tab === "advanced"     && <AdvancedSection />}
        </>
      )}
    </ConfigPanel>
  );
}
