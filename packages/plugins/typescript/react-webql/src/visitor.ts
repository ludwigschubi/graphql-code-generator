import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  getConfigValue,
  LoadedFragment,
  DocumentMode,
} from 'webql-codegen-visitor-plugin-common';
import { ReactWebQLRawPluginConfig } from './config';
import autoBind from 'auto-bind';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { Types } from 'webql-codegen-plugin-helpers';
import { pascalCase } from 'pascal-case';
import { camelCase } from 'camel-case';

const WEBQL_HOOKS_UNIFIED_PACKAGE = `webql-hooks`;
const WEBQL_CLIENT_HOOKS_IDENTIFIER = 'webQLClient';
const GROUPED_WEBQL_CLIENT_IDENTIFIER = 'WebQLClient';

export interface WebQLPluginConfig extends ClientSideBasePluginConfig {
  withComponent: boolean;
  withHOC: boolean;
  withHooks: boolean;
  withMutationFn: boolean;
  withRefetchFn: boolean;
  webqlSchemaImportFrom: string;
  webqlClientImportIdentifier: string;
  webqlClientHooksImportFrom: string;
  webqlClientHooksIdentifier: string;
  componentSuffix: string;
  WebQLVersion: 2 | 3;
  withResultType: boolean;
  withMutationOptionsType: boolean;
  addDocBlocks: boolean;
}

