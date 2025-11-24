import { cssCardVariablesPrefix, EntityStateConfig, HomeAssistantExt, StyleOptions } from '../src/types';
import { buildCssVariables, evalTemplate, filterStateConfigs, getOrDefault } from '../src/utils';

describe('Templates tests', () => {
  const sensor = 'binary_sensor.night';
  const hass: HomeAssistantExt = {
    connected: true,
    user: {
      name: 'test user',
    },
    states: {
      'binary_sensor.night': {
        state: 'off',
        attributes: {
          some_attribute: '10',
        },
      },
      'switch.light': {
        state: 'on',
        attributes: {
          another_attribute: 20,
        },
      },
      'sensor.unavalaible': {},
    },
  } as unknown as HomeAssistantExt;

  test.each([
    { template: 'some string', expected: 'some string' },
    { template: '${string', expected: '${string' },
    { template: 'string}', expected: 'string}' },
    { template: '${return null;}', expected: null },
    { template: '${null;}', expected: null },
    { template: '${null}', expected: null },
    { template: '${"something"}', expected: 'something' },
    { template: "${hass.states['" + sensor + "'].state == 'off'}", expected: true },
    { template: "${state == 'off'}", expected: true },
    { template: "${user.name == 'test user'}", expected: true },
  ])('evalTemplate "%s"', ({ template, expected }) => {
    expect(evalTemplate(sensor, template, hass)).toBe(expected);
  });

  test.each([
    { template: "${helpers.states('binary_sensor.night')}", expected: 'off' },
    { template: "${helpers.states('sensor.non_exists')}", expected: 'unknown' },
    { template: "${helpers.states('sensor.unavalaible')}", expected: 'unavailable' },
    { template: "${helpers.state_attr('some_attribute')}", expected: '10' },
    { template: "${helpers.state_attr('non_existed_attribute')}", expected: null },
    { template: "${helpers.state_attr('switch.light','another_attribute')}", expected: 20 },
    { template: "${helpers.state_attr('sensor.non_exists','another_attribute')}", expected: null },
    { template: "${helpers.is_state('off')}", expected: true },
    { template: "${helpers.is_state('on')}", expected: false },
    { template: "${helpers.is_state(['on','off'])}", expected: true },
    { template: "${helpers.is_state(['off','off'])}", expected: true },
    { template: "${helpers.is_state('switch.light','off')}", expected: false },
    { template: "${helpers.is_state('switch.light','on')}", expected: true },
    { template: "${helpers.is_state('switch.light',['on','off'])}", expected: true },
    { template: "${helpers.is_state('switch.light',['off','off'])}", expected: false },
    { template: "${helpers.is_state_attr('some_attribute','10')}", expected: true },
    { template: "${helpers.is_state_attr('some_attribute',['10','20'])}", expected: true },
    { template: "${helpers.is_state_attr('some_attribute','100')}", expected: false },
    { template: "${helpers.is_state_attr('some_attribute',['100','200'])}", expected: false },
    { template: "${helpers.is_state_attr('non_existed_attribute','100')}", expected: false },
    { template: "${helpers.is_state_attr('switch.light','another_attribute',20)}", expected: true },
    { template: "${helpers.is_state_attr('switch.light','another_attribute',[20,100])}", expected: true },
    { template: "${helpers.is_state_attr('switch.light','another_attribute',200)}", expected: false },
    { template: "${helpers.is_state_attr('switch.light','another_attribute',[200,300])}", expected: false },
    { template: "${helpers.is_state_attr('switch.light','non_existed_attribute','100')}", expected: false },
    { template: '${helpers.has_value()}', expected: true },
    { template: "${helpers.has_value('switch.light')}", expected: true },
    { template: "${helpers.has_value('sensor.unavalaible')}", expected: false },
  ])('eval helpers "%s"', ({ template, expected }) => {
    expect(evalTemplate(sensor, template, hass)).toBe(expected);
  });

  test('throw error', () => {
    expect(() => evalTemplate(sensor, '${xxx}', hass)).toThrow();
  });

  test('verify exposed params', () => {
    expect(evalTemplate(null, '${state}', hass)).toBe(null);
    expect(evalTemplate(undefined, '${state}', hass)).toBe(null);
    expect(evalTemplate(null, '${hass}', hass)).toBe(hass);
    expect(evalTemplate(sensor, '${state}', hass)).toBe(hass.states[sensor].state);
  });

  test.each([
    { current: 5, config: [{ value: 8 }, { value: 5 }], expectedValue: 5 },
    {
      current: 5,
      config: [
        { value: 8, operator: '==' },
        { value: 5, operator: '==' },
      ],
      expectedValue: 5,
    },
    { current: 20, config: [{ value: 8 }, { value: 5 }], expectedValue: null },
    { current: 20, config: [{ value: 8, operator: 'non-existed' }, { value: 5 }], expectedValue: null },
    { current: 'x', expectedValue: null },
    { current: null, expectedValue: null },
    {
      current: 5,
      config: [
        { value: 8, operator: '==' },
        { value: 5, operator: '<=' },
      ],
      expectedValue: 5,
    },
    {
      current: 4,
      config: [
        { value: 8, operator: '==' },
        { value: 5, operator: '<' },
      ],
      expectedValue: 5,
    },
    {
      current: 5,
      config: [
        { value: 3, operator: '>=' },
        { value: 5, operator: '<=' },
      ],
      expectedValue: 3,
    },
    {
      current: 9,
      config: [
        { value: 8, operator: '>' },
        { value: 5, operator: '<' },
      ],
      expectedValue: 8,
    },
    {
      current: 5,
      config: [
        { value: 8, operator: '!=' },
        { value: 3, operator: '==' },
      ],
      expectedValue: 8,
    },
    {
      current: 5,
      config: [
        { value: 8, operator: '==' },
        { value: '[0-9]+', operator: 'regex' },
      ],
      expectedValue: '[0-9]+',
    },
    {
      current: 5,
      config: [{ value: '${state == "off"}', operator: 'template' }],
      expectedValue: '${state == "off"}',
    },
    {
      current: 5,
      config: [{ value: '${state.this-template-crash == "off"}', operator: 'template' }],
    },
    {
      current: 5,
      config: [
        { value: 8, operator: '==' },
        { value: 3, operator: 'Default ' },
      ],
      expectedValue: 3,
    },
    {
      current: 5,
      config: [
        { value: 3, operator: 'default' },
        { value: 8, operator: '!=' },
      ],
      expectedValue: 8,
    },
  ])('filter state configs "%s"', ({ current, config, expectedValue }) => {
    const c = filterStateConfigs(sensor, config as unknown as EntityStateConfig[], current, hass);
    if (expectedValue != null) {
      expect(c?.value).toBe(expectedValue);
    } else {
      expect(c).toBeUndefined();
    }
  });

  test.each([
    { input: 'false', entityId: null, defaultValue: null, expected: 'false' },
    { input: null, entityId: null, defaultValue: null, expected: null },
    { input: null, entityId: null, defaultValue: 8, expected: 8 },
    { input: undefined, entityId: null, defaultValue: null, expected: null },
    { input: undefined, entityId: null, defaultValue: 8, expected: 8 },
    { input: '${undefined}', entityId: null, defaultValue: false, expected: false },
    { input: '${null}', entityId: null, defaultValue: false, expected: false },
    { input: '${state}', entityId: 'binary_sensor.night', defaultValue: false, expected: 'off' },
    { input: '${hass.states["not-existed-entity"].state === "off"}', defaultValue: false, expected: false },
  ])('getOrDefault input "%s"', ({ input, entityId, defaultValue, expected }) => {
    expect(getOrDefault(entityId, input, hass, defaultValue)).toBe(expected);
  });
});

