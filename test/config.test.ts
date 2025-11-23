import { html } from 'lit-html';
import { MinimalisticAreaCard } from '../src/minimalistic-area-card';
import {
  EntityRegistryDisplayEntry,
  ExtendedEntityConfig,
  HomeAssistantExt,
  MinimalisticAreaCardConfig,
} from '../src/types';

const card: MinimalisticAreaCard = new MinimalisticAreaCard();

describe('area card config tests', () => {
  const hass: HomeAssistantExt = {
    connected: true,
    areas: {
      noicon: {
        area_id: 'no-icon',
        name: 'Area without icon',
      },
      withIcon: {
        area_id: 'with-icon',
        name: 'Area with icon',
        icon: 'some-icon-from-area',
      },
    },
  } as unknown as HomeAssistantExt;

  test.each([
    {
      area: 'not-existed',
      iconInConf: undefined,
      showIcon: undefined,
      expectedArea: undefined,
      expectedIcon: undefined,
      shouldRenderAreaIcon: false,
    },
    {
      area: 'noicon',
      iconInConf: undefined,
      showIcon: undefined,
      expectedArea: hass.areas.noicon,
      expectedIcon: undefined,
      shouldRenderAreaIcon: false,
    },
    {
      area: 'noicon',
      iconInConf: 'some-icon',
      showIcon: undefined,
      expectedArea: hass.areas.noicon,
      expectedIcon: 'some-icon',
      shouldRenderAreaIcon: false,
    },
    {
      area: 'noicon',
      iconInConf: 'overrided-icon',
      showIcon: undefined,
      expectedArea: hass.areas.noicon,
      expectedIcon: 'overrided-icon',
      shouldRenderAreaIcon: false,
    },
    {
      area: 'withIcon',
      iconInConf: undefined,
      showIcon: undefined,
      expectedArea: hass.areas.withIcon,
      expectedIcon: 'some-icon-from-area',
      shouldRenderAreaIcon: false,
    },
    {
      area: 'withIcon',
      iconInConf: undefined,
      showIcon: true,
      expectedArea: hass.areas.withIcon,
      expectedIcon: 'some-icon-from-area',
      shouldRenderAreaIcon: true,
    },
    {
      area: 'withIcon',
      iconInConf: '',
      showIcon: true,
      expectedArea: hass.areas.withIcon,
      expectedIcon: '',
      shouldRenderAreaIcon: false,
    },
    {
      area: 'noicon',
      iconInConf: '',
      showIcon: true,
      expectedArea: hass.areas.noicon,
      expectedIcon: '',
      shouldRenderAreaIcon: false,
    },
  ])(
    'verify option from Area and render areaIcon',
    ({ area, iconInConf, showIcon, expectedArea, expectedIcon, shouldRenderAreaIcon }) => {
      const matchResults = (
        area: string | undefined,
        iconInConf: string | undefined,
        showIcon: boolean | undefined,
        expectedArea: unknown,
        expectedIcon: string | undefined,
        shouldRenderAreaIcon: boolean | undefined,
      ): void => {
        const conf: MinimalisticAreaCardConfig = {
          area: area,
        } as MinimalisticAreaCardConfig;

        if (iconInConf != undefined) {
          conf.icon = iconInConf;
        }
        if (showIcon != undefined) {
          conf.show_area_icon = showIcon;
        }

        card.config = conf;
        card.hass = hass;
        card['setArea']();

        //matchers
        expect(card['area']).toBe(expectedArea);
        expect(card.config.icon).toBe(expectedIcon);

        //call Icon render method
        const renderAreaIcon = card['renderAreaIcon'](conf);

        if (!shouldRenderAreaIcon) {
          expect(renderAreaIcon).toStrictEqual(html``);
          expect(renderAreaIcon.values.length).toBe(0);
        } else {
          expect(renderAreaIcon).not.toStrictEqual(html``);
          expect(renderAreaIcon.values).toContain(expectedIcon);
        }
      };
      matchResults(area, iconInConf, showIcon, expectedArea, expectedIcon, shouldRenderAreaIcon);
      if (showIcon === undefined) {
        // default for showIcon should be false => verify the same with false too
        matchResults(area, iconInConf, false, expectedArea, expectedIcon, false);
      }
    },
  );
});

describe('entities configuration', () => {
  const hass: HomeAssistantExt = {
    connected: true,
    areas: {
      my_first_area: {
        area_id: 'my_first_area',
        name: 'My First Area',
      },
      my_second_area: {
        area_id: 'my_second_area',
        name: 'My First Area',
      },
    },
    devices: {},
    entities: {
      'binary_sensor.my_first_binary_sensor': {
        area_id: 'my_first_area',
        device_id: '',
        entity_id: 'binary_sensor.my_first_binary_sensor',
      },
      'binary_sensor.my_second_binary_sensor': {
        area_id: 'my_first_area',
        device_id: '',
        entity_id: 'binary_sensor.my_second_binary_sensor',
      },
      'sensor.hiden_sensor': {
        area_id: 'my_first_area',
        entity_id: 'sensor.hiden_sensor',
        device_id: '',
        hidden: true,
      },
      'sensor.another_sensor': {
        area_id: '',
        device_id: '',
        entity_id: 'sensor.alnother_sensor',
      },
    },
  } as unknown as HomeAssistantExt;

  beforeEach(() => {
    card.hass = hass;
  });

  test.each([
    { area_id: 'my_first_area', expectedCountEntities: 2 },
    { area_id: 'my_second_area', expectedCountEntities: 0 },
    { area_id: 'not_existed_area', expectedCountEntities: 0 },
  ])('Verify autodiscovered entities from area', ({ area_id, expectedCountEntities }) => {
    const entities: ExtendedEntityConfig[] = MinimalisticAreaCard.findAreaEntities(hass, area_id);
    expect(entities.length).toBe(expectedCountEntities);
    if (expectedCountEntities > 0) {
      entities.forEach((entity) => {
        expect(entity).toHaveProperty('entity');
        expect(Object.keys(hass.entities)).toContain(entity.entity);

        const hassEntity = hass.entities[entity.entity];
        expect(hassEntity.entity_id).toBe(entity.entity);
        expect(hassEntity.area_id).toBe(area_id);
      });
    }
  });
});
