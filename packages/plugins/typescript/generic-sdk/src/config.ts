import { RawClientSideBasePluginConfig } from 'webql-codegen-visitor-plugin-common';

export interface RawGenericSdkPluginConfig extends RawClientSideBasePluginConfig {
  /**
   * usingObservableFrom: "import Observable from 'zen-observable';"
   * OR
   * usingObservableFrom: "import { Observable } from 'rxjs';"
   */
  usingObservableFrom?: string;
}