describe('Verify CSS variables', () => {
  const convert = (cfg: object): object => {
    return buildCssVariables(cfg as StyleOptions, null, {} as HomeAssistantExt);
  };
  test.each([
    { key: 'color', variableName: `${cssCardVariablesPrefix}color`, value: 'red' },
    { key: 'background_color', variableName: `${cssCardVariablesPrefix}background-color`, value: 'red' },
    { key: 'sensors_color', variableName: `${cssCardVariablesPrefix}sensors-color`, value: 'red' },
    { key: 'sensors_icon_size', variableName: `${cssCardVariablesPrefix}sensors-icon-size`, value: '16px' },
    { key: 'sensors_button_size', variableName: `${cssCardVariablesPrefix}sensors-button-size`, value: '16px' },
    { key: 'buttons_icon_size', variableName: `${cssCardVariablesPrefix}buttons-icon-size`, value: '24px' },
    { key: 'buttons_button_size', variableName: `${cssCardVariablesPrefix}buttons-button-size`, value: '48px' },
    { key: 'buttons_color', variableName: `${cssCardVariablesPrefix}buttons-color`, value: 'red' },
  ])('convert to variable "%s"', ({ key, variableName, value }) => {
    const cfg = {};
    cfg[key] = value;
    const result = convert(cfg);
    expect(Object.keys(result).includes(variableName)).toBe(true);
    expect(result[variableName]).toBe(value);
    expect(Object.keys(result).length).toBe(1);
  });

  test('convert all settings to variables', () => {
    const cfg = {
      color: 'red',
      background_color: 'black',
      shadow_color: 'gray',
      sensors_color: 'blue',
      sensors_icon_size: '10px',
      sensors_button_size: '20px',
      buttons_color: 'yellow',
    } as StyleOptions;
    const result = convert(cfg);
    expect(Object.keys(result).length).toBe(Object.keys(cfg).length);

    Object.keys(cfg).forEach((key) => {
      const variableName = `${cssCardVariablesPrefix}${key.replace(/[_]/gi, '-')}`;
      expect(Object.keys(result).includes(variableName)).toBe(true);
      expect(result[variableName]).toBe(cfg[key]);
    });
  });

  test('Empty settings returns empty object', () => {
    expect(convert({})).toStrictEqual({});
  });

  test('Verify template evaluation', () => {
    const result = convert({ color: "${return 'red';}" });
    expect(result[`${cssCardVariablesPrefix}color`]).toBe('red');
  });
});
