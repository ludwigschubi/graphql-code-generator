# webql-codegen-typescript-urql

## 2.0.2

### Patch Changes

- f603b8f8: Support unnamed queries in operation visitors
- 65f92288: fix extension validation
- Updated dependencies [d2cde3d5]
- Updated dependencies [89a6aa80]
- Updated dependencies [f603b8f8]
- Updated dependencies [da8bdd17]
  - webql-codegen-visitor-plugin-common@1.17.15
  - webql-codegen-plugin-helpers@1.17.9

## 2.0.1

### Patch Changes

- 1d7c6432: Bump all packages to allow "^" in deps and fix compatibility issues
- 1d7c6432: Bump versions of @graphql-tools/ packages to fix issues with loading schemas and SDL comments
- Updated dependencies [1d7c6432]
- Updated dependencies [1d7c6432]
  - webql-codegen-visitor-plugin-common@1.17.13
  - webql-codegen-plugin-helpers@1.17.8

## 2.0.0

### Major Changes

- 7f2bf153: Prefer generating React Hooks over React data components by default

  ## Breaking Changes

  The default configuration for this plugins has changed to:

  ```yaml
  config:
    withHooks: true
    withComponent: false
  ```

  If you are using the generated Component from that plugin, you can turn it on by adding `withComponent: true` to your configuration.

### Patch Changes

- Updated dependencies [4266a15f]
  - webql-codegen-visitor-plugin-common@1.17.12
