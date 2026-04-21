import { useEffect, useState } from "react";
import { TestBed as SharedTestBed, type TestBedItem, useNuiEvent } from "dirk-cfx-react";
import { isEnvBrowser } from "../../utils/misc";
import { internalEvent } from "../../utils/internalEvent";
import { fetchNui } from "../../utils/fetchNui";
import { defaultTestItems } from "./testItems";

export default function TestBed() {
  const [testMode, setTestMode] = useState(isEnvBrowser());
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});

  useNuiEvent("OPEN_TEST_UI", () => {
    setTestMode((v) => !v);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && testMode) {
        defaultTestItems.forEach((item) => {
          if (activeKeys[item.index]) {
            internalEvent([{ action: item.onDisable.action, data: item.onDisable.data }]);
          }
        });
        setActiveKeys({});
        setTestMode(false);
        fetchNui("CLOSED_TEST_UI", {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [testMode, activeKeys]);

  if (!testMode) return null;

  const items: TestBedItem[] = defaultTestItems.map((item) => ({
    key: item.index,
    label: item.label,
    active: !!activeKeys[item.index],
    onToggle: (next) => {
      const event = next ? item.onEnable : item.onDisable;
      internalEvent([{ action: event.action, data: event.data }]);
      setActiveKeys((prev) => ({ ...prev, [item.index]: next }));
    },
  }));

  return <SharedTestBed items={items} disablePersistence />;
}
