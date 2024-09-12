/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    ActionHandlerEvent, computeStateDisplay, EntitiesCardEntityConfig,
    FrontendLocaleData,
    handleAction, hasAction, hasConfigOrEntityChanged, NavigateActionConfig,
    NumberFormat,
    numberFormatToLocale,
    round
} from 'custom-card-helpers/dist'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers
import { css, html, LitElement } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from "lit/directives/if-defined.js";
import { actionHandler } from './action-handler-directive';
import { findEntities } from './find-entities';
import { Alignment, cardType, EntityRegistryDisplayEntry, HomeAssistantArea, HomeAssistantExt, MinimalisticAreaCardConfig, STATES_OFF, UNAVAILABLE } from './types';

import { HassEntity } from 'home-assistant-js-websocket/dist';
import { version as pkgVersion } from "../package.json";


/* eslint no-console: 0 */
console.info(
    `%c  Minimalistic Area Card  %c ${pkgVersion} `,
    'color: orange; font-weight: bold; background: black',
    'color: white; font-weight: bold; background: dimgray',
);

const STATE_NOT_RUNNING = "NOT_RUNNING";
const SENSORS = [
    "sensor",
    "binary_sensor"
];

enum EntitySection {
    auto = "auto",
    sensors = "sensors",
    buttons = "buttons",
}

const DOMAINS_TOGGLE = [
    "fan",
    "input_boolean",
    "light",
    "switch",
    "group",
    "automation",
    "humidifier",
];

type ExtendedEntityConfig = EntitiesCardEntityConfig & {
    prefix?: string;
    suffix?: string;
    show_state?: boolean;
    force_dialog?: boolean;
    hide?: boolean;
    attribute?: string;
    color?: string;
    state?: EntityStateConfig[];
    section?: EntitySection;
};

type EntityStateConfig = {
    value: string;
    icon?: string;
    color?: string;
    hide?: boolean
}

const createEntityNotFoundWarning = (
    hass,
    entityId
) =>
    hass.config.state !== STATE_NOT_RUNNING
        ? hass.localize(
            "ui.panel.lovelace.warning.entity_not_found",
            "entity",
            entityId || "[empty]"
        )
        : hass.localize("ui.panel.lovelace.warning.starting");


class MinimalisticAreaCard extends LitElement {
    static properties = {
        hass: { attribute: false },
        config: { state: true }
    };

