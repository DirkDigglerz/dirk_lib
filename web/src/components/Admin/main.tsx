import { ConfigPanel, useNuiEvent } from "dirk-cfx-react";
import { Languages, Palette } from "lucide-react";
import { useState } from "react";
import { defaultScriptConfig, type ScriptConfig } from "../../stores/useScriptConfig";
import AppearanceSection from "./AppearanceSection";
import LocalizationSection from "./LocalizationSection";

const NAV_ITEMS = [
  { id: "appearance",   icon: Palette,   label: "Appearance"   },
  { id: "localization", icon: Languages, label: "Localization" },
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
          {tab === "localization" && <LocalizationSection />}
        </>
      )}
    </ConfigPanel>
  );
}
