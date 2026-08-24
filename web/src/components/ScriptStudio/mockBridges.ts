// What dirk_lib detected on this server. In game this comes from the bridge
// module's own report plus GetResourceState / GetResourceMetadata; the shape is
// what the page needs, not a schema walk - bridging is environment, not
// configuration.

export type BridgeRow = {
  key: string;
  label: string;
  icon: string;
  /** current setting: "auto", or a forced resource name */
  value: string;
  /** what auto-detection found, when the setting is "auto" */
  detected?: string;
  options?: string[];
  /** dependencies are reported, not chosen */
  readOnly?: boolean;
  /** fixed verdict for things that are not resources (server build, OneSync) */
  fixed?: { ok: boolean; resolved: string; version?: string; note: string };
  /** `itemImgPath` is a folder, not a resource - it takes typed text */
  kind?: 'resource' | 'path';
};

/**
 * Every resource dirk_lib knows how to bridge to, and whether this server is
 * actually running it. Forcing a bridge to something absent is the mistake the
 * page exists to catch, so "not installed" has to be a first-class state rather
 * than a missing key.
 */
export const RESOURCE_REGISTRY: Record<string, { running: boolean; version?: string }> = {
  "qbx_core": {
    "running": true,
    "version": "1.24.0"
  },
  "qb-core": {
    "running": false
  },
  "es_extended": {
    "running": false
  },
  "ND_Core": {
    "running": false
  },
  "ox_inventory": {
    "running": true,
    "version": "2.45.2"
  },
  "qb-inventory": {
    "running": false
  },
  "qs-inventory": {
    "running": false
  },
  "codem-inventory": {
    "running": false
  },
  "origen_inventory": {
    "running": false
  },
  "ox_target": {
    "running": true,
    "version": "1.19.0"
  },
  "qb-target": {
    "running": false
  },
  "qtarget": {
    "running": false
  },
  "ox_lib": {
    "running": true,
    "version": "3.30.6"
  },
  "dirk_lib": {
    "running": true,
    "version": "1.2.79"
  },
  "sleepless_interact": {
    "running": false
  },
  "qbx_weathersync": {
    "running": true,
    "version": "1.3.0"
  },
  "cd_easytime": {
    "running": false
  },
  "vSync": {
    "running": false
  },
  "qbx_vehiclekeys": {
    "running": true,
    "version": "1.5.1"
  },
  "qb-vehiclekeys": {
    "running": false
  },
  "wasabi_carlock": {
    "running": false
  },
  "LegacyFuel": {
    "running": false
  },
  "ox_fuel": {
    "running": false
  },
  "cdn-fuel": {
    "running": false
  },
  "ps-fuel": {
    "running": false
  },
  "dirk_phone": {
    "running": true,
    "version": "0.9.2"
  },
  "lb-phone": {
    "running": false
  },
  "qb-phone": {
    "running": false
  },
  "yseries": {
    "running": false
  },
  "qbx_garages": {
    "running": true,
    "version": "1.8.0"
  },
  "jg-advancedgarages": {
    "running": false
  },
  "cd_garage": {
    "running": false
  },
  "illenium-appearance": {
    "running": true,
    "version": "2.4.1"
  },
  "fivem-appearance": {
    "running": false
  },
  "qb-clothing": {
    "running": false
  },
  "qbx_ambulancejob": {
    "running": true,
    "version": "1.11.0"
  },
  "qb-ambulancejob": {
    "running": false
  },
  "wasabi_ambulance": {
    "running": false
  },
  "qb-prison": {
    "running": false
  },
  "qbx_prison": {
    "running": false
  },
  "ps-dispatch": {
    "running": true,
    "version": "2.1.4"
  },
  "cd_dispatch": {
    "running": false
  },
  "linden_outlawalert": {
    "running": false
  },
  "ox_doorlock": {
    "running": true,
    "version": "1.16.0"
  },
  "qb-doorlock": {
    "running": false
  },
  "pickle_xp": {
    "running": false
  },
  "qb-houses": {
    "running": false
  },
  "ps-housing": {
    "running": false
  },
  "qs-housing": {
    "running": false
  },
  "oxmysql": {
    "running": true,
    "version": "2.9.1"
  }
};

/**
 * Every key in dirk_lib's `bridging` block, generated from the schema rather
 * than hand-listed - the hand-listed version covered ten of twenty-three, and
 * the other thirteen were only reachable through Shared Settings as bare text
 * boxes. Generating it means the page cannot fall behind the schema again.
 */
