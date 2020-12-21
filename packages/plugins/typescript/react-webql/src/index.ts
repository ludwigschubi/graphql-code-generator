import { Types, PluginValidateFn, PluginFunction } from 'webql-codegen-plugin-helpers';
import { visit, GraphQLSchema, concatAST, Kind, FragmentDefinitionNode } from 'graphql';
import { LoadedFragment } from 'webql-codegen-visitor-plugin-common';
import { WebQLVisitor } from './visitor';
import { extname } from 'path';
import { ReactWebQLRawPluginConfig } from './config';

export const plugin: PluginFunction<ReactWebQLRawPluginConfig, Types.ComplexPluginOutput> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: ReactWebQLRawPluginConfig
) => {
  const allAst = concatAST(documents.map(v => v.document));

  const allFragments: LoadedFragment[] = [
    ...(allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION) as FragmentDefinitionNode[]).map(
      fragmentDef => ({
        node: fragmentDef,
        name: fragmentDef.name.value,
        onType: fragmentDef.typeCondition.name.value,
        isExternal: false,
      })
    ),
    ...(config.externalFragments || []),
  ];

  const visitor = new WebQLVisitor(schema, allFragments, config, documents);
  const visitorResult = visit(allAst, { leave: visitor });

  return {
    prepend: visitor.getImports(),
    content: [visitor.fragments, ...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
  };
};

export const validate: PluginValidateFn<any> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: ReactWebQLRawPluginConfig,
  outputFile: string
) => {
  if (config.withComponent === true) {
    if (extname(outputFile) !== '.tsx') {
      throw new Error(
        `Plugin "typescript-react-webql" requires extension to be ".tsx" when withComponent: true is set!`
      );
    }
  } else {
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
      throw new Error(`Plugin "typescript-react-webql" requires extension to be ".ts" or ".tsx"!`);
    }
  }
};

export { WebQLVisitor };
