import { EntityStateConfig, HomeAssistantExt } from '../src/types';
import { evalTemplate, filterStateConfigs } from '../src/utils';

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
});
