import {
  ActionConfig,
  EntityConfig,
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
  EntitiesCardEntityConfig,
  STATES_OFF as STATES_OFF_HELPER,
} from '@dermotduffy/custom-card-helpers';
import { name } from '../package.json';
declare global {
  interface HTMLElementTagNameMap {
    'minimalistic-area-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

export const cssCardVariablesPrefix = '--ha-better-minimalistic-area-card-';

export enum Alignment {
  left = 'left',
  right = 'right',
  center = 'center',
}

export type AlignmentConfig = {
  title?: Alignment;
  sensors?: Alignment;
  buttons?: Alignment;
  title_entities?: Alignment;
};

export interface MinimalisticAreaCardConfig extends LovelaceCardConfig {
  type: string;
  title?: string;
  image?: string;
  area?: string;
  camera_image?: string;
  camera_view?: 'auto' | 'live';
  /** @deprecated use style.background_color */
  background_color?: string;
  hide_unavailable?: boolean;
  icon?: string;
  show_area_icon?: boolean;
  entities?: Array<EntityConfig | string>;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  shadow?: boolean;
  state_color?: boolean;
  darken_image?: boolean;
  align?: AlignmentConfig;
  style?: StyleOptions;
  grid_options?: LovelaceCardGridOptions;
}

export interface StyleOptions {
  color?: string;
  background_color?: string;
  shadow_color?: string;
  sensors_color?: string;
  sensors_icon_size?: string;
  sensors_button_size?: string;
  buttons_icon_size?: string;
  buttons_button_size?: string;
  buttons_color?: string;
}

export interface LovelaceCardGridOptions {
  rows: number;
  columns: number;
  min_rows?: number;
  min_columns?: number;
}

export interface HomeAssistantArea {
  area_id: string;
  picture: string;
  name: string;
  icon?: string;
}

export enum EntitySection {
  auto = 'auto',
  sensors = 'sensors',
  buttons = 'buttons',
  title = 'title',
}

export type ExtendedEntityConfig = EntitiesCardEntityConfig & {
  prefix?: string;
  suffix?: string;
  show_state?: boolean;
  force_dialog?: boolean;
  hide?: boolean;
  attribute?: string;
  color?: string;
  state?: EntityStateConfig[];
  section?: EntitySection;
  unit_of_measurement?: string;
  hide_unavailable?: boolean;
};

export type EntityStateConfig = {
  operator?: '<' | '<=' | '==' | '>=' | '>' | '!=' | 'regex' | 'template' | 'default';
  value: string;
  icon?: string;
  color?: string;
  hide?: boolean;
  hide_unavailable?: boolean;
};

export interface EntityRegistryDisplayEntry {
  entity_id: string;
  name?: string;
  device_id?: string;
  area_id?: string;
  hidden?: boolean;
  entity_category?: 'config' | 'diagnostic';
  translation_key?: string;
  platform?: string;
  display_precision?: number;
}

export const UNAVAILABLE = 'unavailable';
export const STATES_OFF = [...STATES_OFF_HELPER, UNAVAILABLE, 'idle', 'disconnected'];
export const cardType = name;

export type HomeAssistantExt = HomeAssistant & {
  areas: { [key: string]: HomeAssistantArea };
  entities: {
    [key: string]: {
      area_id?: string;
      entity_id: string;
      device_id?: string;
      entity_category?: string;
      disabled_by?: string;
      hidden: boolean;
    };
  };
  devices: { [key: string]: { area_id?: string; disabled_by?: string } };
};
