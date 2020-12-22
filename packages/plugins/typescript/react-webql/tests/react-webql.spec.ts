import { validateTs } from 'webql-codegen-testing';
import { plugin } from '../src/index';
import { ReactWebQLRawPluginConfig } from '../src/config';
import { parse, GraphQLSchema, buildClientSchema, buildSchema } from 'graphql';
import gql from 'graphql-tag';
import { Types, mergeOutputs } from 'webql-codegen-plugin-helpers';
import { plugin as tsPlugin } from 'webql-codegen-typescript/src';
import { plugin as tsDocumentsPlugin } from 'webql-codegen-typescript-operations/src';
import { DocumentMode } from 'webql-codegen-visitor-plugin-common';
import { extract } from 'jest-docblock';

describe('WebQL React', () => {
  let spyConsoleError: jest.SpyInstance;
  beforeEach(() => {
    spyConsoleError = jest.spyOn(console, 'warn');
    spyConsoleError.mockImplementation();
  });

  afterEach(() => {
    spyConsoleError.mockRestore();
  });

  const schema = buildClientSchema(require('../../../../../dev-test/githunt/schema.json'));
  const basicDoc = parse(/* GraphQL */ `
    query test {
      feed {
        id
        commentCount
        repository {
          example #full_name
          html_url
          owner {
            avatar_url
          }
        }
      }
    }
  `);
  const mutationDoc = parse(/* GraphQL */ `
    mutation test($name: String) {
      submitRepository(repoFullName: $name) {
        id
      }
    }
  `);

  const subscriptionDoc = parse(/* GraphQL */ `
    subscription test($name: String) {
      commentAdded(repoFullName: $name) {
        id
      }
    }
  `);

  const validateTypeScript = async (
    output: Types.PluginOutput,
    testSchema: GraphQLSchema,
    documents: Types.DocumentFile[],
    config: any,
    playground = false
  ) => {
    const tsOutput = await tsPlugin(testSchema, documents, config, { outputFile: '' });
    const tsDocumentsOutput = await tsDocumentsPlugin(testSchema, documents, config, { outputFile: '' });
    const merged = mergeOutputs([tsOutput, tsDocumentsOutput, output]);
    validateTs(merged, undefined, true, false, playground);

    return merged;
  };

  describe('Issues', () => {
    it('Issue #3612 - Missing fragments spread when fragment name is same as operation?', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            query Feed {
              feed {
                ...Feed
              }
            }

            fragment Feed on Feed {
              id
              commentCount
              repository {
                ...RepoFields
              }
            }

            fragment RepoFields on Repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          `),
        },
      ];
      const result = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(result.content).toBeSimilarStringTo(`    export const FeedDocument = gql\`
      query Feed {
    feed {
      ...Feed
    }
  }
      \${FeedFragmentDoc}\`;`);
    });

    it.skip('Issue #2742 - Incorrect import prefix', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            query GET_SOMETHING {
              feed {
                id
              }
            }
          `),
        },
      ];
      const config = {
        addDocBlocks: false,
        withHooks: true,
        withComponent: false,
        withHOC: false,
        skipTypename: true,
        importOperationTypesFrom: 'Types',
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      const output = await validateTypeScript(content, schema, docs, config);
      expect(mergeOutputs([output])).toMatchSnapshot();

      expect(output).toContain(
        `export type Get_SomethingQueryResult = QueryResult<Types.Get_SomethingQuery, Types.Get_SomethingQueryVariables>;`
      );
    });

    it.skip('Issue #2826 - Incorrect prefix', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            query GET_SOMETHING {
              feed {
                id
              }
            }
          `),
        },
      ];
      const config = {
        addDocBlocks: false,
        withHooks: true,
        withComponent: false,
        withHOC: false,
        skipTypename: true,
        typesPrefix: 'GQL',
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      const output = await validateTypeScript(content, schema, docs, config);
      expect(mergeOutputs([output])).toMatchSnapshot();

      expect(output).toContain(
        `export type Get_SomethingQueryResult = QueryResult<GQLGet_SomethingQuery, GQLGet_SomethingQueryVariables>;`
      );
    });

    it.skip('PR #2725 - transformUnderscore: true causes invalid output', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            query GET_SOMETHING {
              feed {
                id
              }
            }
          `),
        },
      ];
      const config = {
        addDocBlocks: false,
        withHooks: true,
        withComponent: false,
        withHOC: false,
        skipTypename: true,
        namingConvention: {
          typeNames: 'pascal-case#pascalCase',
          enumValues: 'keep',
          transformUnderscore: true,
        },
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };
      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      const output = await validateTypeScript(content, schema, docs, config);
      expect(mergeOutputs([output])).toMatchSnapshot();
      expect(output).toMatchSnapshot();
    });

    it.skip('Issue #2080 - noGraphQLTag does not work with fragments correctly', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            query test {
              feed {
                id
                commentCount
                repository {
                  ...RepositoryFields
                }
              }
            }

            fragment RepositoryFields on Repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          `),
        },
      ];
      const content = (await plugin(
        schema,
        docs,
        {
          noGraphQLTag: true,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;
      expect(
        content.content.split('{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RepositoryFields"}').length
      ).toBe(3);
    });
  });

  describe('Imports', () => {
    it('should import webql hooks dependencies', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import { WebQLClient as Client } from 'webql-hooks';`);
      expect(content.prepend).toContain(`import * as WebQLClient from 'webql-hooks';`);
      expect(content.prepend).toContain(`import { schema } from '../../../../../dev-test/githunt/schema.json';`);
      expect(content.prepend).toContain(`const webQLClient = new Client(schema);`);

      // To make sure all imports are unified correctly under Apollo namespaced import
      expect(content.content).toContain(` gql\``);
      await validateTypeScript(content, schema, docs, {});
    });

    it('should import DocumentNode when using noGraphQLTag', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        {
          noGraphQLTag: true,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import { DocumentNode } from 'graphql';`);
      expect(content.prepend).not.toContain(`import gql from 'graphql-tag';`);
      await validateTypeScript(content, schema, docs, {});
    });

    it(`tests for dedupeOperationSuffix`, async () => {
      const ast = parse(/* GraphQL */ `
        query notificationsQuery {
          notifications {
            id
          }
        }
      `);
      const ast2 = parse(/* GraphQL */ `
        query notifications {
          notifications {
            id
          }
        }
      `);

      expect(
        ((await plugin(schema, [{ location: 'test-file.ts', document: ast }], {}, { outputFile: '' })) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQueryQuery, NotificationsQueryQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast }],
          { dedupeOperationSuffix: false },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQueryQuery, NotificationsQueryQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast }],
          { dedupeOperationSuffix: true },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQuery, NotificationsQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast2 }],
          { dedupeOperationSuffix: true },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQuery, NotificationsQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast2 }],
          { dedupeOperationSuffix: false },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQuery, NotificationsQueryVariables>');
    });

    it(`tests for omitOperationSuffix`, async () => {
      const ast = parse(/* GraphQL */ `
        query notificationsQuery {
          notifications {
            id
          }
        }
      `);
      const ast2 = parse(/* GraphQL */ `
        query notifications {
          notifications {
            id
          }
        }
      `);

      expect(
        ((await plugin(schema, [{ location: 'test-file.ts', document: ast }], {}, { outputFile: '' })) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQueryQuery, NotificationsQueryQueryVariables>;');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast }],
          { omitOperationSuffix: false },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQueryQuery, NotificationsQueryQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast }],
          { omitOperationSuffix: true },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQuery, NotificationsQueryVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast2 }],
          { omitOperationSuffix: true },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<Notifications, NotificationsVariables>');
      expect(
        ((await plugin(
          schema,
          [{ location: 'test-file.ts', document: ast2 }],
          { omitOperationSuffix: false },
          { outputFile: '' }
        )) as any).content
      ).toContain('WebQLClient.QueryResult<NotificationsQuery, NotificationsQueryVariables>');
    });

    it('should import WebqlClient from webqlClientHooksImportFrom config option', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { webqlClientHooksImportFrom: 'webql-client' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import { WebQLClient as Client } from 'webql-client';`);
      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe('Fragments', () => {
    it('Should generate basic fragments documents correctly', async () => {
      const docs = [
        {
          location: 'a.graphql',
          document: parse(/* GraphQL */ `
            fragment MyFragment on Repository {
              example #full_name
            }

            query {
              feed {
                id
              }
            }
          `),
        },
      ];
      const result = await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        { outputFile: '' }
      );

      expect(result.content).toBeSimilarStringTo(`
      export const MyFragmentFragmentDoc = gql\`
      fragment MyFragment on Repository {
        full_name: example#full_name
      }
      \`;`);
      await validateTypeScript(result, schema, docs, {});
    });

    it('should generate Document variables for inline fragments', async () => {
      const repositoryWithOwner = gql`
        fragment RepositoryWithOwner on Repository {
          example #full_name
          html_url
          owner {
            avatar_url
          }
        }
      `;
      const feedWithRepository = gql`
        fragment FeedWithRepository on Entry {
          id
          commentCount
          repository(search: "phrase") {
            ...RepositoryWithOwner
          }
        }

        ${repositoryWithOwner}
      `;
      const myFeed = gql`
        query MyFeed {
          feed {
            ...FeedWithRepository
          }
        }

        ${feedWithRepository}
      `;

      const docs = [{ location: '', document: myFeed }];

      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`export const FeedWithRepositoryFragmentDoc = gql\`
fragment FeedWithRepository on Entry {
  id
  commentCount
  repository(search: "phrase") {
    ...RepositoryWithOwner
  }
}
\${RepositoryWithOwnerFragmentDoc}\`;`);
      expect(content.content).toBeSimilarStringTo(`export const RepositoryWithOwnerFragmentDoc = gql\`
fragment RepositoryWithOwner on Repository {
  full_name: example#full_name
  html_url
  owner {
    avatar_url
  }
}
\`;`);

      expect(content.content).toBeSimilarStringTo(`export const MyFeedDocument = gql\`
query MyFeed {
  feed {
    ...FeedWithRepository
  }
}
\${FeedWithRepositoryFragmentDoc}\`;`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('should avoid generating duplicate fragments', async () => {
      const simpleFeed = gql`
        fragment Item on Entry {
          id
        }
      `;
      const myFeed = gql`
        query MyFeed {
          feed {
            ...Item
          }
          allFeeds: feed {
            ...Item
          }
        }
      `;
      const documents = [simpleFeed, myFeed];
      const docs = documents.map(document => ({ document, location: '' }));
      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
        export const MyFeedDocument = gql\`
        query MyFeed {
            feed {
              ...Item
            }
            allFeeds: feed {
              ...Item
            }
          }
          \${ItemFragmentDoc}\``);
      expect(content.content).toBeSimilarStringTo(`
        export const ItemFragmentDoc = gql\`
        fragment Item on Entry {
          id
        }
\`;`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('Should generate fragments in proper order (when one depends on other)', async () => {
      const myFeed = gql`
        fragment FeedWithRepository on Entry {
          id
          repository {
            ...RepositoryWithOwner
          }
        }

        fragment RepositoryWithOwner on Repository {
          example #full_name
        }

        query MyFeed {
          feed {
            ...FeedWithRepository
          }
        }
      `;
      const documents = [myFeed];
      const docs = documents.map(document => ({ document, location: '' }));
      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      const feedWithRepositoryPos = content.content.indexOf('fragment FeedWithRepository');
      const repositoryWithOwnerPos = content.content.indexOf('fragment RepositoryWithOwner');
      expect(repositoryWithOwnerPos).toBeLessThan(feedWithRepositoryPos);
      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe('Document', () => {
    it('should generate Document variable', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
          export const TestDocument = gql\`
          query test {
            feed {
              id
              commentCount
              repository {
                full_name: example#full_name
                html_url
                owner {
                  avatar_url
                }
              }
            }
          }
          \`;
        `);
      await validateTypeScript(content, schema, docs, {});
    });

    it('should generate Document variable with noGraphQlTag', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        {
          noGraphQLTag: true,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(
        `export const TestDocument: DocumentNode = {"kind":"Document","defin`
      );

      // For issue #1599 - make sure there are not `loc` properties
      expect(content.content).not.toContain(`loc":`);
      expect(content.content).not.toContain(`loc':`);

      await validateTypeScript(content, schema, docs, {});
    });

    it('should generate correct Document variable with escaped values', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            mutation Test {
              submitRepository(repoFullName: "\\"REPONAME\\"") {
                createdAt
              }
            }
          `),
        },
      ];
      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
          export const TestDocument = gql\`
            mutation Test {
              submitRepository(repoFullName: "\\\\"REPONAME\\\\"") {
                createdAt
              }
            }
          \`;
        `);

      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe('Hooks', () => {
    it('Should generate hooks for query and mutation by default', async () => {
      const documents = parse(/* GraphQL */ `
        query feed {
          feed {
            id
            commentCount
            repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          }
        }

        mutation submitRepository($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);
      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        { webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
export function useFeedQuery(baseOptions?: WebQLClient.QueryHookOptions<FeedQuery, FeedQueryVariables>) {
  return webQLClient.useQuery<FeedDocument, FeedQueryVariables, FeedQuery>(FeedDocument, baseOptions);
}`);

      expect(content.content).toBeSimilarStringTo(`
export function useSubmitRepositoryMutation(baseOptions?: WebQLClient.MutationHookOptions<SubmitRepositoryMutation, SubmitRepositoryMutationVariables>) {
  return webQLClient.useMutation<SubmitRepositoryDocument, SubmitRepositoryMutationVariables, SubmitRepositoryMutation>(SubmitRepositoryDocument, baseOptions);
}`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('Should generate deduped hooks for query and mutation', async () => {
      const documents = parse(/* GraphQL */ `
        query FeedQuery {
          feed {
            id
            commentCount
            repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          }
        }

        mutation SubmitRepositoryMutation($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);
      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        {
          withHooks: true,
          dedupeOperationSuffix: true,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
export function useFeedQuery(baseOptions?: WebQLClient.QueryHookOptions<FeedQuery, FeedQueryVariables>) {
  return webQLClient.useQuery<FeedQueryDocument, FeedQueryVariables, FeedQuery>(FeedQueryDocument, baseOptions);
}`);

      expect(content.content).toBeSimilarStringTo(`
export function useSubmitRepositoryMutation(baseOptions?: WebQLClient.MutationHookOptions<SubmitRepositoryMutation, SubmitRepositoryMutationVariables>) {
  return webQLClient.useMutation<SubmitRepositoryMutationDocument, SubmitRepositoryMutationVariables, SubmitRepositoryMutation>(SubmitRepositoryMutationDocument, baseOptions);
}`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('Should not generate hooks for query and mutation', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { withHooks: false, webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toContain(`export function useFeedQuery`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('Should generate subscription hooks', async () => {
      const documents = parse(/* GraphQL */ `
        subscription ListenToComments($name: String) {
          commentAdded(repoFullName: $name) {
            id
          }
        }
      `);

      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        {
          withHooks: true,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
export function useListenToCommentsSubscription(baseOptions?: Apollo.SubscriptionHookOptions<ListenToCommentsSubscription, ListenToCommentsSubscriptionVariables>) {
  return Apollo.useSubscription<ListenToCommentsSubscription, ListenToCommentsSubscriptionVariables>(ListenToCommentsDocument, baseOptions);
}`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('Should not add typesPrefix to hooks', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { withHooks: true, typesPrefix: 'I', webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toContain(`export function useTestQuery`);
    });

    it('should generate hook result', async () => {
      const documents = parse(/* GraphQL */ `
        query feed {
          feed {
            id
            commentCount
            repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          }
        }

        mutation submitRepository($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);
      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        { withHooks: true, webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
      export type FeedQueryHookResult = ReturnType<typeof useFeedQuery>;
      `);

      // expect(content.content).toBeSimilarStringTo(`
      // export type FeedLazyQueryHookResult = ReturnType<typeof useFeedLazyQuery>;
      // `);

      expect(content.content).toBeSimilarStringTo(`
      export type SubmitRepositoryMutationHookResult = ReturnType<typeof useSubmitRepositoryMutation>;
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    const queryDocBlockSnapshot = `/**
 * __useFeedQuery__
 *
 * To run a query within a React component, call \`useFeedQuery\` and pass it any options that fit your needs.
 * When your component renders, \`useFeedQuery\` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFeedQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */`;

    const mutationDocBlockSnapshot = `/**
 * __useSubmitRepositoryMutation__
 *
 * To run a mutation, you first call \`useSubmitRepositoryMutation\` within a React component and pass it any options that fit your needs.
 * When your component renders, \`useSubmitRepositoryMutation\` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [submitRepositoryMutation, { data, loading, error }] = useSubmitRepositoryMutation({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */`;

    it('Should generate JSDoc docblocks for hooks', async () => {
      const documents = parse(/* GraphQL */ `
        query feed($id: ID!) {
          feed(id: $id) {
            id
          }
        }
        mutation submitRepository($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);

      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        { withHooks: true, webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      const queryDocBlock = extract(content.content.substr(content.content.indexOf('/**')));

      expect(queryDocBlock).toEqual(queryDocBlockSnapshot);

      const mutationDocBlock = extract(content.content.substr(content.content.lastIndexOf('/**')));

      expect(mutationDocBlock).toEqual(mutationDocBlockSnapshot);
    });

    it('Should NOT generate JSDoc docblocks for hooks if addDocBlocks is false', async () => {
      const documents = parse(/* GraphQL */ `
        query feed($id: ID!) {
          feed(id: $id) {
            id
          }
        }
        mutation submitRepository($name: String) {
          submitRepository(repoFullName: $name) {
            id
          }
        }
      `);

      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        { withHooks: true, addDocBlocks: false, webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json' },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      const queryDocBlock = extract(content.content.substr(content.content.indexOf('/**')));

      expect(queryDocBlock).not.toEqual(queryDocBlockSnapshot);

      const mutationDocBlock = extract(content.content.substr(content.content.lastIndexOf('/**')));

      expect(mutationDocBlock).not.toEqual(mutationDocBlockSnapshot);
    });
  });

  describe('ResultType', () => {
    const config: ReactWebQLRawPluginConfig = {
      withHooks: false,
      withMutationFn: false,
      withResultType: true,
      withMutationOptionsType: false,
      webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
    };

    const mutationDoc = parse(/* GraphQL */ `
      mutation test($name: String) {
        submitRepository(repoFullName: $name) {
          id
        }
      }
    `);

    const subscriptionDoc = parse(/* GraphQL */ `
      subscription test($name: String) {
        commentAdded(repoFullName: $name) {
          id
        }
      }
    `);

    it('should generate ResultType for Query if withResultType is true', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.content).toContain(
        `export type TestQueryResult = WebQLClient.QueryResult<TestQuery, TestQueryVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it('should NOT generate ResultType for Query if withResultType is false', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { ...config, withResultType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toContain(
        `export type TestQueryResult = WebQLClient.QueryResult<TestQuery, TestQueryVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it('should generate ResultType for Mutation if withResultType is true', async () => {
      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.content).toContain(
        `export type TestMutationResult = WebQLClient.MutationResult<TestMutation, TestMutationVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it('should NOT generate ResultType for Mutation if withResultType is false', async () => {
      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config, withResultType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toContain(
        `export type TestMutationResult = WebQLClient.MutationResult<TestMutation, TestMutationVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should generate ResultType for Subscription if withResultType is true', async () => {
      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toContain(
        `export type TestSubscriptionResult = Apollo.SubscriptionResult<TestSubscription>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should NOT generate ResultType for Subscription if withResultType is false', async () => {
      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config, withResultType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toContain(
        `export type TestSubscriptionResult = Apollo.SubscriptionResult<TestSubscription>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });
    it.skip('should generate lazy query hooks', async () => {
      const documents = parse(/* GraphQL */ `
        query feed {
          feed {
            id
            commentCount
            repository {
              example #full_name
              html_url
              owner {
                avatar_url
              }
            }
          }
        }
      `);
      const docs = [{ location: '', document: documents }];

      const content = (await plugin(
        schema,
        docs,
        { withHooks: true },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(`
  export function useFeedLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<FeedQuery, FeedQueryVariables>) {
    return Apollo.useLazyQuery<FeedQuery, FeedQueryVariables>(FeedDocument, baseOptions);
  }`);
      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe('MutationOptions', () => {
    const config: ReactWebQLRawPluginConfig = {
      withHooks: false,
      withMutationFn: false,
      withResultType: false,
      withMutationOptionsType: true,
      webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
    };

    it('should generate MutationOptions for Mutation if withMutationOptionsType is true', async () => {
      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toContain(
        `export type TestMutationOptions = WebQLClient.BaseMutationOptions<TestMutation, TestMutationVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it('should NOT generate MutationOptions for Mutation if withMutationOptionsType is false', async () => {
      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config, withMutationOptionsType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toContain(
        `export type TestMutationOptions = WebQLClient.BaseMutationOptions<TestMutation, TestMutationVariables>;`
      );
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should NOT generate MutationOptions for Query if withMutationOptionsType is true', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { ...config },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toContain(`import * as WebQLClient from 'webql-hooks';`);
      expect(content.content).not.toContain(`webQLClient.BaseMutationOptions`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should NOT generate MutationOptions for Query if withMutationOptionsType is false', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        { ...config, withMutationOptionsType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toContain(`import * as ReactQueryCommon from 'react-webql';`);
      expect(content.content).not.toContain(`Apollo.BaseMutationOptions`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should NOT generate MutationOptions for Subscription if withMutationOptionsType is true', async () => {
      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toContain(`import * as ReactQueryCommon from 'react-webql';`);
      expect(content.content).not.toContain(`Apollo.BaseMutationOptions`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should NOT generate MutationOptions for Subscription if withMutationOptionsType is false', async () => {
      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(
        schema,
        docs,
        { ...config, withMutationOptionsType: false },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toContain(`import * as ReactQueryCommon from 'react-webql';`);
      expect(content.content).not.toContain(`Apollo.BaseMutationOptions`);
      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe.skip('withRefetchFn', () => {
    it('should generate a function for use with refetchQueries', async () => {
      const docs = [{ location: '', document: basicDoc }];

      const content = (await plugin(
        schema,
        docs,
        {
          withHooks: true,
          withRefetchFn: true,
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toContain(
        `export function refetchTestQuery(variables?: TestQueryVariables) {
      return { query: TestDocument, variables: variables }
    }`
      );
      await validateTypeScript(content, schema, docs, {});
    });
  });

  describe('documentMode and importDocumentNodeExternallyFrom', () => {
    const multipleOperationDoc = parse(/* GraphQL */ `
      query testOne {
        feed {
          id
          commentCount
          repository {
            example #full_name
            html_url
            owner {
              avatar_url
            }
          }
        }
      }
      mutation testTwo($name: String) {
        submitRepository(repoFullName: $name) {
          id
        }
      }

      subscription testThree($name: String) {
        commentAdded(repoFullName: $name) {
          id
        }
      }
    `);

    it('should import DocumentNode when documentMode is "documentNode"', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        {
          documentMode: DocumentMode.documentNode,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import { DocumentNode } from 'graphql';`);
      expect(content.prepend).not.toContain(`import gql from 'graphql-tag';`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('should generate Document variable when documentMode is "documentNode"', async () => {
      const docs = [{ location: '', document: basicDoc }];
      const content = (await plugin(
        schema,
        docs,
        {
          documentMode: DocumentMode.documentNode,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toBeSimilarStringTo(
        `export const TestDocument: DocumentNode = {"kind":"Document","defin`
      );

      // For issue #1599 - make sure there are not `loc` properties
      expect(content.content).not.toContain(`loc":`);
      expect(content.content).not.toContain(`loc':`);

      await validateTypeScript(content, schema, docs, {});
    });

    it('should generate definitions Document variable when documentMode is "documentNode" and nested fragments', async () => {
      const testSchema = buildSchema(/* GraphQL */ `
        type Query {
          a: A
        }

        type A {
          bs: [B!]!
        }

        type B {
          cs: [C!]!
        }

        type C {
          greeting: String!
        }
      `);
      const testDoc = parse(/* GraphQL */ `
        query Test {
          a {
            ...AFields
          }
        }

        fragment AFields on A {
          bs {
            ...BFields
          }
        }

        fragment BFields on B {
          cs {
            ...CFields
          }
        }

        fragment CFields on C {
          greeting
        }
      `);
      const docs = [{ location: '', document: testDoc }];
      const content = (await plugin(
        testSchema,
        docs,
        {
          withComponent: false,
          withHOC: false,
          withHooks: false,
          documentMode: DocumentMode.documentNode,
          webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).toMatchSnapshot();

      await validateTypeScript(content, testSchema, docs, {});
    });

    it('should NOT generate inline fragment docs for external mode: file with operation using inline fragment', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            fragment feedFragment on Entry {
              id
              commentCount
            }
            query testOne {
              feed {
                ...feedFragment
              }
            }
          `),
        },
      ];
      const config = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };
      const content = (await plugin(
        schema,
        docs,
        { ...config },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toBeSimilarStringTo(`export const FeedFragmentFragmentDoc = gql`);

      await validateTypeScript(content, schema, docs, {});
    });

    it('should NOT generate inline fragment docs for external mode: file with operation NOT using inline fragment', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            fragment feedFragment on Entry {
              id
              commentCount
            }
            query testOne {
              feed {
                id
              }
            }
          `),
        },
      ];
      const config = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };
      const content = (await plugin(
        schema,
        docs,
        {
          ...config,
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toBeSimilarStringTo(`export const FeedFragmentFragmentDoc = gql`);
      await validateTypeScript(content, schema, docs, {});
    });

    it('should NOT generate inline fragment docs for external mode: file with just fragment', async () => {
      const docs = [
        {
          location: '',
          document: parse(/* GraphQL */ `
            fragment feedFragment on Entry {
              id
              commentCount
            }
          `),
        },
      ];
      const config = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };
      const content = (await plugin(
        schema,
        docs,
        {
          ...config,
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.content).not.toBeSimilarStringTo(`export const FeedFragmentFragmentDoc = gql`);

      await validateTypeScript(content, schema, docs, { ...config });
    });

    it.skip('should import Operations from one external file and use it in Query component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: '', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestComponent = (props: TestComponentProps) => (
          <ReactQueryComponents.Query<TestQuery, TestQueryVariables> query={Operations.test} {...props} />
        );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in useQuery and useLazyQuery', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: '', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestQuery(baseOptions?: QueryObserverOptions<TestQuery>) {
        return webQLClient.useQuery<typeof Operations.test, TestQueryVariables, TestQuery>(Operations.test, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TestQuery, TestQueryVariables>) {
        return Apollo.useLazyQuery<TestQuery, TestQueryVariables>(Operations.test, baseOptions);
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in withQuery', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents',
        withComponent: false,
        withHooks: false,
        withHOC: true,
        webqlSchemaImportFrom: '../../../../../dev-test/githunt/schema.json',
      };

      const docs = [{ location: '', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestQuery,
        TestQueryVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withQuery<TProps, TestQuery, TestQueryVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      };
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in Mutation component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestComponent = (props: TestComponentProps) => (
          <ReactQueryComponents.Mutation<TestMutation, TestMutationVariables> mutation={Operations.test} {...props} />
        );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in useMutation', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestMutation(baseOptions?: WebQLClient.MutationHookOptions<TestMutation, TestMutationVariables>) {
        return webQLClient.useMutation<TestMutation, TestMutationVariables>(Operations.test, baseOptions);
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in withMutation', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: '', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'mutate'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestMutation,
        TestMutationVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withMutation<TProps, TestMutation, TestMutationVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in Subscription component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestComponent = (props: TestComponentProps) => (
          <ReactQueryComponents.Subscription<TestSubscription, TestSubscriptionVariables> subscription={Operations.test} {...props} />
        );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in useSubscription', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestSubscription(baseOptions?: Apollo.SubscriptionHookOptions<TestSubscription, TestSubscriptionVariables>) {
        return Apollo.useSubscription<TestSubscription, TestSubscriptionVariables>(Operations.test, baseOptions);
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in withSubscription', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: '', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestSubscription,
        TestSubscriptionVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withSubscription<TProps, TestSubscription, TestSubscriptionVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in multiple components', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: '', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export const TestOneComponent = (props: TestOneComponentProps) => (
        <ReactQueryComponents.Query<TestOneQuery, TestOneQueryVariables> query={Operations.testOne} {...props} />
      );`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestTwoComponent = (props: TestTwoComponentProps) => (
          <ReactQueryComponents.Mutation<TestTwoMutation, TestTwoMutationVariables> mutation={Operations.testTwo} {...props} />
        );`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestThreeComponent = (props: TestThreeComponentProps) => (
          <ReactQueryComponents.Subscription<TestThreeSubscription, TestThreeSubscriptionVariables> subscription={Operations.testThree} {...props} />
        );`);

      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in multiple hooks', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: '', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestOneQuery(baseOptions?: WebQLClient.QueryHookOptions<TestOneQuery, TestOneQueryVariables>) {
        return webQLClient.useQuery<TestOneQuery, TestOneQueryVariables>(Operations.testOne, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestOneLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TestOneQuery, TestOneQueryVariables>) {
        return Apollo.useLazyQuery<TestOneQuery, TestOneQueryVariables>(Operations.testOne, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestTwoMutation(baseOptions?: WebQLClient.MutationHookOptions<TestTwoMutation, TestTwoMutationVariables>) {
        return webQLClient.useMutation<TestTwoMutation, TestTwoMutationVariables>(Operations.testTwo, baseOptions);
      }
      `);

      expect(content.content).toBeSimilarStringTo(`
      export function useTestThreeSubscription(baseOptions?: Apollo.SubscriptionHookOptions<TestThreeSubscription, TestThreeSubscriptionVariables>) {
        return Apollo.useSubscription<TestThreeSubscription, TestThreeSubscriptionVariables>(Operations.testThree, baseOptions);
      }`);

      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from one external file and use it in multiple HOCs', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: '', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from 'path/to/documents';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestOne<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestOneQuery,
        TestOneQueryVariables,
        TestOneProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withQuery<TProps, TestOneQuery, TestOneQueryVariables, TestOneProps<TChildProps, TDataName>>(Operations.testOne, {
            alias: 'testOne',
            ...operationOptions
          });
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestTwo<TProps, TChildProps = {}, TDataName extends string = 'mutate'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestTwoMutation,
        TestTwoMutationVariables,
        TestTwoProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withMutation<TProps, TestTwoMutation, TestTwoMutationVariables, TestTwoProps<TChildProps, TDataName>>(Operations.testTwo, {
            alias: 'testTwo',
            ...operationOptions
          });
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestThree<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestThreeSubscription,
        TestThreeSubscriptionVariables,
        TestThreeProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withSubscription<TProps, TestThreeSubscription, TestThreeSubscriptionVariables, TestThreeProps<TChildProps, TDataName>>(Operations.testThree, {
            alias: 'testThree',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for Query component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestComponent = (props: TestComponentProps) => (
          <ReactQueryComponents.Query<TestQuery, TestQueryVariables> query={Operations.test} {...props} />
        );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for useQuery and useLazyQuery', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestQuery(baseOptions?: WebQLClient.QueryHookOptions<TestQuery>) {
        return webQLClient.useQuery<TestQuery, TestQueryVariables>(Operations.test, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TestQuery, TestQueryVariables>) {
        return Apollo.useLazyQuery<TestQuery, TestQueryVariables>(Operations.test, baseOptions);
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for withQuery', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: 'path/to/document.graphql', document: basicDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestQuery,
        TestQueryVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withQuery<TProps, TestQuery, TestQueryVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for Mutation component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export const TestComponent = (props: TestComponentProps) => (
        <ReactQueryComponents.Mutation<TestMutation, TestMutationVariables> mutation={Operations.test} {...props} />
      );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for useMutation', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestMutation(baseOptions?: WebQLClient.MutationHookOptions<TestMutation, TestMutationVariables>) {
        return webQLClient.useMutation<TestMutation, TestMutationVariables>(Operations.test, baseOptions);
      }`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for withMutation', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: 'path/to/document.graphql', document: mutationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'mutate'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestMutation,
        TestMutationVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withMutation<TProps, TestMutation, TestMutationVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for Subscription component', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export const TestComponent = (props: TestComponentProps) => (
        <ReactQueryComponents.Subscription<TestSubscription, TestSubscriptionVariables> subscription={Operations.test} {...props} />
      );`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for useSubscription', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestSubscription(baseOptions?: Apollo.SubscriptionHookOptions<TestSubscription, TestSubscriptionVariables>) {
        return Apollo.useSubscription<TestSubscription, TestSubscriptionVariables>(Operations.test, baseOptions);
      }`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file for withSubscription', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: 'path/to/document.graphql', document: subscriptionDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTest<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestSubscription,
        TestSubscriptionVariables,
        TestProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withSubscription<TProps, TestSubscription, TestSubscriptionVariables, TestProps<TChildProps, TDataName>>(Operations.test, {
            alias: 'test',
            ...operationOptions
          });
      }
      `);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file and use it in multiple components', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: true,
        withHooks: false,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export const TestOneComponent = (props: TestOneComponentProps) => (
        <ReactQueryComponents.Query<TestOneQuery, TestOneQueryVariables> query={Operations.testOne} {...props} />
      );`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestTwoComponent = (props: TestTwoComponentProps) => (
          <ReactQueryComponents.Mutation<TestTwoMutation, TestTwoMutationVariables> mutation={Operations.testTwo} {...props} />
        );`);
      expect(content.content).toBeSimilarStringTo(`
        export const TestThreeComponent = (props: TestThreeComponentProps) => (
          <ReactQueryComponents.Subscription<TestThreeSubscription, TestThreeSubscriptionVariables> subscription={Operations.testThree} {...props} />
        );`);

      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file and use it in multiple hooks', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: true,
        withHOC: false,
      };

      const docs = [{ location: 'path/to/document.graphql', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestOneQuery(baseOptions?: WebQLClient.QueryHookOptions<TestOneQuery>) {
        return webQLClient.useQuery<TestOneQuery, TestOneQueryVariables>(Operations.testOne, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestOneLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TestOneQuery, TestOneQueryVariables>) {
        return Apollo.useLazyQuery<TestOneQuery, TestOneQueryVariables>(Operations.testOne, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestTwoMutation(baseOptions?: WebQLClient.MutationHookOptions<TestTwoMutation, TestTwoMutationVariables>) {
        return webQLClient.useMutation<TestTwoMutation, TestTwoMutationVariables>(Operations.testTwo, baseOptions);
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function useTestThreeSubscription(baseOptions?: Apollo.SubscriptionHookOptions<TestThreeSubscription, TestThreeSubscriptionVariables>) {
        return Apollo.useSubscription<TestThreeSubscription, TestThreeSubscriptionVariables>(Operations.testThree, baseOptions);
      }`);

      await validateTypeScript(content, schema, docs, {});
    });

    it.skip('should import Operations from near operation file and use it in multiple HOCs', async () => {
      const config: ReactWebQLRawPluginConfig = {
        documentMode: DocumentMode.external,
        importDocumentNodeExternallyFrom: 'near-operation-file',
        withComponent: false,
        withHooks: false,
        withHOC: true,
      };

      const docs = [{ location: 'path/to/document.graphql', document: multipleOperationDoc }];

      const content = (await plugin(schema, docs, config, {
        outputFile: 'graphql.tsx',
      })) as Types.ComplexPluginOutput;

      expect(content.prepend).toContain(`import * as Operations from './document.graphql';`);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestOne<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestOneQuery,
        TestOneQueryVariables,
        TestOneProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withQuery<TProps, TestOneQuery, TestOneQueryVariables, TestOneProps<TChildProps, TDataName>>(Operations.testOne, {
            alias: 'testOne',
            ...operationOptions
          });
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestTwo<TProps, TChildProps = {}, TDataName extends string = 'mutate'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestTwoMutation,
        TestTwoMutationVariables,
        TestTwoProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withMutation<TProps, TestTwoMutation, TestTwoMutationVariables, TestTwoProps<TChildProps, TDataName>>(Operations.testTwo, {
            alias: 'testTwo',
            ...operationOptions
          });
      }
      `);
      expect(content.content).toBeSimilarStringTo(`
      export function withTestThree<TProps, TChildProps = {}, TDataName extends string = 'data'>(operationOptions?: ReactQueryHoc.OperationOption<
        TProps,
        TestThreeSubscription,
        TestThreeSubscriptionVariables,
        TestThreeProps<TChildProps, TDataName>>) {
          return ReactQueryHoc.withSubscription<TProps, TestThreeSubscription, TestThreeSubscriptionVariables, TestThreeProps<TChildProps, TDataName>>(Operations.testThree, {
            alias: 'testThree',
            ...operationOptions
          });
      }
      `);

      await validateTypeScript(content, schema, docs, {});
    });

    it.skip(`should NOT import Operations if no operation collected: external mode and one file`, async () => {
      const docs = [
        {
          location: 'path/to/document.graphql',
          document: parse(/* GraphQL */ `
            fragment feedFragment on Entry {
              id
              commentCount
            }
          `),
        },
      ];
      const content = (await plugin(
        schema,
        docs,
        {
          documentMode: DocumentMode.external,
          importDocumentNodeExternallyFrom: 'near-operation-file',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toBeSimilarStringTo(`import * as Operations`);
      await validateTypeScript(content, schema, docs, {});
    });

    it.skip(`should NOT import Operations if no operation collected: external mode and multiple files`, async () => {
      const docs = [
        {
          location: 'a.graphql',
          document: parse(/* GraphQL */ `
            fragment feedFragment1 on Entry {
              id
              commentCount
            }
          `),
        },
        {
          location: 'b.graphql',
          document: parse(/* GraphQL */ `
            fragment feedFragment2 on Entry {
              id
              commentCount
            }
          `),
        },
      ];
      const content = (await plugin(
        schema,
        docs,
        {
          documentMode: DocumentMode.external,
          importDocumentNodeExternallyFrom: 'path/to/documents.tsx',
        },
        {
          outputFile: 'graphql.tsx',
        }
      )) as Types.ComplexPluginOutput;

      expect(content.prepend).not.toBeSimilarStringTo(`import * as Operations`);
      await validateTypeScript(content, schema, docs, {});
    });
  });
});
