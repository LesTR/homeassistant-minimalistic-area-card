/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ActionHandlerEvent,
  computeStateDisplay,
  computeDomain,
  EntitiesCardEntityConfig,
  FrontendLocaleData,
  handleAction,
  hasAction,
  hasConfigOrEntityChanged,
  LovelaceCard,
  NavigateActionConfig,
  NumberFormat,
  numberFormatToLocale,
  round,
} from '@dermotduffy/custom-card-helpers/dist'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers
import { css, CSSResultGroup, html, LitElement, nothing, PropertyValues } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { actionHandler } from './action-handler-directive';
import { findEntities } from './find-entities';
import {
  Alignment,
  AlignmentConfig,
  cardType,
  EntityRegistryDisplayEntry,
  EntitySection,
  EntityType,
  ExtendedEntityConfig,
  HomeAssistantArea,
  HomeAssistantExt,
  LovelaceCardGridOptions,
  MinimalisticAreaCardConfig,
  STATES_OFF,
  UNAVAILABLE,
} from './types';

import { HassEntity } from 'home-assistant-js-websocket/dist';
import { version as pkgVersion } from '../package.json';
import { customElement } from 'lit/decorators.js';
import { evalTemplate, filterStateConfigs } from './utils';

/* eslint no-console: 0 */
console.info(
  `%c  Minimalistic Area Card  %c ${pkgVersion} `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

const STATE_NOT_RUNNING = 'NOT_RUNNING';
const SENSORS = ['sensor', 'binary_sensor'];
const DOMAINS_TOGGLE = ['fan', 'input_boolean', 'light', 'switch', 'group', 'automation', 'humidifier'];

const createEntityNotFoundWarning = (hass, entityId) =>
  hass.config.state !== STATE_NOT_RUNNING
    ? hass.localize('ui.panel.lovelace.warning.entity_not_found', 'entity', entityId || '[empty]')
    : hass.localize('ui.panel.lovelace.warning.starting');

@customElement(cardType)
export class MinimalisticAreaCard extends LitElement implements LovelaceCard {
  static properties = {
    hass: { attribute: false },
    config: { state: true },
  };

  hass!: HomeAssistantExt;
  config!: MinimalisticAreaCardConfig;
  private area?: HomeAssistantArea;
  private areaEntities?: string[];
  private _templatedEntityNameRegexp = RegExp(
    /["']((input_([^.]+)|(binary_)?sensor|number|switch|fan|light|climate)\.[a-z_]+)["']/,
    'gmsid',
  );
  private configChanged = true;

  private _entitiesSensor: Array<ExtendedEntityConfig> = [];
  private _entitiesButtons: Array<EntitiesCardEntityConfig> = [];
  private _entitiesTitle: Array<EntitiesCardEntityConfig> = [];
  private _entitiesTemplated: Array<ExtendedEntityConfig> = [];

  private previowsAreaEntitiesCount = 0;

  protected override performUpdate(): void {
    this.setArea();
    this.setEntities();
    super.performUpdate();
    this.configChanged = false;
  }

  private setArea(): void {
    if (this.hass?.connected) {
      if (this.config && this.config.area) {
        const area = this.hass.areas[this.config.area];
        if (area) {
          this.area = area;
          this.areaEntities = MinimalisticAreaCard.findAreaEntities(this.hass, area.area_id);
          if (!this.config.icon) {
            this.config.icon = area.icon;
          } else {
            // Backward compatibility
            this.config.show_area_icon = true;
          }
        } else {
          this.area = undefined;
          this.areaEntities = undefined;
        }
      } else {
        this.area = undefined;
        this.areaEntities = undefined;
      }
    } else {
      console.error('Invalid hass connection');
    }
  }

  private setEntities(): void {
    if (!this.configChanged && this.areaEntities?.length == this.previowsAreaEntitiesCount) {
      // Don't refresh entities unless config changed or a new entity was added into area
      return;
    }
    this._entitiesSensor = [];
    this._entitiesButtons = [];
    this._entitiesTitle = [];
    this._entitiesTemplated = [];

    const entities = this.config?.entities || this.areaEntities || [];

    entities.forEach((item) => {
      const entity = this.parseEntity(item);
      if (entity != null && entity.entity != null) {
        const sectionParsed = this._getOrDefault(entity.entity, entity.section, EntitySection.auto);
        let section = sectionParsed in EntitySection ? sectionParsed : EntitySection.auto;

        const domain = computeDomain(entity.entity);

        if (section == EntitySection.auto) {
          section = SENSORS.indexOf(domain) !== -1 || entity.attribute ? EntitySection.sensors : EntitySection.buttons;
        }
        switch (section) {
          case EntitySection.sensors:
            this._entitiesSensor.push(entity);
            break;
          case EntitySection.title:
            this._entitiesTitle.push(entity);
            break;
          default:
            this._entitiesButtons.push(entity);
            break;
        }
      }
    });
    if (this.config) {
      this._parseTemplatedEntities(this.config);
    }
  }

  private parseEntity(item: ExtendedEntityConfig | string): ExtendedEntityConfig {
    if (typeof item === 'string') {
      return {
        entity: item,
        entity_type: EntityType.auto,
      } as ExtendedEntityConfig;
    } else {
      return {
        entity_type: this._getOrDefault(item.entity, item.entity_type, EntityType.auto),
        ...item,
      };
    }
  }

  private _handleEntityAction(ev: ActionHandlerEvent): void {
    const config = (ev.currentTarget as any).config;
    handleAction(this, this.hass, config, ev.detail.action);
  }

  private _handleThisAction(ev: ActionHandlerEvent): void {
    const parent = ((ev.currentTarget as HTMLElement).getRootNode() as any)?.host?.parentElement as HTMLElement;
    if (this.hass && this.config && ev.detail.action && (!parent || parent.tagName !== 'HUI-CARD-PREVIEW')) {
      handleAction(this, this.hass, this.config, ev.detail.action);
    }
  }

  private _parseTemplatedEntities(obj: any): void {
    if (obj == null || obj == undefined) {
      return;
    }
    const type = typeof obj;
    if (type == 'object') {
      Object.keys(obj).forEach((key) => {
        this._parseTemplatedEntities(obj[key]);
      });
    } else if (type == 'string' && obj.trim().startsWith('${') && obj.trim().endsWith('}')) {
      const entities = [...obj.trim().matchAll(this._templatedEntityNameRegexp)];
      entities?.forEach((match) => {
        if (match[1] != undefined && match[1] in this.hass.states) {
          const entityConf = this.parseEntity(match[1]);
          const founded = this._entitiesTemplated.filter((i) => i.entity == entityConf.entity);
          if (founded.length == 0) {
            this._entitiesTemplated.push(entityConf);
          }
        }
      });
    }
  }

  public static async getConfigElement() {
    await import('./editor');
    return document.createElement('better-minimalistic-area-card-editor');
  }

  // The user supplied configuration. Throw an exception and Home Assistant
  // will render an error card.
  public setConfig(config: MinimalisticAreaCardConfig): void {
    if (!config || (config.entities && !Array.isArray(config.entities))) {
      throw new Error('Invalid configuration');
    }

    this.config = {
      hold_action: { action: 'more-info' },
      ...config,
    };
    this.config.align = {
      title: this._getOrDefault(null, config.align?.title, Alignment.left),
      sensors: this._getOrDefault(null, config.align?.sensors, Alignment.left),
      buttons: this._getOrDefault(null, config.align?.buttons, Alignment.right),
      title_entities: this._getOrDefault(null, config.align?.title_entities, Alignment.right),
      ...config.align,
    } as AlignmentConfig;
    this.configChanged = true;
  }

  public getCardSize(): number {
    let size = 1;
    if (this._entitiesSensor.length > 0) {
      size++;
    }
    if (this._entitiesButtons.length > 0) {
      size++;
    }
    return size;
  }

  public getLayoutOptions(): LovelaceCardGridOptions {
    const size = this.getCardSize();
    return {
      rows: size,
      columns: 1,
      min_rows: 1,
      min_columns: 1,
    } as LovelaceCardGridOptions;
  }

  protected render() {
    if (!this.config || !this.hass) {
      return nothing;
    }

    const background_color = this.config.background_color ? `background-color: ${this.config.background_color}` : '';
    let imageUrl: string | undefined = undefined;
    if (!this.config.camera_image && (this.config.image || this.area?.picture)) {
      imageUrl = new URL(this.config.image || this.area?.picture || '', this.hass.auth.data.hassUrl).toString();
    }

    return html`
      <ha-card
        @action=${this._handleThisAction}
        style=${background_color}
        .actionHandler=${actionHandler({
          hasHold: hasAction(this.config.hold_action),
          hasDoubleClick: hasAction(this.config.double_tap_action),
        })}
        tabindex=${ifDefined(hasAction(this.config.tap_action) ? '0' : undefined)}
      >
        ${imageUrl
          ? html`<img
              src=${imageUrl}
              class=${classMap({
                darken: this.config.darken_image === undefined ? false : this.config.darken_image,
              })}
            />`
          : null}
        ${this.config.camera_image
          ? html`<div
              class=${classMap({
                camera: true,
                darken: this.config.darken_image === undefined ? false : this.config.darken_image,
              })}
            >
              <hui-image
                .hass=${this.hass}
                .cameraImage=${this.config.camera_image}
                .entity=${this.config.camera_image}
                .cameraView=${this.config.camera_view || 'auto'}
                .width=${'100%'}
              ></hui-image>
            </div>`
          : null}

        <div class="box">
          ${this.renderTitle()}
          <div class="sensors align-${this.config.align?.sensors?.toLocaleLowerCase()}">
            ${this._entitiesSensor.map((entityConf) => this.renderEntity(entityConf))}
          </div>
          <div class="buttons align-${this.config.align?.buttons?.toLocaleLowerCase()}">
            ${this._entitiesButtons.map((entityConf) => this.renderEntity(entityConf))}
          </div>
        </div>
      </ha-card>
    `;
  }

  private renderTitle() {
    const entitites = html`
      <div class="title-entities title-entities-${this.config.align?.title_entities?.toLocaleLowerCase()}">
        ${this._entitiesTitle.map((conf) => this.renderEntity(conf))}
      </div>
    `;
    return html`
      <div class="card-header align-${this.config.align?.title?.toLocaleLowerCase()}">
        ${this.config.align?.title_entities == Alignment.left ? entitites : ''} ${this.renderAreaIcon(this.config)}
        <span class="title">${this.config.title}</span>
        ${this.config.align?.title_entities != Alignment.left ? entitites : ''}
      </div>
    `;
  }

  private renderAreaIcon(areaConfig: MinimalisticAreaCardConfig) {
    if (
      this._getOrDefault(null, areaConfig.icon, '').trim().length == 0 ||
      !this._getOrDefault(null, areaConfig.show_area_icon, false)
    ) {
      return html``;
    }
    return html` <ha-icon icon=${ifDefined(areaConfig.icon)}></ha-icon> `;
  }

  private renderEntity(entityConf: ExtendedEntityConfig) {
    const stateObj = this.hass.states[entityConf.entity];
    if (stateObj == undefined) {
      return nothing;
    }
    const entity = this.hass.entities[entityConf.entity] as EntityRegistryDisplayEntry;
    const entityId = entity.entity_id;

    const domain = computeDomain(stateObj.entity_id);

    const dialog =
      this._getOrDefault(entityId, entityConf.force_dialog, false) || DOMAINS_TOGGLE.indexOf(domain) === -1;

    let show_state = true;
    if (entityConf.show_state === undefined) {
      // added for backward compatibility: hide state by default for binary_sensors
      show_state = domain === 'binary_sensor' ? false : true;
    } else {
      show_state = !!entityConf.show_state;
    }

    entityConf = {
      tap_action: { action: dialog ? 'more-info' : 'toggle' },
      hold_action: { action: 'more-info' },
      show_state: show_state,
      ...entityConf,
    };

    if ((!stateObj || stateObj.state === UNAVAILABLE) && !this.config.hide_unavailable) {
      return html`
        <div class="wrapper">
          <hui-warning-element
            .label=${createEntityNotFoundWarning(this.hass, entityConf.entity)}
            class=${classMap({
              shadow: this.config.shadow === undefined ? false : this.config.shadow,
            })}
          ></hui-warning-element>
        </div>
      `;
    } else if ((!stateObj || stateObj.state === UNAVAILABLE) && this.config.hide_unavailable) {
      return nothing;
    }

    const active = stateObj && stateObj.state && STATES_OFF.indexOf(stateObj.state.toString().toLowerCase()) === -1;
    const title = `${stateObj.attributes?.friendly_name || stateObj.entity_id}: ${computeStateDisplay(this.hass?.localize, stateObj, this.hass?.locale)}`;

    const isSensor = entityConf.entity_type == EntityType.sensor || SENSORS.indexOf(domain) !== -1;

    let icon = entityConf.icon;
    let color = entityConf.color;
    let hide = this._getOrDefault(entityId, entityConf.hide, false);

    if (entityConf.state !== undefined && entityConf.state.length > 0) {
      const currentState = this.computeStateValue(stateObj, entity);
      const stateConfig = filterStateConfigs(entityId, entityConf.state, currentState, this.hass);
      if (stateConfig) {
        icon = this._getOrDefault(entityId, stateConfig.icon, entityConf.icon);
        color = this._getOrDefault(entityId, stateConfig.color, entityConf.color);
        hide = this._getOrDefault(entityId, stateConfig.hide, hide);
      }
    }
    if (hide) {
      return nothing;
    }

    return html`
      <div class="wrapper ${entityConf.entity.replace('.', '_')}">
        <ha-icon-button
          @action=${this._handleEntityAction}
          .actionHandler=${actionHandler({
            hasHold: hasAction(entityConf.hold_action),
            hasDoubleClick: hasAction(entityConf.double_tap_action),
          })}
          .config=${entityConf}
          class=${classMap({ 'state-on': active })}
        >
          <state-badge
            .hass=${this.hass}
            .stateObj=${stateObj}
            .title=${title}
            .overrideIcon=${icon}
            .stateColor=${entityConf.state_color !== undefined
              ? entityConf.state_color
              : this.config.state_color !== undefined
                ? this.config.state_color
                : true}
            .color=${color}
            class=${classMap({
              shadow: this.config.shadow === undefined ? false : this.config.shadow,
            })}
          ></state-badge>
        </ha-icon-button>
        ${isSensor && entityConf.show_state
          ? html`
              <div class="state">
                ${entityConf.attribute
                  ? html` ${entityConf.prefix} ${stateObj.attributes[entityConf.attribute]} ${entityConf.suffix} `
                  : this.computeStateValue(stateObj, entity)}
              </div>
            `
          : null}
      </div>
    `;
  }

  private isNumericState(stateObj: HassEntity) {
    return !!stateObj.attributes.unit_of_measurement || !!stateObj.attributes.state_class;
  }

  private computeStateValue(stateObj: HassEntity, entity?: EntityRegistryDisplayEntry) {
    if (this.isNumericState(stateObj)) {
      const value = Number(stateObj.state);
      if (isNaN(value)) return null;
      else {
        const opt = this.getNumberFormatOptions(stateObj, entity);
        const str = this.formatNumber(value, this.hass.locale, opt);
        return `${str}${stateObj.attributes.unit_of_measurement ? ' ' + stateObj.attributes.unit_of_measurement : ''}`;
      }
    } else if (stateObj.state !== 'unavailable' && stateObj.state !== 'idle') {
      return stateObj.state;
    } else {
      return null;
    }
  }

  /**
   * Checks if the current entity state should be formatted as an integer based on the `state` and `step` attribute and returns the appropriate `Intl.NumberFormatOptions` object with `maximumFractionDigits` set
   * @param entityState The state object of the entity
   * @returns An `Intl.NumberFormatOptions` object with `maximumFractionDigits` set to 0, or `undefined`
   */
  private getNumberFormatOptions(
    entityState: HassEntity,
    entity?: EntityRegistryDisplayEntry,
  ): Intl.NumberFormatOptions | undefined {
    const precision = entity?.display_precision;
    if (precision != null) {
      return {
        maximumFractionDigits: precision,
        minimumFractionDigits: precision,
      };
    }
    if (Number.isInteger(Number(entityState.attributes?.step)) && Number.isInteger(Number(entityState.state))) {
      return { maximumFractionDigits: 0 };
    }
    return undefined;
  }

  /**
   * Formats a number based on the user's preference with thousands separator(s) and decimal character for better legibility.
   *
   * @param num The number to format
   * @param localeOptions The user-selected language and formatting, from `hass.locale`
   * @param options Intl.NumberFormatOptions to use
   */
  private formatNumber(
    num: string | number,
    localeOptions?: FrontendLocaleData,
    options?: Intl.NumberFormatOptions,
  ): string {
    const locale = localeOptions ? numberFormatToLocale(localeOptions) : undefined;

    // Polyfill for Number.isNaN, which is more reliable than the global isNaN()
    Number.isNaN =
      Number.isNaN ||
      function isNaN(input) {
        return typeof input === 'number' && isNaN(input);
      };

    if (localeOptions?.number_format !== NumberFormat.none && !Number.isNaN(Number(num)) && Intl) {
      try {
        return new Intl.NumberFormat(locale, this.getDefaultFormatOptions(num, options)).format(Number(num));
      } catch (err: any) {
        // Don't fail when using "TEST" language
        // eslint-disable-next-line no-console
        console.error(err);
        return new Intl.NumberFormat(undefined, this.getDefaultFormatOptions(num, options)).format(Number(num));
      }
    }
    if (typeof num === 'string') {
      return num;
    }
    return `${round(num, options?.maximumFractionDigits).toString()}${
      options?.style === 'currency' ? ` ${options.currency}` : ''
    }`;
  }

  /**
   * Generates default options for Intl.NumberFormat
   * @param num The number to be formatted
   * @param options The Intl.NumberFormatOptions that should be included in the returned options
   */
  private getDefaultFormatOptions(num: string | number, options?: Intl.NumberFormatOptions): Intl.NumberFormatOptions {
    const defaultOptions: Intl.NumberFormatOptions = {
      maximumFractionDigits: 2,
      ...options,
    };

    if (typeof num !== 'string') {
      return defaultOptions;
    }

    // Keep decimal trailing zeros if they are present in a string numeric value
    if (!options || (options.minimumFractionDigits === undefined && options.maximumFractionDigits === undefined)) {
      const digits = num.indexOf('.') > -1 ? num.split('.')[1].length : 0;
      defaultOptions.minimumFractionDigits = digits;
      defaultOptions.maximumFractionDigits = digits;
    }

    return defaultOptions;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (hasConfigOrEntityChanged(this, changedProps, false)) {
      return true;
    }

    const oldHass = changedProps.get('hass');

    if (!oldHass || oldHass.themes !== this.hass.themes || oldHass.locale !== this.hass.locale) {
      return true;
    }
    for (const entity of [
      ...this._entitiesButtons,
      ...this._entitiesSensor,
      ...this._entitiesTemplated,
      ...this._entitiesTitle,
    ]) {
      if (oldHass.states[entity.entity] !== this.hass.states[entity.entity]) {
        return true;
      }
    }

    return false;
  }

  private _getOrDefault(entity: string | null, value: any, defaultValue): any {
    if (value == undefined) {
      return defaultValue;
    }
    if (typeof value === 'string') {
      return evalTemplate(entity, value, this.hass);
    }
    return value;
  }

  public static findAreaEntities(hass: HomeAssistantExt, area_id: string): Array<string> {
    const area = hass.areas && hass.areas[area_id];
    const areaEntities =
      hass.entities &&
      area &&
      Object.keys(hass.entities)
        .filter(
          (e) =>
            !hass.entities[e].disabled_by &&
            !hass.entities[e].hidden &&
            hass.entities[e].entity_category !== 'diagnostic' &&
            hass.entities[e].entity_category !== 'config' &&
            (hass.entities[e].area_id === area.area_id ||
              hass.devices[hass.entities[e].device_id || '']?.area_id === area.area_id),
        )
        .map((x) => x);
    return areaEntities;
  }

  public static getStubConfig(hass: HomeAssistantExt, entities: string[], entitiesFallback: string[]) {
    const area = hass.areas && hass.areas[Object.keys(hass.areas)[0]];
    const areaEntities = MinimalisticAreaCard.findAreaEntities(hass, area.area_id);

    const lights = findEntities(hass, 2, areaEntities?.length ? areaEntities : entities, entitiesFallback, ['light']);
    const switches = findEntities(hass, 2, areaEntities?.length ? areaEntities : entities, entitiesFallback, [
      'switch',
    ]);

    const sensors = findEntities(hass, 2, areaEntities?.length ? areaEntities : entities, entitiesFallback, ['sensor']);
    const binary_sensors = findEntities(hass, 2, areaEntities?.length ? areaEntities : entities, entitiesFallback, [
      'binary_sensor',
    ]);

    const obj = {
      title: 'Kitchen',
      image: 'https://demo.home-assistant.io/stub_config/kitchen.png',
      area: '',
      hide_unavailable: false,
      tap_action: {
        action: 'navigate',
        navigation_path: '/lovelace-kitchen',
      },
      entities: [...lights, ...switches, ...sensors, ...binary_sensors],
    } as MinimalisticAreaCardConfig;
    if (area) {
      obj.area = area.area_id;
      obj.title = area.name;
      (obj.tap_action as NavigateActionConfig).navigation_path = '/config/areas/area/' + area.area_id;
      delete obj.image;
    } else {
      delete obj.area;
    }
    return obj;
  }

  public static get styles(): CSSResultGroup {
    return css`
      * {
        box-sizing: border-box;
      }
      ha-card {
        position: relative;
        min-height: 48px;
        height: 100%;
        z-index: 0;
      }

      img {
        display: block;
        height: 100%;
        width: 100%;

        object-fit: cover;

        position: absolute;
        z-index: -1;
        pointer-events: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }

      .darken {
        filter: brightness(0.55);
      }

      div.camera {
        height: 100%;
        width: 100%;
        overflow: hidden;

        position: absolute;
        left: 0;
        top: 0;

        z-index: -1;
        pointer-events: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }

      div.camera hui-image {
        position: relative;
        top: 50%;
        transform: translateY(-50%);
      }

      .box {
        text-shadow: 1px 1px 2px black;
        background-color: transparent;

        display: flex;
        flex-flow: column nowrap;
        justify-content: flex-start;

        width: 100%;
        height: 100%;

        padding: 0;
        font-size: 14px;
        color: var(--primary-text-color, black);
        background: var(--ha-card-background, var(--card-background-color, white));
        z-index: 1;
      }

      .box .card-header {
        padding: 10px 15px;
        font-weight: bold;
        font-size: 1.2em;
      }

      .box .card-header ha-icon {
        color: var(--primary-text-color, black);
      }

      .box .card-header .title {
        color: var(--ha-picture-card-text-color, white);
      }

      .box .sensors {
        margin-top: -8px;
        margin-bottom: -8px;
        min-height: var(--minimalistic-area-card-sensors-min-height, 10px);
        margin-left: 5px;
        margin-right: 5px;
        font-size: 0.9em;
        line-height: 13px;
      }

      .box .card-header .title-entities {
        min-height: var(--minimalistic-area-card-sensors-min-height, 10px);
        padding: 0px;
        margin-top: -10px;
        margin-right: -20px;
        font-size: 0.9em;
        line-height: 13px;
      }

      .box .buttons {
        display: block;
        background-color: var(--ha-picture-card-background-color, rgba(0, 0, 0, 0.1));
        background-color: transparent;
        padding-top: 10px;
        padding-bottom: 10px;
        min-height: 10px;
        width: 100%;
        margin-top: auto;
      }

      .title-entities-left {
        float: left;
      }

      .title-entities-right {
        float: right;
      }

      .align-left {
        text-align: left;
      }

      .align-right {
        text-align: right;
      }

      .align-center {
        text-align: center;
      }

      .box .buttons ha-icon-button {
        margin-left: -8px;
        margin-right: -6px;
      }
      .box .sensors ha-icon-button {
        -moz-transform: scale(0.67);
        zoom: 0.67;
        vertical-align: middle;
      }

      .box .wrapper {
        display: inline-block;
        vertical-align: middle;
        margin-bottom: -8px;
      }
      .box ha-icon-button state-badge {
        line-height: 0px;
        color: var(--ha-picture-icon-button-color, #a9a9a9);
      }
      .box ha-icon-button state-badge.shadow {
        filter: drop-shadow(2px 2px 2px gray);
      }

      .box .sensors .wrapper > * {
        display: inline-block;
        vertical-align: middle;
      }
      .box .sensors .state {
        margin-left: -9px;
      }

      .box .wrapper hui-warning-element {
        display: block;
      }
      .box .wrapper hui-warning-element.shadow {
        filter: drop-shadow(2px 2px 2px gray);
      }
    `;
  }
}

@customElement('minimalistic-area-card')
export class DeprecatedMinimalisticAreaCard extends MinimalisticAreaCard {
  constructor() {
    console.warn(
      "[DEPRECATED] You are using deprecated card name 'custom:minimalistic-area-card', please update type to 'custom:better-minimalistic-area-card'. The old name will be removed in 1.3.0",
    );
    super();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'minimalistic-area-card': DeprecatedMinimalisticAreaCard;
    'better-minimalistic-area-card': MinimalisticAreaCard;
  }
}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: cardType,
  name: 'Better minimalistic area card',
  preview: true,
  description: 'Better Minimalistic Area Card',
});
