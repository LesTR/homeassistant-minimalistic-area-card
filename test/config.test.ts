import { html } from 'lit-html';
import { MinimalisticAreaCard } from '../src/minimalistic-area-card';
import { HomeAssistantExt, MinimalisticAreaCardConfig } from '../src/types';

describe('area card config tests', () => {
  const card: MinimalisticAreaCard = new MinimalisticAreaCard();
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