export class WebQLVisitor extends ClientSideBaseVisitor<ReactWebQLRawPluginConfig, WebQLPluginConfig> {
  private _externalImportPrefix: string;
  private imports = new Set<string>();

  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    protected rawConfig: ReactWebQLRawPluginConfig,
    documents: Types.DocumentFile[]
  ) {
    super(schema, fragments, rawConfig, {
      componentSuffix: getConfigValue(rawConfig.componentSuffix, 'Component'),
      withHOC: getConfigValue(rawConfig.withHOC, false),
      withComponent: getConfigValue(rawConfig.withComponent, false),
      withHooks: getConfigValue(rawConfig.withHooks, true),
      withMutationFn: getConfigValue(rawConfig.withMutationFn, true),
      withRefetchFn: getConfigValue(rawConfig.withRefetchFn, false),
      webqlClientHooksImportFrom: getConfigValue(rawConfig.webqlClientHooksImportFrom, WEBQL_HOOKS_UNIFIED_PACKAGE),
      webqlClientHooksIdentifier: getConfigValue(rawConfig.webqlClientHooksIdentifier, WEBQL_CLIENT_HOOKS_IDENTIFIER),
      webqlClientImportIdentifier: getConfigValue(
        rawConfig.webqlClientImportIdentifier,
        GROUPED_WEBQL_CLIENT_IDENTIFIER
      ),
      webqlSchemaImportFrom: getConfigValue(rawConfig.webqlSchemaImportFrom, './schema.ts'),
      WebQLVersion: getConfigValue(rawConfig.WebQLVersion, 3),
      withResultType: getConfigValue(rawConfig.withResultType, true),
      withMutationOptionsType: getConfigValue(rawConfig.withMutationOptionsType, true),
      addDocBlocks: getConfigValue(rawConfig.addDocBlocks, true),
      gqlImport: getConfigValue(rawConfig.gqlImport, 'graphql-tag'),
    });

    this._externalImportPrefix = this.config.importOperationTypesFrom ? `${this.config.importOperationTypesFrom}.` : '';
    this._documents = documents;

    autoBind(this);
  }

  private getImportStatement(isTypeImport: boolean): string {
    return isTypeImport && this.config.useTypeImports ? 'import type' : 'import';
  }

  // private getReactImport(): string {
  //   return `import * as React from 'react';`;
  // }

  private getWebQLClientHooksImportFrom(): string {
    return this.rawConfig.webqlClientHooksImportFrom ?? WEBQL_HOOKS_UNIFIED_PACKAGE;
  }

  private getWebQLClientHooksIdentifier(): string {
    return this.rawConfig.webqlClientHooksIdentifier ?? WEBQL_CLIENT_HOOKS_IDENTIFIER;
  }

  private getWebQLClientImportIdentifier(): string {
    return this.rawConfig.webqlClientImportIdentifier ?? GROUPED_WEBQL_CLIENT_IDENTIFIER;
  }

  private getWebQLClientHooksImport(isTypeImport: boolean): string {
    return `${this.getImportStatement(
      isTypeImport
    )} { WebQLClient as Client } from '${this.getWebQLClientHooksImportFrom()}';`;
  }

  private getWebQLClientImport(isTypeImport: boolean): string {
    return `${this.getImportStatement(
      isTypeImport
    )} * as ${this.getWebQLClientImportIdentifier()} from '${this.getWebQLClientHooksImportFrom()}';`;
  }

  private getWebQLSchemaImport(): string {
    return `import { schema } from '${this.config.webqlSchemaImportFrom}';`;
  }

  private getWebQLClient(): string {
    return `const ${this.getWebQLClientHooksIdentifier()} = new Client(schema);`;
  }

  // private getOmitDeclaration(): string {
  //   return OMIT_TYPE;
  // }

  private getDocumentNodeVariable(node: OperationDefinitionNode, documentVariableName: string): string {
    return this.config.documentMode === DocumentMode.external
      ? `Operations.${node.name?.value ?? ''}`
      : documentVariableName;
  }

  public getImports(): string[] {
    const baseImports = super.getImports();
    const hasOperations = this._collectedOperations.length > 0;

    if (!hasOperations) {
      return baseImports;
    }

    return [...baseImports, ...Array.from(this.imports)];
  }

  // private _buildHocProps(operationName: string, operationType: string): string {
  //   const typeVariableName =
  //     this._externalImportPrefix +
  //     this.convertName(operationName + pascalCase(operationType) + this._parsedConfig.operationResultSuffix);
  //   const variablesVarName =
  //     this._externalImportPrefix + this.convertName(operationName + pascalCase(operationType) + 'Variables');
  //   const typeArgs = `<${typeVariableName}, ${variablesVarName}>`;

  //   if (operationType === 'mutation') {
  //     this.imports.add(this.getWebQLClientImport(true));

  //     return `${this.getWebQLClientHooksIdentifier()}.MutationFunction${typeArgs}`;
  //   } else {
  //     this.imports.add(this.getreactQueryHocImport(true));

  //     return `reactQueryHoc.DataValue${typeArgs}`;
  //   }
  // }

  private _buildMutationFn(
    node: OperationDefinitionNode,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    if (node.operation === 'mutation') {
      this.imports.add(this.getWebQLClientImport(true));
      return `export type ${this.convertName(
        (node.name?.value ?? '') + 'MutationFn'
      )} = ${this.getWebQLClientHooksIdentifier()}.MutationFunction<${operationResultType}, ${operationVariablesTypes}>;`;
    }
    return null;
  }

  //   private _buildOperationHoc(
  //     node: OperationDefinitionNode,
  //     documentVariableName: string,
  //     operationResultType: string,
  //     operationVariablesTypes: string
  //   ): string {
  //     this.imports.add(this.getWebQLClientImport(false));
  //     this.imports.add(this.getreactQueryHocImport(false));
  //     const nodeName = node.name?.value ?? '';
  //     const operationName: string = this.convertName(nodeName, { useTypesPrefix: false });
  //     const propsTypeName: string = this.convertName(nodeName, { suffix: 'Props' });

  //     const defaultDataName = node.operation === 'mutation' ? 'mutate' : 'data';
  //     const propsVar = `export type ${propsTypeName}<TChildProps = {}, TDataName extends string = '${defaultDataName}'> = {
  //       [key in TDataName]: ${this._buildHocProps(nodeName, node.operation)}
  //     } & TChildProps;`;

  //     const hocString = `export function with${operationName}<TProps, TChildProps = {}, TDataName extends string = '${defaultDataName}'>(operationOptions?: reactQueryHoc.OperationOption<
  //   TProps,
  //   ${operationResultType},
  //   ${operationVariablesTypes},
  //   ${propsTypeName}<TChildProps, TDataName>>) {
  //     return reactQueryHoc.with${pascalCase(
  //       node.operation
  //     )}<TProps, ${operationResultType}, ${operationVariablesTypes}, ${propsTypeName}<TChildProps, TDataName>>(${this.getDocumentNodeVariable(
  //       node,
  //       documentVariableName
  //     )}, {
  //       alias: '${camelCase(operationName)}',
  //       ...operationOptions
  //     });
  // };`;

  //     return [propsVar, hocString].filter(a => a).join('\n');
  //   }

  // private _buildComponent(
  //   node: OperationDefinitionNode,
  //   documentVariableName: string,
  //   operationType: string,
  //   operationResultType: string,
  //   operationVariablesTypes: string
  // ): string {
  //   const nodeName = node.name?.value ?? '';
  //   const componentPropsName: string = this.convertName(nodeName, {
  //     suffix: this.config.componentSuffix + 'Props',
  //     useTypesPrefix: false,
  //   });
  //   const componentName: string = this.convertName(nodeName, {
  //     suffix: this.config.componentSuffix,
  //     useTypesPrefix: false,
  //   });

  //   const isVariablesRequired =
  //     operationType === 'Query' &&
  //     node.variableDefinitions.some(variableDef => variableDef.type.kind === Kind.NON_NULL_TYPE);

  //   this.imports.add(this.getReactImport());
  //   this.imports.add(this.getWebQLClientImport(true));
  //   this.imports.add(this.getreactQueryComponentsImport(false));
  //   this.imports.add(this.getOmitDeclaration());

  //   const propsType = `Omit<reactQueryComponents.${operationType}ComponentOptions<${operationResultType}, ${operationVariablesTypes}>, '${operationType.toLowerCase()}'>`;
  //   let componentProps = '';
  //   if (isVariablesRequired) {
  //     componentProps = `export type ${componentPropsName} = ${propsType} & ({ variables: ${operationVariablesTypes}; skip?: boolean; } | { skip: boolean; });`;
  //   } else {
  //     componentProps = `export type ${componentPropsName} = ${propsType};`;
  //   }

  //   const component = `
  //   export const ${componentName} = (props: ${componentPropsName}) => (
  //     <reactQueryComponents.${operationType}<${operationResultType}, ${operationVariablesTypes}> ${
  //     node.operation
  //   }={${this.getDocumentNodeVariable(node, documentVariableName)}} {...props} />
  //   );
  //   `;
  //   return [componentProps, component].join('\n');
  // }

  private _buildHooksJSDoc(node: OperationDefinitionNode, operationName: string, operationType: string): string {
    const variableString = node.variableDefinitions.reduce((acc, item) => {
      const name = item.variable.name.value;

      return `${acc}\n *      ${name}: // value for '${name}'`;
    }, '');

    const queryDescription = `
 * To run a query within a React component, call \`use${operationName}\` and pass it any options that fit your needs.
 * When your component renders, \`use${operationName}\` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.`;

    const queryExample = `
 * const { data, loading, error } = use${operationName}({
 *   variables: {${variableString}
 *   },
 * });`;

    const mutationDescription = `
 * To run a mutation, you first call \`use${operationName}\` within a React component and pass it any options that fit your needs.
 * When your component renders, \`use${operationName}\` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution`;

    const mutationExample = `
 * const [${camelCase(operationName)}, { data, loading, error }] = use${operationName}({
 *   variables: {${variableString}
 *   },
 * });`;

    return `
/**
 * __use${operationName}__
 *${operationType === 'Mutation' ? mutationDescription : queryDescription}
 *
 * @param baseOptions options that will be passed into the ${operationType.toLowerCase()}, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#${
      operationType === 'Mutation' ? 'options-2' : 'options'
    };
 *
 * @example${operationType === 'Mutation' ? mutationExample : queryExample}
 */`;
  }

  private _buildHooks(
    node: OperationDefinitionNode,
    operationType: string,
    documentVariableName: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    const nodeName = node.name?.value ?? '';
    const suffix = this._getHookSuffix(nodeName, operationType);
    const operationName: string = this.convertName(nodeName, {
      suffix,
      useTypesPrefix: false,
    });

    this.imports.add(this.getWebQLClientImport(true));
    this.imports.add(this.getWebQLClientImport(false));
    this.imports.add(this.getWebQLClientHooksImport(true));
    this.imports.add(this.getWebQLClientHooksImport(false));
    this.imports.add(this.getWebQLSchemaImport());
    this.imports.add(this.getWebQLClient());

    const hookFns = [
      `export function use${operationName}(baseOptions?: ${this.getWebQLClientImportIdentifier()}.${operationType}HookOptions<${operationResultType}, ${operationVariablesTypes}>) {
        return ${this.getWebQLClientHooksIdentifier()}.use${operationType}<typeof ${documentVariableName}, ${operationVariablesTypes}, ${operationResultType}>(${this.getDocumentNodeVariable(
        node,
        documentVariableName
      )}, baseOptions);
      }`,
    ];

    if (this.config.addDocBlocks) {
      hookFns.unshift(this._buildHooksJSDoc(node, operationName, operationType));
    }

    const hookResults = [`export type ${operationName}HookResult = ReturnType<typeof use${operationName}>;`];

    // if (operationType === 'Query') {
    //   const lazyOperationName: string = this.convertName(nodeName, {
    //     suffix: pascalCase('LazyQuery'),
    //     useTypesPrefix: false,
    //   });
    //   hookFns.push(
    //     `export function use${lazyOperationName}(baseOptions?: ${this.getWebQLClientImportIdentifier()}.LazyQueryHookOptions<${operationResultType}, ${operationVariablesTypes}>) {
    //       return ${this.getWebQLClientHooksIdentifier()}.useLazyQuery<${operationResultType}, ${operationVariablesTypes}>(${this.getDocumentNodeVariable(
    //       node,
    //       documentVariableName
    //     )}, baseOptions);
    //     }`
    //   );
    //   hookResults.push(`export type ${lazyOperationName}HookResult = ReturnType<typeof use${lazyOperationName}>;`);
    // }

    return [...hookFns, ...hookResults].join('\n');
  }

  private _getHookSuffix(name: string, operationType: string) {
    if (this.config.omitOperationSuffix) {
      return '';
    }
    if (!this.config.dedupeOperationSuffix) {
      return pascalCase(operationType);
    }
    if (name.includes('Query') || name.includes('Mutation') || name.includes('Subscription')) {
      return '';
    }
    return pascalCase(operationType);
  }

  private _buildResultType(
    node: OperationDefinitionNode,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    const componentResultType = this.convertName(node.name?.value ?? '', {
      suffix: `${operationType}Result`,
      useTypesPrefix: false,
    });

    switch (node.operation) {
      case 'query':
        this.imports.add(this.getWebQLClientImport(true));
        return `export type ${componentResultType} = ${this.getWebQLClientImportIdentifier()}.QueryResult<${operationResultType}>;`;
      case 'mutation':
        this.imports.add(this.getWebQLClientImport(true));
        return `export type ${componentResultType} = ${this.getWebQLClientImportIdentifier()}.MutationResult<${operationResultType}, ${operationVariablesTypes}>;`;
      // case 'subscription':
      //   this.imports.add(this.getWebQLClientImport(true));
      //   return `export type ${componentResultType} = ${this.getWebQLClientHooksIdentifier()}.SubscriptionResult<${operationResultType}>;`;
      default:
        return '';
    }
  }

  private _buildWithMutationOptionsType(
    node: OperationDefinitionNode,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    if (node.operation !== 'mutation') {
      return '';
    }

    this.imports.add(this.getWebQLClientImport(true));

    const mutationOptionsType = this.convertName(node.name?.value ?? '', {
      suffix: 'MutationOptions',
      useTypesPrefix: false,
    });

    return `export type ${mutationOptionsType} = ${this.getWebQLClientImportIdentifier()}.BaseMutationOptions<${operationResultType}, ${operationVariablesTypes}>;`;
  }

  private _buildRefetchFn(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationVariablesTypes: string
  ): string {
    if (node.operation !== 'query') {
      return '';
    }

    const nodeName = node.name?.value ?? '';
    const operationName: string = this.convertName(nodeName, {
      suffix: this._getHookSuffix(nodeName, operationType),
      useTypesPrefix: false,
    });

    return `export function refetch${operationName}(variables?: ${operationVariablesTypes}) {
      return { query: ${this.getDocumentNodeVariable(node, documentVariableName)}, variables: variables }
    }`;
  }

  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string {
    operationResultType = this._externalImportPrefix + operationResultType;
    operationVariablesTypes = this._externalImportPrefix + operationVariablesTypes;

    const mutationFn =
      this.config.withMutationFn || this.config.withComponent
        ? this._buildMutationFn(node, operationResultType, operationVariablesTypes)
        : null;
    // const component = this.config.withComponent
    //   ? this._buildComponent(node, documentVariableName, operationType, operationResultType, operationVariablesTypes)
    //   : null;
    // const hoc = this.config.withHOC
    //   ? this._buildOperationHoc(node, documentVariableName, operationResultType, operationVariablesTypes)
    //   : null;
    const hooks = this.config.withHooks
      ? this._buildHooks(node, operationType, documentVariableName, operationResultType, operationVariablesTypes)
      : null;
    const resultType = this.config.withResultType
      ? this._buildResultType(node, operationType, operationResultType, operationVariablesTypes)
      : null;
    const mutationOptionsType = this.config.withMutationOptionsType
      ? this._buildWithMutationOptionsType(node, operationResultType, operationVariablesTypes)
      : null;
    const refetchFn = this.config.withRefetchFn
      ? this._buildRefetchFn(node, documentVariableName, operationType, operationVariablesTypes)
      : null;

    return [mutationFn, hooks, resultType, mutationOptionsType, refetchFn].filter(a => a).join('\n');
  }
}
