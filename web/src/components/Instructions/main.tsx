// Instructions overlay. Listens for the SendNuiMessage actions emitted by
// `lib.showInstructions` / `lib.hideInstructions` (Lua side: see
// src/ui/client/showInstructions.lua) and renders the cfx-react
// InstructionPanel in dirk_lib's always-loaded NUI.
//
// Lets any resource — UI or not — drive the bottom-right "do this in-world"
// card without needing its own React tree.
import { useState } from 'react';
import { InstructionPanel, type InstructionKey } from 'dirk-cfx-react';
import { useNuiEvent } from '../../hooks/useNuiEvent';

type InstructionSpec = {
  title: string;
  hint?: string;
  keys?: InstructionKey[];
};

const Instructions: React.FC = () => {
  const [spec, setSpec] = useState<InstructionSpec | null>(null);

  useNuiEvent<InstructionSpec>('DIRK_LIB_SHOW_INSTRUCTIONS', (data) => {
    if (!data || typeof data.title !== 'string') return;
    setSpec({ title: data.title, hint: data.hint, keys: data.keys });
  });

  useNuiEvent('DIRK_LIB_HIDE_INSTRUCTIONS', () => {
    setSpec(null);
  });

  return (
    <InstructionPanel
      visible={!!spec}
      title={spec?.title ?? ''}
      hint={spec?.hint}
      keys={spec?.keys}
      // Don't hide the rest of dirk_lib's NUI — the admin panel etc. should
      // stay visible if it's open. Caller-side concerns (releasing NUI focus,
      // hiding other UIs) are not this overlay's job.
      hideRestOfAdmin={false}
    />
  );
};

export default Instructions;
