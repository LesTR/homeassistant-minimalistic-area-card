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
} from '@dermotduffy/custom-card-helpers'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers
import { css, CSSResultGroup, html, LitElement, nothing, PropertyValues, TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { actionHandler } from './action-handler-directive';
import { findEntities } from './find-entities';
import {
  Alignment,
  AlignmentConfig,
  cardType,
  EntityRegistryDisplayEntry,
  EntitySection,
  ExtendedEntityConfig,
  HomeAssistantArea,
  HomeAssistantExt,
  LovelaceCardGridOptions,
  MinimalisticAreaCardConfig,
  STATES_OFF,
  StyleOptions,
  UNAVAILABLE,
} from './types';

import { HassEntity } from 'home-assistant-js-websocket/dist';
import { version as pkgVersion } from '../package.json';
import { customElement } from 'lit/decorators.js';
import { buildCssVariables, deprecatedWarning, filterStateConfigs, getOrDefault } from './utils';

/* eslint no-console: 0 */
console.info(
  `%c  Better Minimalistic Area Card  %c ${pkgVersion} `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

const STATE_NOT_RUNNING = 'NOT_RUNNING';
const SENSORS = ['sensor', 'binary_sensor', 'plant'];
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
  private areaEntities?: ExtendedEntityConfig[];
  private _domainsInTemplates = [
    'input_([^.]+)',
    '(binary_)?sensor',
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
    'valve',
    'select',
    'weather',
    'water_heater',
    'humidifier',
    'image',
    'siren',
    'scene',
    'todo',
    'plant',
  ];
  private _templatedEntityNameRegexp = RegExp(`["']((${this._domainsInTemplates.join('|')})[.][a-z_]+)["']`, 'gmsid');
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
          // Set icon from the area (if exists) when missing in the config
          this.config.icon = getOrDefault(
            null,
            this.config.icon,
            this.hass,
            getOrDefault(null, area.icon, this.hass, undefined),
          );
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
        section: EntitySection.auto,
      } as ExtendedEntityConfig;
    } else {
      return {
        section: this._getOrDefault(item.entity, item.section, EntitySection.auto),
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

    if (this.config.style == undefined) {
      this.config.style = {} as StyleOptions;
    }
    if (config.background_color) {
      deprecatedWarning(
        'The top level option "background_color" was deprecated, please use "style.background_color" instead.',
      );
      if (!this.config.style.background_color) {
        this.config.style.background_color = config.background_color;
      }
    }

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

    let style = {};
    if (this.config.style) {
      style = buildCssVariables(this.config.style, null, this.hass);
    }

    let imageUrl: string | undefined = undefined;
    if (!this.config.camera_image && (this.config.image || this.area?.picture)) {
      imageUrl = new URL(this.config.image || this.area?.picture || '', this.hass.auth.data.hassUrl).toString();
    }

    return html`
      <ha-card
        @action=${this._handleThisAction}
        style=${styleMap(style)}
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

        <div
          class="${classMap({
            box: true,
            pointer: hasAction(this.config.tap_action),
            shadow: this._getOrDefault(null, this.config.shadow, false),
          })}"
        >
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

  private renderAreaIcon(config: MinimalisticAreaCardConfig) {
    if (
      this._getOrDefault(null, config.icon, '').trim().length == 0 ||
      !this._getOrDefault(null, config.show_area_icon, false)
    ) {
      return html``;
    }

    return html` <ha-icon icon=${ifDefined(config.icon)}></ha-icon> `;
  }

  private renderEntity(entityConf: ExtendedEntityConfig): any | TemplateResult {
    const stateObj = this.hass.states[entityConf.entity];
    if (stateObj == undefined) {
      return nothing;
    }
    const entity = this.hass.entities[entityConf.entity] as EntityRegistryDisplayEntry;
    const entityId = entityConf.entity.trim();

    const domain = computeDomain(entityId);

    const dialog =
      this._getOrDefault(
        entityId,
        entityConf.force_dialog,
        this._getOrDefault(entityId, this.config.force_dialog, false),
      ) || DOMAINS_TOGGLE.indexOf(domain) === -1;

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

    let icon = this._getOrDefault(entityId, entityConf.icon, '');
    let color = this._getOrDefault(entityId, entityConf.color, '');
    let hide = this._getOrDefault(entityId, entityConf.hide, false);
    let hide_if_unavailable = this._getOrDefault(
      entityId,
      entityConf.hide_unavailable,
      this._getOrDefault(entityId, this.config.hide_unavailable, false),
    );

    const currentState = this.computeStateValue(stateObj, entityConf, entity);

    if (entityConf.state !== undefined && entityConf.state.length > 0) {
      const stateConfig = filterStateConfigs(entityId, entityConf.state, stateObj.state, this.hass);
      if (stateConfig) {
        icon = this._getOrDefault(entityId, stateConfig.icon, entityConf.icon);
        color = this._getOrDefault(entityId, stateConfig.color, color);
        hide = this._getOrDefault(entityId, stateConfig.hide, hide);
        hide_if_unavailable = this._getOrDefault(entityId, stateConfig.hide_unavailable, hide_if_unavailable);
      }
    }
    const is_unavailable = !stateObj || stateObj.state === UNAVAILABLE;

    if (hide || (is_unavailable && hide_if_unavailable)) {
      return nothing;
    } else if (is_unavailable && !hide_if_unavailable) {
      return html`
        <div class="wrapper">
          <hui-warning-element .label=${createEntityNotFoundWarning(this.hass, entityId)}></hui-warning-element>
        </div>
      `;
    }

    const active = stateObj && stateObj.state && STATES_OFF.indexOf(stateObj.state.toString().toLowerCase()) === -1;
    const title = this._getOrDefault(
      entityId,
      entityConf.title,
      `${stateObj.attributes?.friendly_name || entityId}: ${computeStateDisplay(this.hass?.localize, stateObj, this.hass?.locale)}`,
    );

    const isSensor = entityConf.section == EntitySection.sensors || SENSORS.indexOf(domain) !== -1;

    return html`
      <div class="wrapper ${entityConf.entity.replace('.', '_')}">
        <ha-icon-button
          @action=${this._handleEntityAction}
          .actionHandler=${actionHandler({
            hasHold: hasAction(entityConf.hold_action),
            hasDoubleClick: hasAction(entityConf.double_tap_action),
          })}
          .config=${entityConf}
          class=${classMap({
            'state-on': active,
          })}
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
          ></state-badge>
        </ha-icon-button>
        ${currentState != null && isSensor && entityConf.show_state
          ? html`
              <div class="state">
                ${entityConf.attribute
                  ? html` ${entityConf.prefix} ${stateObj.attributes[entityConf.attribute]} ${entityConf.suffix} `
                  : currentState}
              </div>
            `
          : null}
      </div>
    `;
  }

  private isNumericState(stateObj: HassEntity) {
    return !!stateObj.attributes.unit_of_measurement || !!stateObj.attributes.state_class;
  }

  private computeStateValue(
    stateObj: HassEntity,
    entityConf: ExtendedEntityConfig,
    entity?: EntityRegistryDisplayEntry,
  ) {
    if (!stateObj.attributes) {
      stateObj.attributes = {};
    }
    const units = this._getOrDefault(
      entity?.entity_id,
      entityConf.unit_of_measurement,
      this._getOrDefault(entity?.entity_id, stateObj.attributes.unit_of_measurement, ''),
    );
    const _fmt = function (str: string, units: string): string {
      return `${str}${units ? ' ' + units : ''}`;
    };

    if (['unavailable', 'unknown', 'idle'].includes(String(stateObj.state).toLowerCase())) {
      return null;
    }
    if (['off', 'on', 'true', 'false'].includes(String(stateObj.state).toLowerCase())) {
      return units;
    }
    if (this.isNumericState(stateObj)) {
      const value = Number(stateObj.state);
      if (isNaN(value)) {
        return null;
      } else {
        const opt = this.getNumberFormatOptions(stateObj, entity);
        const str = this.formatNumber(value, this.hass.locale, opt);
        return _fmt(str, units);
      }
    } else {
      return _fmt(stateObj.state, units);
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

    const areaKey = this.config.area;
    // Update when area changed.
    if (
      oldHass &&
      areaKey &&
      this.hass.areas[areaKey] &&
      oldHass.area &&
      oldHass.area[areaKey] !== this.hass.areas[areaKey]
    ) {
      return true;
    }

    return false;
  }

  private _getOrDefault(entity: string | null | undefined, value: any, defaultValue: any): any {
    return getOrDefault(entity, value, this.hass, defaultValue);
  }

  public static findAreaEntities(hass: HomeAssistantExt, area_id: string): ExtendedEntityConfig[] {
    const area = hass.areas && hass.areas[area_id];
    const areaEntities =
      hass.entities &&
      area &&
      Object.keys(hass.entities)
        .filter(
          (e) =>
            !hass.entities[e].hidden &&
            hass.entities[e].entity_category !== 'diagnostic' &&
            hass.entities[e].entity_category !== 'config' &&
            (hass.entities[e].area_id === area.area_id ||
              hass.devices[hass.entities[e].device_id || '']?.area_id === area.area_id),
        )
        .map((x) => MinimalisticAreaCard._mapEntityNameToEntityConfig(x));
    return areaEntities || [];
  }

  private static _mapEntityNameToEntityConfig(name: string): ExtendedEntityConfig {
    return { entity: name } as ExtendedEntityConfig;
  }

  public static getStubConfig(hass: HomeAssistantExt, input_entities: string[], input_entitiesFallback: string[]) {
    const entities = input_entities.map((x) => MinimalisticAreaCard._mapEntityNameToEntityConfig(x));
    const entitiesFallback = input_entitiesFallback.map((x) => MinimalisticAreaCard._mapEntityNameToEntityConfig(x));

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
      }

      img {
        display: block;
        height: 100%;
        width: 100%;
        object-fit: cover;
        position: absolute;
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

        pointer-events: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }

      div.camera hui-image {
        position: relative;
        top: 50%;
        transform: translateY(-50%);
      }

      .box {
        background-color: var(--ha-better-minimalistic-area-card-background-color, transparent);
        color: var(--ha-better-minimalistic-area-card-color, var(--primary-text-color, black));
        display: flex;
        flex-flow: column nowrap;
        justify-content: flex-start;

        width: 100%;
        height: 100%;

        padding: 0;
        font-size: 14px;
        border-radius: var(--ha-card-border-radius, 12px);
        z-index: -1;
      }

      .box .card-header {
        padding: 10px 15px;
        font-weight: bold;
        font-size: 1.2em;
        z-index: 1;
      }

      .box .sensors {
        margin-top: -8px;
        margin-bottom: -8px;
        vertical-align: middle;
        min-height: var(--minimalistic-area-card-sensors-min-height, 10px);
        color: var(
          --ha-better-minimalistic-area-card-sensors-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, black))
        );
        margin-left: 5px;
        margin-right: 5px;
        font-size: 0.9em;
        z-index: 1;
      }

      .box .card-header .title-entities {
        color: var(
          --ha-better-minimalistic-area-card-buttons-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, black))
        );
        padding: 0px;
        margin-top: -20px;
        margin-right: -20px;
        font-size: 0.9em;
        line-height: 13px;
      }

      .pointer {
        cursor: pointer;
      }

      .box .buttons {
        display: block;
        color: var(
          --ha-better-minimalistic-area-card-buttons-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, black))
        );
        padding-bottom: 10px;
        width: 100%;
        margin-top: auto;
        z-index: 1;
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

      .box .sensors ha-icon-button {
        --mdc-icon-size: var(--ha-better-minimalistic-area-card-sensors-icon-size, 18px);
        --mdc-icon-button-size: var(--ha-better-minimalistic-area-card-sensors-button-size, 32px);
      }

      .box .buttons ha-icon-button {
        --mdc-icon-size: var(--ha-better-minimalistic-area-card-buttons-icon-size, 24px);
        --mdc-icon-button-size: var(--ha-better-minimalistic-area-card-buttons-button-size, 48px);
        margin-left: -8px;
        margin-right: -6px;
      }

      .box .wrapper {
        display: inline-block;
        vertical-align: middle;
        margin-bottom: -8px;
      }
      .box .sensors ha-icon-button,
      .box .sensors state-badge {
        color: var(
          --ha-better-minimalistic-area-card-sensors-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, #a9a9a9))
        );
        line-height: 0px;
      }
      .box .buttons ha-icon-button,
      .box .buttons state-badge {
        color: var(
          --ha-better-minimalistic-area-card-buttons-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, #a9a9a9))
        );
      }
      .box .title-entities ha-icon-button,
      .box .title-entities state-badge {
        color: var(
          --ha-better-minimalistic-area-card-buttons-color,
          var(--ha-better-minimalistic-area-card-color, var(--secondary-text-color, #a9a9a9))
        );
      }

      .shadow {
        text-shadow: 1px 1px 2px var(--ha-better-minimalistic-area-card-shadow-color, gray);
      }
      .box .state,
      .box hui-warning-element {
        cursor: default;
      }

      .shadow ha-icon-button,
      .shadow state-badge,
      .shadow ha-icon {
        filter: drop-shadow(1px 1px 2px var(--ha-better-minimalistic-area-card-shadow-color, gray));
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
    `;
  }
}

/** @deprecated replaced by  MinimalisticAreaCard */
@customElement('minimalistic-area-card')
export class DeprecatedMinimalisticAreaCard extends MinimalisticAreaCard {
  constructor() {
    deprecatedWarning(
      "You are using deprecated card name 'custom:minimalistic-area-card', please update type to 'custom:better-minimalistic-area-card'. The old name will be removed in 1.3.0",
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
