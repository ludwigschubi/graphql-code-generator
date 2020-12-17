## Installation



<img alt="named-operations-object plugin version" src="https://img.shields.io/npm/v/webql-codegen-named-operations-object?color=%23e15799&label=plugin&nbsp;version&style=for-the-badge"/>


    
:::shell Using `yarn`
    yarn add -D webql-codegen-named-operations-object
:::

## API Reference

### `identifierName`

type: `string`
default: `namedOperations`

Allow you to customize the name of the exported identifier

#### Usage Examples

```yml
generates:
path/to/file.ts:
 plugins:
   - typescript
   - named-operations-object
 config:
   identifierName: ListAllOperations
```