import { ConfigPanel, useNuiEvent } from "dirk-cfx-react";
import { Languages, Palette, Plug, Tag, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { defaultScriptConfig, type ScriptConfig } from "../../stores/useScriptConfig";
import AdvancedSection from "./AdvancedSection";
import AppearanceSection from "./AppearanceSection";
import BrandingSection from "./BrandingSection";
import BridgingSection from "./BridgingSection";
import GroupsSection from "./GroupsSection";
import LocalizationSection from "./LocalizationSection";

const NAV_ITEMS = [
  { id: "appearance",   icon: Palette,   label: "Appearance"   },
  { id: "branding",     icon: Tag,       label: "Branding"     },
  { id: "localization", icon: Languages, label: "Localization" },
  { id: "bridging",     icon: Plug,      label: "Bridging"     },
  { id: "groups",       icon: Users,     label: "Groups"       },
  { id: "advanced",     icon: Wrench,    label: "Advanced"     },
] as const;

export default function AdminSection() {
  const [open, setOpen] = useState(false);

  useNuiEvent("OPEN_ADMIN_SECTION", () => setOpen(true));
  useNuiEvent("CLOSE_ADMIN_SECTION", () => setOpen(false));

  return (
    <ConfigPanel<ScriptConfig>
      navItems={NAV_ITEMS}
      title="DirkLib"
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
          {tab === "advanced"     && <AdvancedSection />}
        </>
      )}
    </ConfigPanel>
  );
}
