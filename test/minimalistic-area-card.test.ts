import { EntityConfig } from '@dermotduffy/custom-card-helpers';
import { MinimalisticAreaCard } from '../src/minimalistic-area-card.ts';
import { Alignment, cardType, EntitySection, HomeAssistantExt, MinimalisticAreaCardConfig } from '../src/types';
import { state } from 'lit/decorators';

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
        hide: '${hass.states["vacuum.my_vacuum"].state !== "docked"}',
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
      'vacuum.my_vacuum': {
        state: 'docked',
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
    expect(options.columns).toBe(1);
    expect(options.min_rows).toBe(1);
    expect(options.rows).toBe(3);
    expect(options.min_columns).toBe(1);
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

  test('verify entities are in the correct sections', () => {
    expect(card['_entitiesSensor'].length).toBe(4);
    expect(card['_entitiesButtons'].length).toBe(2);
    expect(card['_entitiesTitle'].length).toBe(1);
    expect(card['_entitiesTemplated']).toEqual(
      expect.arrayContaining([
        { entity: 'vacuum.my_vacuum', section: EntitySection.auto },
        { entity: 'binary_sensor.night', section: EntitySection.auto },
      ]),
    );
  });
});

describe('Vefify entities', () => {
  test.each([
    'input_number',
    'binary_sensor',
    'sensor',
    'number',
    'switch',
    'fan',
    'light',
    'climate',
    'vacuum',
    'camera',
    'cover',
    'device',
    'lock',
    'media_player',
    'select',
    'weather',
    'water_heater',
    'humidifier',
    'image',
    'siren',
    'scene',
    'todo',
  ])('all domains are parsed properly in templates', (domain) => {
    const entity = domain + '.my_sensor';
    const card: MinimalisticAreaCard = new MinimalisticAreaCard();
    const config: MinimalisticAreaCardConfig = {
      entities: [
        {
          entity: entity,
          hide: '${hass.states["' + entity + '"].state == "off}',
        } as EntityConfig,
      ],
    } as MinimalisticAreaCardConfig;
    const hassStates = {};
    hassStates[entity] = { state: 'off', entity_id: entity };

    const hass: HomeAssistantExt = {
      connected: true,
      states: hassStates,
    } as unknown as HomeAssistantExt;

    card.hass = hass;
    card.setConfig(config);
    // Hack to call protected method
    card['setEntities']();

    expect(card['_entitiesTemplated']).toEqual(
      expect.arrayContaining([{ entity: entity, section: EntitySection.auto }]),
    );
  });
});
