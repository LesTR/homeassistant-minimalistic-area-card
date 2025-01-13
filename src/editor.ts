import { fireEvent, HomeAssistant, LovelaceCardConfig, LovelaceCardEditor } from '@dermotduffy/custom-card-helpers';
import { css, html, LitElement, TemplateResult } from 'lit';
import { MinimalisticAreaCardConfig } from './types';
import { customElement, property, query, state } from 'lit/decorators.js';

@customElement('better-minimalistic-area-card-editor')
export class BetterMinimalisticAreaCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant | undefined;
  @state() private config!: MinimalisticAreaCardConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @query('ha-yaml-editor') _yamlEditor?: any;

  private yamlChange = false; // true if the change came through the yaml editor

  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
    if (!this.yamlChange) {
      // YAML was changed externally, so update the editor
      this._yamlEditor?.setValue(config);
    }
    this.yamlChange = false;
  }

  protected render(): TemplateResult | void {
    if (!this.config) return html`loading...`;
    return html`
      <div class="instructions">
        For instructions, visit the
        <a href="https://github.com/LesTR/homeassistant-minimalistic-area-card" target="_blank"
          >Better Minimalistic Area Card Examples and Docs</a
        >.
      </div>
      <div class="yaml-editor">
        <ha-yaml-editor
          .defaultValue=${this.config}
          autofocus
          .hass=${this.hass}
          @value-changed=${this._handleYAMLChanged}
          @keydown=${this._ignoreKeydown}
          dir="ltr"
        ></ha-yaml-editor>
      </div>
    `;
  }

  private _ignoreKeydown(ev: KeyboardEvent) {
    ev.stopPropagation();
  }

  private _handleYAMLChanged(ev: CustomEvent) {
    ev.stopPropagation();
    const config = ev.detail.value;
    if (ev.detail.isValid) {
      this.yamlChange = true;
      this.config = config;
      fireEvent(this, 'config-changed', { config: this.config });
    }
  }

  static styles = css`
    .instructions {
      margin-bottom: 8px;
    }
    .instructions a {
      color: var(--mdc-theme-primary, #6200ee);
    }
  `;
}
