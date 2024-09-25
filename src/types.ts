import {
  ActionConfig,
  EntityConfig,
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
  EntitiesCardEntityConfig,
  STATES_OFF as STATES_OFF_HELPER,
} from '@dermotduffy/custom-card-helpers/dist';
import { name } from '../package.json';
declare global {
  interface HTMLElementTagNameMap {
    'minimalistic-area-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}
export enum Alignment {
  left = 'left',
  right = 'right',
  center = 'center',
}

export enum EntityType {
  auto = 'auto',
  sensor = 'sensor',
  button = 'button',
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
}

export interface HomeAssistantArea {
  area_id: string;
  picture: string;
  name: string;
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
  entity_type?: EntityType;
};

export type EntityStateConfig = {
  value: string;
  icon?: string;
  color?: string;
  hide?: boolean;
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
