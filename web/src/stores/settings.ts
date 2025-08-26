import { MantineColor, MantineColorShade, MantineColorsTuple } from "@mantine/core";
import { create } from "zustand";
import { fetchNui } from "../utils/fetchNui";
import { isEnvBrowser } from "../utils/misc";

export type SettingsProps = {
  primaryColor: MantineColor;
  primaryShade: MantineColorShade;
  customTheme: MantineColorsTuple;
  itemImgPath: string;
  fetchSettings: () => void;
  // Add more settings here
};

export const useSettings = create<SettingsProps>((set) => ({
  primaryColor:'custom', 
  primaryShade: 9,
  itemImgPath: 'nui://dirk_inventory/web/images/',
  customTheme: [
    "#deffff",
    "#caffff",
    "#99ffff",
    "#72ffff",
    "#3dffff",
    "#26ffff",
    "#09ffff",
    "#00e3e3",
    "#00cacb",
    "#00afb0"
  ],

  fetchSettings: () => {
    if (!isEnvBrowser()) {
      fetchNui<{
        primaryColor: string;
        primaryShade: MantineColorShade;
        customTheme: MantineColorsTuple;
      }>('GET_SETTINGS')
        .then((data) => {
          // Ensure data is of type SettingsProps
          if (data.primaryColor && data.primaryShade && data.customTheme) {
            set({
              primaryColor: data.primaryColor,
              primaryShade: data.primaryShade,
              customTheme: data.customTheme
            });
          } else {
            console.error('SettingsProvider: Invalid settings data received from NUI:', data);
          }
        }) 
        .catch((error) => {
          console.error('Failed to fetch settings:', error);
        });
    } else {
      console.warn('SettingsProvider: Not fetching settings from NUI');
    }
  }, 
  
  
  // Add more default settings here
}));