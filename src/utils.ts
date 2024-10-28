import { html } from 'lit';
import { EntityStateConfig, HomeAssistantExt } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evalTemplate(entity: string | null, template: string, hass: HomeAssistantExt): any {
  const trimmed = template.trim();
  if (!(trimmed.startsWith('${') && trimmed.endsWith('}'))) {
    return template;
  }
  let func = trimmed.slice(2, -1);
  if (!func.toLocaleLowerCase().startsWith('return')) {
    func = `return ${func}`;
  }

  try {
    return new Function('hass', 'state', 'user', 'html', `'use strict'; ${func}`).call(
      null,
      hass,
      entity != null ? hass.states[entity].state : null,
      hass.user,
      html,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    const funcTrimmed = func.length <= 100 ? func.trim() : `${func.substring(0, 98)}...`;
    e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
    e.name = 'MinimalistAreaCardJSTemplateError';
    throw e;
  }
}

export function filterStateConfigs(
  entity: string,
  config: EntityStateConfig[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentValue: any,
  hass: HomeAssistantExt,
): EntityStateConfig | undefined {
  let defaultValue;
  const match = config?.filter((c) => {
    switch (c.operator?.trim().toLocaleLowerCase() || '==') {
      case '<':
        return currentValue < c.value;
      case '<=':
        return currentValue <= c.value;
      case '==':
        return currentValue == c.value;
      case '>=':
        return currentValue >= c.value;
      case '>':
        return currentValue > c.value;
      case '!=':
        return currentValue != c.value;
      case 'regex':
        return String(currentValue).match(c.value) ? true : false;
      case 'template':
        return evalTemplate(entity, c.value, hass) == true;
      case 'default':
        defaultValue = c;
        return false;
      default:
        return false;
    }
  });
  if (match?.length > 0) {
    return match[0];
  }
  return defaultValue;
}
