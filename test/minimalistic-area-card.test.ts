import { MinimalisticAreaCard } from '../src/minimalistic-area-card.ts';
import { Alignment, cardType, HomeAssistantExt, MinimalisticAreaCardConfig } from '../src/types';

describe('Card test', () => {
  const card: MinimalisticAreaCard = new MinimalisticAreaCard();
  const config: MinimalisticAreaCardConfig = {
    type: 'custom:better-minimalistic-area-card',
    title: 'Terrace',
    area: 'terrace',
    icon: 'mdi:balcony',
    hide_unavailable: false,
    shadow: false,
    tap_action: {
      action: 'navigate',
      navigation_path: '/dashboard-mobile/terrace',
    },
    entities: [
      'sensor.terrace_climate_temperature_2',
      'sensor.terrace_climate_humidity_2',
      {
        entity: 'sensor.watering_v2_battery',
        show_state: false,
        state_color: false,
      },
      {
        entity: 'sensor.watering_v2_watertank_percent',
      },
      {
        entity: 'input_boolean.terrace_watering_allow_sleep',
        state_color: false,
        state: [
          {
            value: 'on',
            icon: 'mdi: sleep',
          },
          {
            value: 'off',
            icon: 'mdi:sleep-off',
          },
        ],
      },
      {
        entity: 'light.terrace_light_light',
        force_dialog: true,
        section: 'title',
        hide: '${return hass.states["binary_sensor.night"].state == "off"}',
      },
      {
        entity: 'binary_sensor.terrace_door_opening',
        state_color: false,
        section: 'buttons',
        icon: 'mdi:door',
        states: [
          {
            value: 'on',
            color: 'red',
            icon: 'mdi:door-open',
          },
        ],
      },
    ],
    layout_options: {
      grid_columns: 2,
      grid_rows: 2,
    },
  } as MinimalisticAreaCardConfig;

  const hass: HomeAssistantExt = {
    connected: true,
    areas: {
      terrace: {
        area_id: 'terrace',
        name: 'Terrace',
        picture: '',
      },
    },
    states: {
      'binary_sensor.night': {
        state: 'off',
      },
    },
  } as unknown as HomeAssistantExt;

  beforeAll(() => {
    card.hass = hass;
    card.setConfig(config);
    // Hack to call protected method
    card['performUpdate']();
  });

  test('verify card size', () => {
    expect(card.getCardSize()).toBe(3);
  });

  test('verify layout options', () => {
    const options = card.getLayoutOptions();
    expect(options.grid_columns).toBe(1);
    expect(options.grid_min_rows).toBe(1);
    expect(options.grid_rows).toBe(3);
    expect(options.grig_min_columns).toBe(1);
  });

  test('verify default alignment', () => {
    expect(card.config.align?.title).toBe(Alignment.left);
    expect(card.config.align?.sensors).toBe(Alignment.left);
    expect(card.config.align?.title_entities).toBe(Alignment.right);
    expect(card.config.align?.buttons).toBe(Alignment.right);
  });

  test('verify the card is registered in custom cards', () => {
    expect(window['customCards']).toBeInstanceOf(Array);
    const card = window['customCards'].find((c) => c.type == cardType);
    expect(card.type).toBe(cardType);
  });
});