    private hass!: HomeAssistantExt;
    private config!: MinimalisticAreaCardConfig;
    private area?: HomeAssistantArea;
    private areaEntities?: string[];
    private _templatedEntityNameRegexp = RegExp(/["']((input_([^.]+)|(binary_)?sensor|number|switch|fan|light|climate)\.[a-z_]+)["']/, "gmsid")
    private configChanged = true
    private previowsAreaEntitiesCount = 0;

    override async performUpdate() {
        this.setArea();
        this.setEntities();
        await super.performUpdate();
        this.configChanged = false;
    }

    setArea() {
        if (this.hass?.connected) {
            if (this.config && this.config.area) {
                const area = this.hass.areas[this.config.area];
                if (area) {
                    this.area = area;
                    this.areaEntities = MinimalisticAreaCard.findAreaEntities(this.hass, area.area_id);
                }
                else {
                    this.area = undefined;
                    this.areaEntities = undefined;
                }
            }
            else {
                this.area = undefined;
                this.areaEntities = undefined;
            }
        }
        else {
            console.error("Invalid hass connection");
        }
    }

    _entitiesSensor: Array<ExtendedEntityConfig> = [];
    _entitiesButtons: Array<EntitiesCardEntityConfig> = [];
    _entitiesTemplated: Array<ExtendedEntityConfig> = [];

    setEntities() {
        if (!this.configChanged && this.areaEntities?.length == this.previowsAreaEntitiesCount) {
            // Don't refresh entities unless config changed or a new entity was added into area
            return;
        }
        this._entitiesSensor = [];
        this._entitiesButtons = [];
        this._entitiesTemplated = [];

        const entities = this.config?.entities || this.areaEntities || [];

        entities.forEach((item) => {

            const entity = this.parseEntity(item);
            if (entity != null && entity.entity != null) {
                const sectionParsed = this._getOrDefault(entity.entity, entity.section, EntitySection.auto);
                let section = sectionParsed in EntitySection ? sectionParsed : EntitySection.auto;

                // eslint-disable-next-line  @typescript-eslint/no-unused-vars
                const [domain, _] = entity.entity.split('.');

                if (section == EntitySection.auto) {
                    section = (SENSORS.indexOf(domain) !== -1 || entity.attribute) ? EntitySection.sensors : EntitySection.buttons;
                }
                if (section == EntitySection.sensors) {
                    this._entitiesSensor.push(entity);
                } else {
                    this._entitiesButtons.push(entity);
                }
            }
        });
        if (this.config) {
            this._parseTemplatedEntities(this.config)
        }
    }

    parseEntity(item: ExtendedEntityConfig | string) {
        if (typeof item === "string")
            return {
                entity: item
            } as ExtendedEntityConfig;
        else
            return item;
    }

    _handleEntityAction(ev: ActionHandlerEvent) {
        const config = (ev.currentTarget as any).config;
        handleAction(this, this.hass, config, ev.detail.action);
    }

    _handleThisAction(ev: ActionHandlerEvent) {
        const parent = ((ev.currentTarget as HTMLElement).getRootNode() as any)?.host?.parentElement as HTMLElement;
        if (this.hass && this.config && ev.detail.action && (!parent || parent.tagName !== "HUI-CARD-PREVIEW")) {
            handleAction(this, this.hass, this.config, ev.detail.action);
        }
    }

    _parseTemplatedEntities(obj: any) {
        if (obj == null || obj == undefined) {
            return;
        }
        const type = typeof obj;
        if (type == 'object') {
            Object.keys(obj).forEach(key => {
                this._parseTemplatedEntities(obj[key])
            })
        } else if (type == 'string' && obj.trim().startsWith("${") && obj.trim().endsWith("}")) {
            const entities = [...obj.trim().matchAll(this._templatedEntityNameRegexp)]
            entities?.forEach(match => {
                if (match[1] != undefined && (match[1] in this.hass.states)) {
                    const entityConf = this.parseEntity(match[1])
                    const founded = this._entitiesTemplated.filter((i) => i.entity == entityConf.entity)
                    if (founded.length == 0) {
                        this._entitiesTemplated.push(entityConf)
                    }
                }
            })
        }
    }
    // The user supplied configuration. Throw an exception and Home Assistant
    // will render an error card.
    setConfig(config: MinimalisticAreaCardConfig) {

        if (
            !config ||
            (config.entities &&
                !Array.isArray(config.entities))
        ) {
            throw new Error("Invalid configuration");
        }

        this.config = {
            hold_action: { action: "more-info" },
            align: {
                title: Alignment.left,
                sensors: Alignment.left,
                buttons: Alignment.right,
            },
            ...config,
        };
        this.configChanged = true;
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    getCardSize() {
        return 3;
    }

    render() {
        if (!this.config || !this.hass) {
            return html``;
        }

        const background_color = this.config.background_color ? `background-color: ${this.config.background_color}` : "";
        let imageUrl: string | undefined = undefined;
        if (!this.config.camera_image && (this.config.image || this.area?.picture)) {
            imageUrl = (new URL(this.config.image || this.area?.picture || "", this.hass.auth.data.hassUrl)).toString();
        }


        return html`
        <ha-card @action=${this._handleThisAction} style=${background_color} .actionHandler=${actionHandler({
            hasHold:
                hasAction(this.config.hold_action), hasDoubleClick: hasAction(this.config.double_tap_action),
        })}
            tabindex=${ifDefined(hasAction(this.config.tap_action) ? "0" : undefined)}>
            ${imageUrl ? html`<img src=${imageUrl} class=${classMap({
            "darken"
                : this.config.darken_image === undefined ? false : this.config.darken_image,
        })} />` : null}
            ${this.config.camera_image ? html`<div class=${classMap({
            "camera": true,
            "darken"
                : this.config.darken_image === undefined ? false : this.config.darken_image,
        })}>
                <hui-image
                    .hass=${this.hass}
                    .cameraImage=${this.config.camera_image}
                    .entity=${this.config.camera_image}
                    .cameraView=${this.config.camera_view || "auto"}
                    .width=${'100%'}></hui-image>
            </div>` : null}

            <div class="box">
                <div class="card-header align-${this.config.align?.title}">${this.renderAreaIcon(this.config)}${this.config.title}</div>
                <div class="sensors align-${this.config.align?.sensors}">
                    ${this._entitiesSensor.map((entityConf) => this.renderEntity(entityConf, true))}
                </div>
                <div class="buttons align-${this.config.align?.buttons}">
                    ${this._entitiesButtons.map((entityConf) => this.renderEntity(entityConf, false))}
                </div>
            </div>
        </ha-card>
    `;
    }

    renderAreaIcon(areaConfig: MinimalisticAreaCardConfig) {
        if (this._getOrDefault(null, areaConfig.icon, "").trim().length == 0 || !this._getOrDefault(null, areaConfig.show_area_icon, true)) {
            return html``;
        }
        return html`
        <ha-icon icon=${ifDefined(areaConfig.icon)}></ha-icon>
        `;
    }

    renderEntity(
        entityConf: ExtendedEntityConfig,
        isSensor: boolean
    ) {
        const stateObj = this.hass.states[entityConf.entity];
        if (stateObj == undefined) {
            return html``;
        }
        const entity = this.hass.entities[entityConf.entity] as EntityRegistryDisplayEntry;
        const entityId = entity.entity_id

        // eslint-disable-next-line  @typescript-eslint/no-unused-vars
        const [domain, _] = stateObj.entity_id.split(".");

        const dialog = this._getOrDefault(entityId, entityConf.force_dialog, false) || DOMAINS_TOGGLE.indexOf(domain) === -1

        let show_state = true
        if (entityConf.show_state === undefined) {
            // added for backward compatibility: hide state by default for binary_sensors
            show_state = domain === "binary_sensor" ? false : true
        } else {
            show_state = !!entityConf.show_state
        }

        entityConf = {
            tap_action: { action: dialog ? "more-info" : "toggle" },
            hold_action: { action: "more-info" },
            show_state: show_state,
            ...entityConf,
        };

        if (this._getOrDefault(entityId, entityConf.hide, false)) {
            return html``;
        }

        if ((!stateObj || stateObj.state === UNAVAILABLE) && !this.config.hide_unavailable) {
            return html`
            <div class="wrapper">
                <hui-warning-element .label=${createEntityNotFoundWarning(this.hass, entityConf.entity)} class=${classMap({
                "shadow"
                    : this.config.shadow === undefined ? false : this.config.shadow,
            })}></hui-warning-element>
            </div>
      `;
        }
        else if ((!stateObj || stateObj.state === UNAVAILABLE) && this.config.hide_unavailable) {
            return html``;
        }

        const active = stateObj && stateObj.state && STATES_OFF.indexOf(stateObj.state.toString().toLowerCase()) === -1;
        const title = `${stateObj.attributes?.friendly_name || stateObj.entity_id}: ${computeStateDisplay(this.hass?.localize, stateObj, this.hass?.locale)}`;

        let icon = entityConf.icon
        let color = entityConf.color
        let hide = false

        if (entityConf.state !== undefined && entityConf.state.length > 0) {
            const currentState = this.computeStateValue(stateObj, entity)
            const stateConfig = entityConf.state.filter((i) => i.value == currentState)[0]
            if (stateConfig) {
                icon = this._getOrDefault(entityId, stateConfig.icon, entityConf.icon)
                color = this._getOrDefault(entityId,stateConfig.color, entityConf.color)
                hide = this._getOrDefault(entityId, stateConfig.hide, false)
            }
        }
        if (hide) {
            return html``;
        }

        return html`
    <div class="wrapper">
        <ha-icon-button @action=${this._handleEntityAction} .actionHandler=${actionHandler({
            hasHold:
                hasAction(entityConf.hold_action), hasDoubleClick: hasAction(entityConf.double_tap_action),
        })}
            .config=${entityConf} class=${classMap({ "state-on": active, })}>
            <state-badge .hass=${this.hass} .stateObj=${stateObj} .title=${title} .overrideIcon=${icon}
                .stateColor=${entityConf.state_color !== undefined ? entityConf.state_color : this.config.state_color
                !== undefined ? this.config.state_color : true} .color=${color} class=${classMap({
                    "shadow": this.config.shadow === undefined
                        ? false : this.config.shadow,
                })}></state-badge>
        </ha-icon-button>
        ${isSensor && entityConf.show_state ? html`
        <div class="state">
            ${entityConf.attribute
                    ? html`
            ${entityConf.prefix}
            ${stateObj.attributes[entityConf.attribute]}
            ${entityConf.suffix}
            `
                    : this.computeStateValue(stateObj, entity)}
        </div>
        ` : null}
    </div>
    `;
    }

    isNumericState(stateObj: HassEntity) {
        return !!stateObj.attributes.unit_of_measurement ||
            !!stateObj.attributes.state_class;
    }

    computeStateValue(stateObj: HassEntity, entity?: EntityRegistryDisplayEntry) {
        // eslint-disable-next-line  @typescript-eslint/no-unused-vars
        const [domain, _] = stateObj.entity_id.split(".");
        if (this.isNumericState(stateObj)) {
            const value = Number(stateObj.state);
            if (isNaN(value))
                return null;
            else {
                const opt = this.getNumberFormatOptions(stateObj, entity);
                const str = this.formatNumber(value, this.hass.locale, opt);
                return `${str}${stateObj.attributes.unit_of_measurement
                    ? " " + stateObj.attributes.unit_of_measurement
                    : ""}`;
            }
        }
        else if (stateObj.state !== "unavailable" && stateObj.state !== "idle") {
            return stateObj.state;
        }
        else {
            return null;
        }
    }

    /**
 * Checks if the current entity state should be formatted as an integer based on the `state` and `step` attribute and returns the appropriate `Intl.NumberFormatOptions` object with `maximumFractionDigits` set
 * @param entityState The state object of the entity
 * @returns An `Intl.NumberFormatOptions` object with `maximumFractionDigits` set to 0, or `undefined`
 */
    getNumberFormatOptions(
        entityState: HassEntity,
        entity?: EntityRegistryDisplayEntry
    ): Intl.NumberFormatOptions | undefined {
        const precision = entity?.display_precision;
        if (precision != null) {
            return {
                maximumFractionDigits: precision,
                minimumFractionDigits: precision,
            };
        }
        if (
            Number.isInteger(Number(entityState.attributes?.step)) &&
            Number.isInteger(Number(entityState.state))
        ) {
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
    formatNumber(
        num: string | number,
        localeOptions?: FrontendLocaleData,
        options?: Intl.NumberFormatOptions
    ): string {
        const locale = localeOptions ? numberFormatToLocale(localeOptions) : undefined;

        // Polyfill for Number.isNaN, which is more reliable than the global isNaN()
        Number.isNaN =
            Number.isNaN ||
            function isNaN(input) {
                return typeof input === "number" && isNaN(input);
            };

        if (localeOptions?.number_format !== NumberFormat.none && !Number.isNaN(Number(num)) && Intl) {
            try {
                return new Intl.NumberFormat(locale, this.getDefaultFormatOptions(num, options)).format(
                    Number(num)
                );
            } catch (err: any) {
                // Don't fail when using "TEST" language
                // eslint-disable-next-line no-console
                console.error(err);
                return new Intl.NumberFormat(undefined, this.getDefaultFormatOptions(num, options)).format(
                    Number(num)
                );
            }
        }
        if (typeof num === "string") {
            return num;
        }
        return `${round(num, options?.maximumFractionDigits).toString()}${options?.style === "currency" ? ` ${options.currency}` : ""
            }`;
    }

    /**
 * Generates default options for Intl.NumberFormat
 * @param num The number to be formatted
 * @param options The Intl.NumberFormatOptions that should be included in the returned options
 */
    getDefaultFormatOptions(
        num: string | number,
        options?: Intl.NumberFormatOptions
    ): Intl.NumberFormatOptions {
        const defaultOptions: Intl.NumberFormatOptions = {
            maximumFractionDigits: 2,
            ...options,
        };

        if (typeof num !== "string") {
            return defaultOptions;
        }

        // Keep decimal trailing zeros if they are present in a string numeric value
        if (
            !options ||
            (options.minimumFractionDigits === undefined && options.maximumFractionDigits === undefined)
        ) {
            const digits = num.indexOf(".") > -1 ? num.split(".")[1].length : 0;
            defaultOptions.minimumFractionDigits = digits;
            defaultOptions.maximumFractionDigits = digits;
        }

        return defaultOptions;
    }

    shouldUpdate(changedProps) {
        if (hasConfigOrEntityChanged(this, changedProps, false)) {
            return true;
        }

        const oldHass = changedProps.get("hass");

        if (
            !oldHass ||
            oldHass.themes !== this.hass.themes ||
            oldHass.locale !== this.hass.locale
        ) {
            return true;
        }
        for (const entity of [...this._entitiesButtons, ...this._entitiesSensor, ...this._entitiesTemplated]) {
            if (
                oldHass.states[entity.entity] !== this.hass.states[entity.entity]
            ) {
                return true;
            }
        }

        return false;
    }

     _evalTemplate(entity: string|null, func: string) {
        /* eslint no-new-func: 0 */
        try {
            return new Function(
                'hass',
                'state',
                'html',
                `'use strict'; ${func}`,
            ).call(
                this,
                this.hass,
                entity != null ? this.hass.states[entity].state: null,
                html,
            );
        } catch (e: any) {
          const funcTrimmed = func.length <= 100 ? func.trim() : `${func.trim().substring(0, 98)}...`;
          e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
          e.name = 'MinimalistAreaCardJSTemplateError';
          throw e;
        }
    }

    _getOrDefault(entity: string|null, value: any, defaultValue) : any {
        if (value == undefined) {
            return defaultValue;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim()
            if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
                return this._evalTemplate(entity, trimmed.slice(2, -1))
            }
        }
        return value;
    }

    static findAreaEntities(hass: HomeAssistantExt, area_id: string) {
        const area = hass.areas && hass.areas[area_id];
        const areaEntities = hass.entities && area &&
            Object.keys(hass.entities)
                .filter((e) =>
                    !hass.entities[e].disabled_by &&
                    !hass.entities[e].hidden &&
                    hass.entities[e].entity_category !== "diagnostic" &&
                    hass.entities[e].entity_category !== "config" && (
                        hass.entities[e].area_id === area.area_id ||
                        hass.devices[hass.entities[e].device_id || ""]?.area_id === area.area_id
                    )
                )
                .map((x) => x);
        return areaEntities;
    }

    static getStubConfig(hass: HomeAssistantExt,
        entities: string[],
        entitiesFallback: string[]) {

        const area = hass.areas && hass.areas[Object.keys(hass.areas)[0]];
        const areaEntities = MinimalisticAreaCard.findAreaEntities(hass, area.area_id);

        const lights = findEntities(
            hass,
            2,
            areaEntities?.length ? areaEntities : entities,
            entitiesFallback,
            ["light"]
        );
        const switches = findEntities(
            hass,
            2,
            areaEntities?.length ? areaEntities : entities,
            entitiesFallback,
            ["switch"]
        );

        const sensors = findEntities(
            hass,
            2,
            areaEntities?.length ? areaEntities : entities,
            entitiesFallback,
            ["sensor"]
        );
        const binary_sensors = findEntities(
            hass,
            2,
            areaEntities?.length ? areaEntities : entities,
            entitiesFallback,
            ["binary_sensor"]
        );

        const obj = {
            title: "Kitchen",
            image: "https://demo.home-assistant.io/stub_config/kitchen.png",
            area: "",
            hide_unavailable: false,
            tap_action: {
                action: "navigate",
                navigation_path: "/lovelace-kitchen"
            },
            entities: [...lights, ...switches, ...sensors, ...binary_sensors],
        } as MinimalisticAreaCardConfig;
        if (area) {
            obj.area = area.area_id;
            obj.title = area.name;
            (obj.tap_action as NavigateActionConfig).navigation_path = "/config/areas/area/" + area.area_id;
            delete obj.image;
        }
        else {
            delete obj.area;
        }
        return obj;
    }

    static get styles() {
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
          border-radius: var(--ha-card-border-radius, 12px)
      }

      .darken {
        filter: brightness(0.55);
      }

      div.camera {
          height: 100%;
          width: 100%;
          overflow: hidden;

          position: absolute;
          left: 0; top: 0;

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

        width: 100%; height: 100%;

        padding: 0;
        font-size: 14px;
        color: var(--ha-picture-card-text-color, white);
        z-index: 1;
      }

      .box .card-header {
        padding: 10px 15px;
        font-weight: bold;
        font-size: 1.2em;
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

      .box .buttons {
          display: block;
          background-color: var( --ha-picture-card-background-color, rgba(0, 0, 0, 0.1) );
          background-color: transparent;
          padding-top: 10px;
          padding-bottom: 10px;
          min-height: 10px;
          width: 100%;

          margin-top:auto;
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
      .box ha-icon-button.state-on state-badge {
          color: var(--ha-picture-icon-button-on-color, white);
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



customElements.define(cardType, MinimalisticAreaCard);

const theWindow = window as any;
theWindow.customCards = theWindow.customCards || [];
theWindow.customCards.push({
    type: cardType,
    name: "Minimalistic Area",
    preview: true, // Optional - defaults to false
    description: "Minimalistic Area Card" // Optional
});