export const MOCK_BRIDGES: {
  dependencies: BridgeRow[];
  interface: BridgeRow[];
  bridges: BridgeRow[];
} = {
  dependencies: [
    { key: 'oxmysql', label: 'Required', icon: 'box', value: 'oxmysql', readOnly: true },
    {
      // not a resource - a minimum artifact version, from the fxmanifest
      key: 'server', label: 'Server build', icon: 'box', value: '/server:7290', readOnly: true,
      fixed: { ok: true, resolved: 'build 12913', note: 'Meets the 7290 minimum' },
    },
    {
      key: 'onesync', label: 'OneSync', icon: 'box', value: '/onesync', readOnly: true,
      fixed: { ok: true, resolved: 'infinity', note: 'Enabled' },
    },
  ],

  interface: [
  {
    "key": "notify",
    "label": "Notify",
    "icon": "bell",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "progress",
    "label": "Progress",
    "icon": "gauge",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "showTextUI",
    "label": "Show Text UI",
    "icon": "message",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "contextMenu",
    "label": "Context Menu",
    "icon": "layers",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "alertDialog",
    "label": "Alert Dialog",
    "icon": "alert",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "inputDialog",
    "label": "Input Dialog",
    "icon": "input",
    "value": "ox_lib",
    "options": [
      "ox_lib",
      "dirk_lib"
    ],
    "detected": "ox_lib"
  }
],

  bridges: [
  {
    "key": "framework",
    "label": "Framework",
    "icon": "plug",
    "value": "auto",
    "options": [
      "auto",
      "qbx_core",
      "qb-core",
      "es_extended",
      "ND_Core"
    ],
    "detected": "qbx_core"
  },
  {
    "key": "inventory",
    "label": "Inventory",
    "icon": "package",
    "value": "auto",
    "options": [
      "auto",
      "ox_inventory",
      "qb-inventory",
      "qs-inventory",
      "codem-inventory",
      "origen_inventory"
    ],
    "detected": "ox_inventory"
  },
  {
    "key": "itemImgPath",
    "label": "Item Img Path",
    "icon": "image",
    "value": "auto",
    "kind": "path"
  },
  {
    "key": "target",
    "label": "Target",
    "icon": "target",
    "value": "auto",
    "options": [
      "auto",
      "ox_target",
      "qb-target",
      "qtarget"
    ],
    "detected": "ox_target"
  },
  {
    "key": "interact",
    "label": "Interact",
    "icon": "hand",
    "value": "auto",
    "options": [
      "auto",
      "ox_lib",
      "dirk_lib",
      "sleepless_interact"
    ],
    "detected": "ox_lib"
  },
  {
    "key": "time",
    "label": "Time",
    "icon": "clock",
    "value": "auto",
    "options": [
      "auto",
      "qbx_weathersync",
      "cd_easytime",
      "vSync"
    ],
    "detected": "qbx_weathersync"
  },
  {
    "key": "keys",
    "label": "Keys",
    "icon": "key",
    "value": "auto",
    "options": [
      "auto",
      "qbx_vehiclekeys",
      "qb-vehiclekeys",
      "wasabi_carlock"
    ],
    "detected": "qbx_vehiclekeys"
  },
  {
    "key": "fuel",
    "label": "Fuel",
    "icon": "fuel",
    "value": "auto",
    "options": [
      "auto",
      "LegacyFuel",
      "ox_fuel",
      "cdn-fuel",
      "ps-fuel"
    ]
  },
  {
    "key": "phone",
    "label": "Phone",
    "icon": "phone",
    "value": "auto",
    "options": [
      "auto",
      "dirk_phone",
      "lb-phone",
      "qb-phone",
      "yseries"
    ],
    "detected": "dirk_phone"
  },
  {
    "key": "garage",
    "label": "Garage",
    "icon": "garage",
    "value": "auto",
    "options": [
      "auto",
      "qbx_garages",
      "jg-advancedgarages",
      "cd_garage"
    ],
    "detected": "qbx_garages"
  },
  {
    "key": "clothing",
    "label": "Clothing",
    "icon": "shirt",
    "value": "auto",
    "options": [
      "auto",
      "illenium-appearance",
      "fivem-appearance",
      "qb-clothing"
    ],
    "detected": "illenium-appearance"
  },
  {
    "key": "ambulance",
    "label": "Ambulance",
    "icon": "ambulance",
    "value": "auto",
    "options": [
      "auto",
      "qbx_ambulancejob",
      "qb-ambulancejob",
      "wasabi_ambulance"
    ],
    "detected": "qbx_ambulancejob"
  },
  {
    "key": "prison",
    "label": "Prison",
    "icon": "prison",
    "value": "auto",
    "options": [
      "auto",
      "qb-prison",
      "qbx_prison"
    ]
  },
  {
    "key": "dispatch",
    "label": "Dispatch",
    "icon": "siren",
    "value": "auto",
    "options": [
      "auto",
      "ps-dispatch",
      "cd_dispatch",
      "linden_outlawalert"
    ],
    "detected": "ps-dispatch"
  },
  {
    "key": "doorlock",
    "label": "Doorlock",
    "icon": "lock",
    "value": "auto",
    "options": [
      "auto",
      "ox_doorlock",
      "qb-doorlock"
    ],
    "detected": "ox_doorlock"
  },
  {
    "key": "skills",
    "label": "Skills",
    "icon": "skills",
    "value": "auto",
    "options": [
      "auto",
      "dirk_lib",
      "pickle_xp"
    ],
    "detected": "dirk_lib"
  },
  {
    "key": "housing",
    "label": "Housing",
    "icon": "housing",
    "value": "auto",
    "options": [
      "auto",
      "qb-houses",
      "ps-housing",
      "qs-housing"
    ]
  }
],
};
