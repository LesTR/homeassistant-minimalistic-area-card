# Better Minimalistic Area Card

A minimalistic area card to have a control panel of your house on your dashboard. This card will show numeric sensors with its value, and binary sensors with only the icon. Switches and lights will have their own button that you can tap/click to toggle, or tap/click and hold to see detailed information.

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)
[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/custom-components/hacs)

![Sample preview](docs/sample.png)

This is a fork of [junalmeida/homeassistant-minimalistic-area-card](https://github.com/junalmeida/homeassistant-minimalistic-area-card), and I would like to thank the original author. The reason for renaming can be found in [issue 128](https://github.com/LesTR/homeassistant-minimalistic-area-card/issues/128).

## Migration from the original card

- install this one from HACS - NOT YET - see [issue-128](https://github.com/LesTR/homeassistant-minimalistic-area-card/issues/128) for details. [Here](https://youtu.be/Y6YVQL0YHUw?t=57) is a video describing how to use this card. Just check the current options/settings.
- replace type from `custom:minimalistic-area-card` by `custom:better-minimalistic-area-card`.

## Options

For entity options, see <https://www.home-assistant.io/dashboards/entities/#options-for-entities>.

For `tap_action` options, see <https://www.home-assistant.io/dashboards/actions/>.

```yaml
- type: custom:better-minimalistic-area-card
  title: Living Room
  image: /local/img/living-room.jpg #any image file on /config/www or an absolute image url. optional, it uses area image if area is specified. (optional)
  area: living_room # area id of an existing area defined in HA. (optional)
  camera_image: camera.living_room # a camera entity to use as background (optional)
  camera_view: 'auto' # auto, live (optional)
  icon: mdi:sofa (optional) Override the area icon.
  show_area_icon: true # boolean (optional), default false. Show the are icon in the title. The top-level option icon can override the icon.
  shadow: true # Draws a drop shadow on icons (optional)
  hide_unavailable: false # Hide unavailable entities (optional)
  state_color: true # enable or disable HA colors for all entities
  shadow: true # enable a drop shadow on entity icons to contrast with the background
  darken_image: true # reduce brightness of the background image to constrast with entities
  force_dialog: false # the default value for force_dialog on entities (optinal). Default: false
  style:
    color: red # Override the color for text and icons (optional)
    sensors_color: blue #Override the color for sensors (optional)
    sensors_icon_size: 18px #Override size for the icons in sensors area (optional, default 18px)
    sensors_button_size: 32px #Override the clickable area on icons in sensors area (optional, default 32px)
    buttons_color: blue #Override the color for buttons (optional)
    background_color: yellow # a color name, rgb hex or rgba function when an image is not provided (optional)
    shadow_color: grey # a color name, rgb hex or rgba function for shadow when enabled
  align:
    title: left # text align, values: left, right, center (optional)
    sensors: left # text align, values: left, right, center (optional)
    buttons: right # text align, values: left, right, center (optional)
    title_entities: right # text align, values: left, right (optional)
  tap_action:
    action: navigate
    navigation_path: /lovelace/living-room
  entities: #optional, lists area entities automatically if ommited.
    - entity: media_player.living_room_tv
      state_color: false # enable or disable HA colors for this entity
      hide: false # show/hide entity (optional), default false
      force_dialog: false # force dialog for buttons instead of calling toogle
      show_state: true #show/hide state for sensors (binary_sensors are hidden by default) (optional, default true)
      section: auto # define the section where to show given entity (optional), default 'auto', possible values: auto, sensors, buttons, title. Sensors means the first line, buttons the second one, title op.
      unit_of_measurement: "my unit" # overrides the units of entity. (optional, default empty). Useful when entity don't have attribute with units.
    - entity: switch.fireplace_on_off
    - entity: cover.window_covering
      tap_action:
        action: toggle
    - entity: media_player.speaker
    - entity: light.living_room_lamp
    - entity: sensor.hallway_humidity
    - entity: sensor.hallway_temperature
      color: blue
    - entity: binary_sensor.main_door_opening
      icon: mdi:door
      state_color: true
      state:
        - value: 'on'
          color: green
          icon: mdi:door-open
        - value: 'off'
          color: red
          icon: mdi:door-closed
```

## State based overrides

Example:

```yaml
state: # array of values
  - value: value # state value to match
    operator: '==' # optinal(default ==) - See state operators for details
    icon: mdi:my-icon" # entity icon used when state match
    color: color # color used when state match
    hide: false # Default false, conditionally hide the entity when state match given value
```

### State operators

The order of your elements in the `state` object matters. The first one which is `true` will match. This copied the functionality from [button-card](https://github.com/custom-cards/button-card).

|  Operator  | `value` example | Description                                                                                                                                                                           |
| :--------: | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    `<`     | `5`             | Current state is inferior to `value`                                                                                                                                                  |
|    `<=`    | `4`             | Current state is inferior or equal to `value`                                                                                                                                         |
|    `==`    | `42` or `'on'`  | **This is the default if no operator is specified.** Current state is equal (`==` javascript) to `value`                                                                              |
|    `>=`    | `32`            | Current state is superior or equal to `value`                                                                                                                                         |
|    `>`     | `12`            | Current state is superior to `value`                                                                                                                                                  |
|    `!=`    | `'normal'`      | Current state is not equal (`!=` javascript) to `value`                                                                                                                               |
|  `regex`   | `'^norm.*$'`    | `value` regex applied to current state does match                                                                                                                                     |
| `template` |                 | See [templates](#experimental-templating-support) for examples. `value` needs to be a javascript expression which returns a boolean. If the boolean is true, it will match this state |
| `default`  | N/A             | If nothing matches, this is used                                                                                                                                                      |

## Experimental Templating support

You can use experimental support for templating that allows you to create a dynamic value based on the state or other attribute of any entity.
Everything inside `${}` is now evaluated as a template.

Example:

```yaml
entities:
  - entity: climate.bedroom_thermostat_thermostat
    hide: ${hass.states['input_boolean.heating_season'].state === 'off'}
  - entity: binary_sensor.washing_machine_water_leakage_sensor_moisture
    hide: ${state == "off"}
```

### Variables and types exposes in templates

```
hass : HomeAssistant - homeassistant object
state : any - state value of given entity or null
user : CurrentUser - structure represents the currently logged user
helpers: object - functions exposed to be used in the templates - see bellow
```

### Helpers

Templates supports a cople of function which can be used in templates. For concreate examples, please see `test/utils.test.ts`.

| Helper                | Example                                                     | Description                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| helpers.states        | `${helpers.states('binary_sensor.night')}`                  | Returns the state string (not the state object) of the given entity, `unknown` if it doesn’t exist, and `unavailable` if the object exists but is not available.                                                                                                                                                   |
| helpers.state_attr    | `${helpers.state_attr('switch.light','another_attribute')}` | will return the value of the attribute or `null` if it doesn’t exist.                                                                                                                                                                                                                                              |
| helpers.is_state      | `${helpers.is_state('switch.light','off')}"`                | compares an entity’s state with a specified state or list of states and returns True or False. is_state('device_tracker.paulus', 'home') will test if the given entity is the specified state. is_state('device_tracker.paulus', ['home', 'work']) will test if the given entity is any of the states in the list. |
| helpers.is_state_attr | `${helpers.is_state_attr('some_attribute',['10','20'])}"`   | will test if the given entity attribute is the specified state or in the list of given values                                                                                                                                                                                                                      |
| helpers.has_value     | `${helpers.has_value('switch.light')}"`                     | will test if the given entity is not unknown or unavailable.                                                                                                                                                                                                                                                       |

### CSS variables

- `--ha-better-minimalistic-area-card-color` - configure color for text, sensors, buttons and state values
- `--ha-better-minimalistic-area-card-sensors-color` - configure color for sensors and state values in the sensor area
- `--ha-better-minimalistic-area-card-sensors-icon-size` - configure size for the icons in the sensor area (default 18px)
- `--ha-better-minimalistic-area-card-sensors-button-size` - configure clickable size on icons in the sensor area (default 32px)
- `--ha-better-minimalistic-area-card-buttons-color` - configure color for buttons and state values in the button area
- `--ha-better-minimalistic-area-card-shadow-color` - configure color of shadow (when enabled)

[license-shield]: https://img.shields.io/github/license/lestr/homeassistant-minimalistic-area-card.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/lestr/homeassistant-minimalistic-area-card.svg?style=for-the-badge
[releases]: https://github.com/lestr/homeassistant-minimalistic-area-card/releases
