import { BackgroundImage, MantineProvider } from '@mantine/core';
import '@mantine/dates/styles.css';
import React, { useEffect, useState } from "react";
import { useNuiEvent } from '../hooks/useNuiEvent';

import theme from '../theme';
import { isEnvBrowser } from '../utils/misc';

import { MantineEmotionProvider } from '@mantine/emotion';
import Menu from './Context/main';
import Dialog from './Dialog/main';
import Input from './Input/main';
import KeyInputs from './KeyInputs/main';
import Notifications from './Notify/main';
import Progress from './Progress/main';
import Quiz from './Quiz/main';
import StatusInfo from './StatusInfo/main';
import TestBed from './TestBed/main';
import TextUI from './TextUI/main';
import { useSettings } from '../stores/settings';
import { localeStore } from '../stores/locales';


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

  return (
    <MantineProvider theme={curTheme} defaultColorScheme='dark'>
      <MantineEmotionProvider>
          <Wrapper>
            {/* <Radial /> */}
            <TestBed />
            <Progress />
            <TextUI />
            <Notifications />
            <Menu />
            <Quiz />
            <Dialog />
            <Input />
            <KeyInputs />
            <StatusInfo />
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