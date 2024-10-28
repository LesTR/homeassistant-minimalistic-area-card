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
      },
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

  test('throw error', () => {
    expect(() => evalTemplate(sensor, '${xxx}', hass)).toThrow();
  });

  test('verify exposed params', () => {
    expect(evalTemplate(null, '${state}', hass)).toBe(null);
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
