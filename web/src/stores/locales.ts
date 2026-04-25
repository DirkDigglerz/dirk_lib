// dirk_lib's NUI uses dirk-cfx-react's locale system as the single source of
// truth — no duplicate store, no separate UPDATE_DIRK_LIB_LOCALES listener,
// and DirkProvider's existing subscription handles re-renders automatically
// when an admin changes the language at runtime.
export { locale, localeStore } from "dirk-cfx-react";
