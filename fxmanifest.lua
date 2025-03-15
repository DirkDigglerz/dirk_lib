fx_version 'cerulean'
lua54 'yes'
games { 'rdr3', 'gta5' }
use_experimental_fxv2_oal 'yes'
name         'dirk_lib'
author       'DirkScripts'
version      '1.0.93'
description  'A library for FiveM developers to use in their projects, accepting of new features and contributions.'

dependencies {
  '/server:7290',
  '/onesync',
}

ui_page 'web/build/index.html'

files {
  'locales/**/*',
  'init.lua',
  'modules/**/client.lua',
  'modules/**/server.lua',
  'modules/**/shared.lua',
  'bridge/**/client.lua',
  'bridge/**/server.lua',
  'bridge/**/shared.lua',
  'src/modelNames.lua',
  'src/settings.lua',
  'src/ox_compat.lua',
  'src/paymentMethods.lua',

  --\\ NUI WHEN ADDED \\--
  'web/build/index.html',
  'web/build/**/*',
}


shared_script 'src/settings.lua'
shared_script 'src/init.lua'

shared_scripts {
  'src/**/shared.lua',
  -- 'src/**/shared/*.lua'
}

client_scripts {
  'src/**/client.lua',
  'src/**/client/*.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'modules/callback/server.lua',
  'src/**/server.lua',
  'src/**/server/*.lua',
}

