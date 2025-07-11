fx_version 'cerulean'
lua54 'yes'
games { 'rdr3', 'gta5' }
rdr3_warning 'I acknowledge that this is a prerelease build of RedM, and I am aware my resources *will* become incompatible once RedM ships.'
use_experimental_fxv2_oal 'yes'
name         'dirk_lib'
author       'DirkScripts'
version      '1.2.8'
description  'A library for FiveM developers to use in their projects, accepting of new features and contributions.'

dependencies {
  '/server:7290',
  '/onesync',
  'oxmysql',
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
  'src/devtools/modelNames.lua',
  'src/settings.lua',
  'src/redmNatives.lua',
  'src/autodetect.lua',
  'src/oxCompat.lua',
  --\\ NUI WHEN ADDED \\--
  'web/build/index.html',
  'web/build/**/*',
}

shared_script {
  'src/init.lua',
  'src/**/shared.lua',
}

client_scripts {
  'src/**/client.lua',
  'src/**/client/*.lua'
}

server_scripts {
  'modules/callback/server.lua',
  'src/**/server.lua',
  'src/**/server/*.lua',
}

