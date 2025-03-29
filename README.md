
# DIRK LIB
A useful library for script developement, includes all the standards set by ox_lib and improves on them with support for multiple types of target, inventory, framework, vehicle keys and more. 

[📖Documentation](https://docs.dirkscripts.com/resources/dirk-lib)
[🦜Discord](discord.gg/dirkscripts)
# Convars
```properties

# The theme below will apply to all UI created by DirkScripts utilising the lib themes. 
# Theme starts at 0 and goes to 9 
# 0 is the lightest color and 9 is the darkest
# You can set the primary color to custom and set the customTheme to your own colors
# Use this generator in order to make your own custom color palettes https://mantine.dev/colors-generator/?color=7b36b5 
# Default mantine colors can be found here https://mantine.dev/theming/colors/#default-colors
setr dirk_lib:primaryColor dirk # Set to custom to use customTheme
setr dirk_lib:primaryShade 9 # 0-9
setr dirk_lib:customTheme [
  "#e5f8ff",
  "#d0ecff",
  "#a0d7fc",
  "#6dc1fa",
  "#47aef9",
  "#32a2f9",
  "#259cfa",
  "#1888df",
  "#0179c8",
  "#0068b1"
]


setr dirk_lib:language en
setr dirk_lib:debug true
setr dirk_lib:currency $
setr dirk_lib:serverName DirkRP
setr dirk_lib:logo https://via.placeholder.com/150

# Configure the resources you want to use
setr dirk_lib:framework qbx_core
setr dirk_lib:inventory dirk_inventory
setr dirk_lib:itemImgPath nui://dirk_inventory/web/images/
setr dirk_lib:primaryIdentifier license
setr dirk_lib:target ox_target
setr dirk_lib:interact sleepless_interact
setr dirk_lib:time dirk_weather
setr dirk_lib:phone lb-phone

setr dirk_lib:keys dirk_keys
setr dirk_lib:garage dirk_vehicles
setr dirk_lib:fuel dirk_fuel


setr dirk_lib:ambulance dirk_ambulance
setr dirk_lib:prison dirk_prison
setr dirk_lib:dispatch dirk_dispatch


# NOTIFICATIONS
setr dirk_lib:notify dirk_lib
setr dirk_lib:notifyPosition top-right
setr dirk_lib:notifyAudio true

# Context Menu 
setr dirk_lib:contextMenu dirk_lib
setr dirk_lib:contextClickSounds true
setr dirk_lib:contextHoverSounds true

# Dialog
setr dirk_lib:dialog dirk_lib
setr dirk_lib:dialogClickSounds true
setr dirk_lib:dialogHoverSounds true

# showTextUI 
setr dirk_lib:showTextUI dirk_lib
setr dirk_lib:showTextPosition bottom-center

# progressBar 
setr dirk_lib:progress dirk_lib
setr dirk_lib:progBarPosition bottom-center

# Groups 
setr dirk_groups:maxMembers 5
setr dirk_groups:maxDistanceInvite 5
setr dirk_groups:inviteValidTime 5
setr dirk_groups:maxLogOffTime 5


```


