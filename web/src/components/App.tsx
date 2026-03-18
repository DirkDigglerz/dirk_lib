import { BackgroundImage, Flex, MantineProvider } from '@mantine/core';
import '@mantine/dates/styles.css';
import React, { useEffect, useState } from "react";
import { useNuiEvent } from '../hooks/useNuiEvent';

import theme from '../theme';
import { imageUrlToBase64, isEnvBrowser } from '../utils/misc';

import { MantineEmotionProvider } from '@mantine/emotion';
import { motion } from 'framer-motion';
import { localeStore } from '../stores/locales';
import { useSettings } from '../stores/settings';
import { fetchNui } from '../utils/fetchNui';
import Menu from './Context/main';
import Dialog from './Dialog/main';
import Input from './Input/main';
import KeyInputs from './KeyInputs/main';
import Notifications from './Notify/main';
import ProgressBar from './Progress/main';
import Quiz from './Quiz/main';
import StatusInfo from './StatusInfo/main';
import TestBed from './TestBed/main';
import TextUI from './TextUI/main';
import GizmoOverlay from './Gizmo/main';
import AlertDialog from './AlertDialog/main';


// @ts-expect-error - This is a web component, it doesn't exist in the types
export const MotionFlex = motion.create(Flex);

const App: React.FC = () => {
  const [curTheme, setCurTheme] = useState(theme);
  const primaryColor = useSettings((data) => data.primaryColor);
  const primaryShade = useSettings((data) => data.primaryShade);
  const customTheme = useSettings((data) => data.customTheme);
  const fetchSettings = useSettings((state) => state.fetchSettings);
  const fetchLocales  = localeStore((state) => state.fetchLocales);
  
  // Ensure the theme is updated when the settings change

  useEffect(() => {
    const updatedTheme = {
      ...theme, // Start with the existing theme object
      colors: {
        ...theme.colors, // Copy the existing colors
        custom: customTheme
      },
    };
    
    setCurTheme(updatedTheme);
    // set primary color
    setCurTheme({
      ...updatedTheme,
      primaryColor: primaryColor,
      primaryShade: primaryShade,
    });

  }, [primaryColor, primaryShade, customTheme]);

  useEffect(() => {
    fetchSettings();
    fetchLocales();
  }, [fetchSettings, fetchLocales]);

  
  useNuiEvent('COPY_TO_CLIPBOARD', (data: string) => {
    const el = document.createElement('textarea');
    el.value = data;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });


  useNuiEvent('OPEN_LINK', (data: string) => {
    // @ts-expect-error There is no such thing as invokeNative outside FiveM
    window.invokeNative("openUrl", data);
  });

  useNuiEvent<string>('IMAGE_TO_BASE64', (url) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = async () => {
      const base64 = await imageUrlToBase64(img.src);
      fetchNui('IMAGE_TO_BASE64_RESULT', { url, base64 });
    };
  });
  
  return (
    <MantineProvider theme={curTheme} defaultColorScheme='dark'>
      <MantineEmotionProvider>
          <Wrapper>
            {/* <Radial /> */}
            <TestBed />
            <ProgressBar />
            <TextUI />
            <Notifications />
            <Menu />
            <Quiz />
            <Dialog />
            <Input />
            <KeyInputs />
            <StatusInfo />
            <GizmoOverlay />
            <AlertDialog />
          </Wrapper>
      </MantineEmotionProvider>
    </MantineProvider>
  );
};

export default App;


function Wrapper({ children }: { children: React.ReactNode }) {
  return isEnvBrowser() ? ( 
    <BackgroundImage w='100vw' h='100vh' style={{overflow:'hidden'}}
      src="https://i.ytimg.com/vi/TOxuNbXrO28/maxresdefault.jpg"
    >  
      {children}
    </BackgroundImage>
  ) : (
    <>{children}</>
  )
}