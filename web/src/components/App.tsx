import { Flex } from '@mantine/core';
import '@mantine/dates/styles.css';
import { DirkProvider } from 'dirk-cfx-react';
import { motion } from 'framer-motion';
import React, { useEffect } from "react";
import { useNuiEvent } from '../hooks/useNuiEvent';
import { localeStore } from '../stores/locales';
import { fetchNui } from '../utils/fetchNui';
import { imageUrlToBase64 } from '../utils/misc';
import AlertDialog from './AlertDialog/main';
import Menu from './Context/main';
import Dialog from './Dialog/main';
import GizmoOverlay from './Gizmo/main';
import Input from './Input/main';
import KeyInputs from './KeyInputs/main';
import Notifications from './Notify/main';
import ProgressBar from './Progress/main';
import Quiz from './Quiz/main';
import ScriptConfigChooser from './ScriptConfigChooser/main';
import StatusInfo from './StatusInfo/main';
import TestBed from './TestBed/main';
import TextUI from './TextUI/main';


// @ts-expect-error - This is a web component, it doesn't exist in the types
export const MotionFlex = motion.create(Flex);

const App: React.FC = () => {
  const fetchLocales = localeStore((state) => state.fetchLocales);

  useEffect(() => {
    fetchLocales();
  }, [fetchLocales]);

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
    <DirkProvider>
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
      <ScriptConfigChooser />
    </DirkProvider>
  );
};

export default App;
