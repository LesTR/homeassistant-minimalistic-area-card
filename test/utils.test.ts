import { HomeAssistantExt } from '../src/types';
import { evalTemplate } from '../src/utils';

describe('Templates tests', () => {
  const sensor = 'binary_sensor.night';
  const hass: HomeAssistantExt = {
    connected: true,
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
});
