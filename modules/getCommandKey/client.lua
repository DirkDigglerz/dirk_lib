if cache.game == 'redm' then return end

local SpecialKeyCodes = {
  ['b_116'] = 'Scroll Up',
  ['b_115'] = 'Scroll Down',
  ['b_100'] = 'LMB',
  ['b_101'] = 'RMB',
  ['b_102'] = 'MMB',
  ['b_103'] = 'Extra 1',
  ['b_104'] = 'Extra 2',
  ['b_105'] = 'Extra 3',
  ['b_106'] = 'Extra 4',
  ['b_107'] = 'Extra 5',
  ['b_108'] = 'Extra 6',
  ['b_109'] = 'Extra 7',
  ['b_110'] = 'Extra 8',
  ['b_1015'] = 'AltLeft',
  ['b_1000'] = 'ShiftLeft',
  ['b_2000'] = 'Space',
  ['b_1013'] = 'ControlLeft',
  ['b_1002'] = 'Tab',
  ['b_1014'] = 'ControlRight',
  ['b_140'] = 'Numpad4',
  ['b_142'] = 'Numpad6',
  ['b_144'] = 'Numpad8',
  ['b_141'] = 'Numpad5',
  ['b_143'] = 'Numpad7',
  ['b_145'] = 'Numpad9',
  ['b_200'] = 'Insert',
  ['b_1012'] = 'CapsLock',
  ['b_170'] = 'F1',
  ['b_171'] = 'F2',
  ['b_172'] = 'F3',
  ['b_173'] = 'F4',
  ['b_174'] = 'F5',
  ['b_175'] = 'F6',
  ['b_176'] = 'F7',
  ['b_177'] = 'F8',
  ['b_178'] = 'F9',
  ['b_179'] = 'F10',
  ['b_180'] = 'F11',
  ['b_181'] = 'F12',
  ['b_194'] = 'ArrowUp',
  ['b_195'] = 'ArrowDown',
  ['b_196'] = 'ArrowLeft',
  ['b_197'] = 'ArrowRight',
  ['b_1003'] = 'Enter',
  ['b_1004'] = 'Backspace',
  ['b_198'] = 'Delete',
  ['b_199'] = 'Escape',
  ['b_1009'] = 'PageUp',
  ['b_1010'] = 'PageDown',
  ['b_1008'] = 'Home',
  ['b_131'] = 'NumpadAdd',
  ['b_130'] = 'NumpadSubtract',
  ['b_211'] = 'Insert',
  ['b_210'] = 'Delete',
  ['b_212'] = 'End',
  ['b_1055'] = 'Home',
  ['b_1056'] = 'PageUp',
}

local function translateKey(key)
  if string.find(key, 't_') then
    return (string.gsub(key, 't_', ''))
  elseif SpecialKeyCodes[key] then
    return SpecialKeyCodes[key]
  else
    return key
  end
end

--- Get the current key bound to a registered command (RegisterKeyMapping).
--- @param commandName string The command name (e.g. '+myCommand')
--- @return string The human-readable key label
function lib.getCommandKey(commandName)
  local hash = GetHashKey(commandName) | 0x80000000
  local button = GetControlInstructionalButton(2, hash, true)
  if not button or button == '' or button == 'NULL' then
    hash = GetHashKey(commandName)
    button = GetControlInstructionalButton(2, hash, true)
  end
  return translateKey(button)
end

return lib.getCommandKey
