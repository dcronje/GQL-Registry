# GQL Registry

**GQL Registry** provides an efficient mechanism to manage and modularize GraphQL schemas and resolvers across multiple files. It supports the registration of types, queries, mutations, and subscriptions, and facilitates the use of plugins to extend GraphQL schema and resolver functionalities.

## Key Features

- **Modularization**: Split GraphQL schemas and resolvers into separate files.
- **Extensibility**: Easily extend schemas and integrate plugins.
- **Compatibility**: Works with standard GraphQL APIs and supports schema stitching and federation.

## Quick Start

Here’s how you can define and register a GraphQL schema for `Book` and `Author` entities using `GQL Registry`.

### Define Schemas

`book-schema.ts`:
```typescript
import { GQLRegistry } from 'gql-registry';
import { gql } from 'graphql-tag';

const typeDefinitions = gql`
    type Book {
        id: ID!
        title: String!
        description: String
        pageCount: Int!
        author: Author!
        publicationYear: Int!
    }
    input BookFilters {
        title: String
        authorIds: [ID!]
        publicationYearGreaterThan: Int
        publicationYearLessThan: Int
        publicationYearEqualTo: Int
    }
`;

const queryDefinitions = gql`
    type Query {
        oneBook(id: ID!): Book!
        allBooks(filters: BookFilters): [Book]!
    }
`;

const gqlRegistry = GQLRegistry.shared();
gqlRegistry.registerType({ typeDefinitions, queryDefinitions });
```

`book-resolvers.ts`
```typescript
import { GQLRegistry } from 'gql-registry';

const queryResolvers = {
    oneBook: async (_, { id }) => {
        return getBookById(id); // Assume getBookById is defined elsewhere
    },
    allBooks: async (_, { filters }) => {
        return filterBooks(filters); // Assume filterBooks is defined elsewhere
    }
};

const gqlRegistry = GQLRegistry.shared();
gqlRegistry.registerType({ queryResolvers });
```

### Using the resulting Schema
```typescript
import './book-schema.ts'
import './book-resolvers.ts'
import './author-schema.ts'
import './author-resolvers.ts'
import { GQLRegistry } from 'gql-registry';
import { ApolloServer } from 'apollo-server';

const registry = GQLRegistry.shared();
const schema = registry.getExecutableSchema();

const server = new ApolloServer({ schema });
server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
```

# Dynamic Importing of Schemas and Resolvers

For larger projects with multiple schema and resolver files, manually importing each file can be cumbersome. To automate and simplify this process, you can use the `import-from-path` module. This module allows you to dynamically load all schema and resolver files based on a specified pattern, making your codebase cleaner and more manageable.

## Installation

First, ensure you have the `import-from-path` module installed:

```bash
npm install import-from-path
```
### Usage
You can set up dynamic imports as follows:

```typescript
import importFromPath from 'import-from-path';

export async function buildSchema(): Promise<void> {
  // Dynamically import all schema files
  await importFromPath(__dirname, /.*schema.*/);
}

export async function buildResolvers(): Promise<void> {
  // Dynamically import all resolver files
  await importFromPath(__dirname, /.*resolvers.*/);
}

export async function buildAll() {
  await buildSchema();
  await buildResolvers();
}
```
This setup will automatically find and import files that match the regex patterns for schemas and resolvers in the directory and any sub-directories where the function is executed. It helps in keeping the main setup clean and focuses on automation.

### Integrating with GQL Registry
Once your schemas and resolvers are loaded, either dynamically or manually, you can easily integrate them with the GQL Registry to build the executable GraphQL schema:

```typescript
import { GQLRegistry } from 'gql-registry';
import { buildAll } from './dynamicImports';  // Assume this file contains the buildAll function

async function setupServer() {
  await buildAll();  // Load all schemas and resolvers

  const registry = GQLRegistry.shared();
  const schema = await registry.getExecutableSchema();

  const server = new Apollo Server({ schema });
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  });
}

setupServer();
```
## Schema Retrieval Methods

The GQL Registry provides different methods for retrieving GraphQL schemas tailored to specific needs, such as combining schemas, integrating remote APIs, or federating services.

#### `getExecutableSchema()`

This method returns a fully executable GraphQL schema that includes both your type definitions and resolvers, along with any integrated extensions and remote schemas. It is ideal for most use cases, including schema stitching with remote APIs:

```typescript
const executableSchema = await registry.getExecutableSchema();
```

#### `getFederatableSchema()`
For applications using GraphQL Federation, getFederatableSchema() adjusts the schema to be compatible with Apollo Federation. This method modifies the schema to adhere to federation specifications, which is necessary for services that are part of a federated architecture:

```typescript
const federatableSchema = await registry.getFederatableSchema();
```

#### `getSchema()`
If you need to retrieve the schema definitions without the associated resolvers, use getSchema(). This method is useful for generating type information or for schema inspection tasks:

```typescript
const typeOnlySchema = await registry.getSchema();
```
Each of these methods serves a specific purpose, allowing you to choose the most appropriate one based on the architectural needs of your GraphQL application.


# GQLRegistry Methods Documentation

This section provides detailed information about key methods in the `GQLRegistry` class. These methods allow for registering different schema elements, setting up remote schemas, and integrating plugins.



### `registerType`

Registers GraphQL types, including scalar types, interfaces, and their corresponding resolvers, along with queries, mutations, and subscriptions.

### Usage

```typescript
registry.registerType({
  typeDefinitions: gql`
    type User { id: ID! name: String! }
    interface Publication {
        id: ID!
        title: String!
        description: String
        pageCount: Int!
        publicationYear: Int!
    }
    type Book implements Publication {
        id: ID!
        title: String!
        description: String
        pageCount: Int!
        publicationYear: Int!
        author: Author!
    }
    type Magazine implements Publication {
        id: ID!
        title: String!
        description: String
        pageCount: Int!
        publicationYear: Int!
        editor: Editor!
    }
    scalar Date
  `,
  queryDefinitions: gql`type Query { user(id: ID!): User }`,
  mutationDefinitions: gql`type Mutation { createUser(name: String!): User }`,
  typeResolvers: {
    User: userResolver,
    Publication: {
      __resolveType(obj) {
        return obj.__typename; // Ensure to return 'Book' or 'Magazine' based on the instance
      }
    },
    Date: {
      serialize(value) {
        return value.getTime(); // Convert Date to a timestamp
      },
      parseValue(value) {
        return new Date(value); // Convert a timestamp to a Date
      }
    }
  },
  queryResolvers: {
    user: fetchUser
  },
  mutationResolvers: {
    createUser: createUser
  }
});
```

### Parameters

- **typeDefinitions**: Definitions for GraphQL types, including scalars and interfaces.
- **queryDefinitions**: Definitions for GraphQL queries.
- **mutationDefinitions**: Definitions for GraphQL mutations.
- **subscriptionDefinitions**: Definitions for GraphQL subscriptions.
- **typeResolvers**: Resolvers for the defined types, including special resolvers for interfaces and scalars.
- **queryResolvers**: Resolvers for the defined queries.
- **mutationResolvers**: Resolvers for the defined mutations.
- **subscriptionResolvers**: Resolvers for the defined subscriptions.

### Note on Scalars and Interfaces

- **Scalars**: Custom scalar types like `Date` need specific resolvers for serialization and parsing. These resolvers ensure that the scalar behaves correctly within the GraphQL queries and mutations. Read more here [Apollo docs](https://www.apollographql.com/docs/apollo-server/schema/custom-scalars).
- **Interfaces**: GraphQL interfaces and unions require a type resolver to determine which implementing type should be used when a type is returned. For example, the `Publication` interface needs a resolver to distinguish between types like `Book` and `Magazine`. Read more here [Apollo docs](https://www.apollographql.com/docs/apollo-server/schema/unions-interfaces)

### `registerTypeExtension`

Registers extensions to existing GraphQL types. Useful for remote schemas.

### Usage

```typescript
registry.registerTypeExtension({
  extensionTypeDefinitions: gql`extend type User { age: Int }`,
  extensionQueryDefinitions: gql`extend type Query { olderUsers: [User] }`
});
```

### Parameters

- **extensionTypeDefinitions**: Extension definitions for existing types.
- **extensionQueryDefinitions**: Extension definitions for existing queries.
- **extensionMutationDefinitions**: Extension definitions for existing mutations.
- **extensionSubscriptionDefinitions**: Extension definitions for existing subscriptions.
- **extensionTypeResolvers**: Resolvers for the extended type fields.
- **extensionQueryResolvers**: Resolvers for the extended query fields.
- **extensionMutationResolvers**: Resolvers for the extended mutation fields.
- **extensionSubscriptionResolvers**: Resolvers for the extended subscription fields.

For more infromation on schema stitching please use the resources here [The Guild](https://the-guild.dev/graphql/stitching/docs) and [Apollo](https://www.apollographql.com/blog/graphql-schema-stitching)

## registerDirectives

Allows for the registration of custom GraphQL directives that can modify the schema or the behavior of fields.

### Usage

```typescript
registry.registerDirectives({
  directiveDefinition: gql`directive @upper on FIELD_DEFINITION`,
  directiveResolvers: {
    upper: (schema) => applyDirectiveToUpper(schema)
  }
});
```

### Parameters

- **directiveDefinition**: A `DocumentNode` containing the directive's GraphQL definition.
- **directiveResolvers**: An object mapping directive names to resolver functions that implement the directive's behavior on the schema. Read more here [Apollo docs](https://www.apollographql.com/docs/apollo-server/schema/directives)

### `registerPreStartFunction`

Registers functions to be executed before the GraphQL service starts, allowing for setup operations that are necessary before the server can accept requests.

### Usage

```typescript
registry.registerPreStartFunction(async (registry) => {
  console.log('Preparing to start GraphQL service');
  await someInitializationFunction();
});
```

### Parameters

- **preStartfunction**: A function that executes operations necessary before the service starts. It can be synchronous or asynchronous.

### `registerPlugin`

Adds a plugin to the registry, enhancing or modifying the schema construction process. This can be used to add new features or modify existing behaviors within the GraphQL setup.

### Usage

```typescript
registry.registerPlugin(new MyCustomPlugin());
```

### Parameters

- **plugin**: An instance of a class that extends `GQLRegistryPlugin` and implements required methods for integration.


### `registerRemoteSchema`

Registers a remote GraphQL schema, facilitating schema stitching or federation.

### Usage

```typescript
registry.registerRemoteSchema({
  name: 'MyRemoteService',
  asyncSchema: async () => await fetchSchemaFromRemoteService(),
  executor: buildExecutorForRemoteService(),
  transforms: [new RenameTypes(name => `Remote_${name}`)]
});
```
### Parameters

- **name**: A unique string identifying the remote schema.
- **asyncSchema**: An optional async function that returns the GraphQL schema.
- **schema**: A directly provided GraphQL schema (if not using `asyncSchema`).
- **executor**: A function responsible for implementing the schema's operations.
- **transforms**: An array of transforms to apply to the schema. Read more here [The Guild](https://the-guild.dev/graphql/stitching/docs/transforms)

For more infromation on schema stitching please use the resources here [The Guild](https://the-guild.dev/graphql/stitching/docs) and [Apollo](https://www.apollographql.com/blog/graphql-schema-stitching)

## Plugins

Plugins in the `GQLRegistry` are designed to extend and enhance the functionality of the GraphQL schema management. Each plugin must conform to an abstract class structure which defines the mandatory and optional methods that can be implemented.

### Plugin Abstract Class Definition
```typescript
export abstract class GQLRegistryPlugin {
    
    // Plugins must declare a unique name to identify them
    abstract name: string

    registry!: GQLRegistry

    getRegistry(): GQLRegistry {
        return this.registry
    }
    
    // Called when the registry is cleared of all schema and resolvers
    clear?(): void
    
    // Sets the initial schema and extensions
    setInitialSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
    // Called with fresh schema and extensions when another plugin updates them
    schemaUpdated?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
    // called when all processing is complete
    setFinalSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
    
    // called before set final schema giving the plugin a chance to validate the schema against plugin specific rules 
    validateSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
    
    // called once for every type definition before main plugin processing begins and will replace the type definition with the response or ignore if null is returned
    addPrePropertiesToTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode | Promise<TypeDefinitionNode> | null | Promise<null>
       // called once for every type definition after main plugin processing has finished and will replace the type definition with the response or ignore if null is returned
    addPostPropertiesToTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode | Promise<TypeDefinitionNode> | null | Promise<null>
    
    // main plugin processing functions
    // any directive definitions returned will be added to the schema
    addDirectiveDefinitions?(schema: DocumentNode, extensions: DocumentNode): DirectiveDefinitionNode[] | Promise<DirectiveDefinitionNode[]> | null | Promise<null>
    // any directive resolvers returned will be added to the resolvers
    addDirectiveResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: (schema: GraphQLSchema) => GraphQLSchema } | Promise<{ [k: string]: (schema: GraphQLSchema) => GraphQLSchema }> | null | Promise<null>
    
    // any type definitions returned will be added to the schema
    addTypeDefinitions?(schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
    // any query definitions returned will be added to the schema
    addQueryDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    // any muation definitions returned will be added to the schema
    addMutationDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    // any subscription definitions returned will be added to the schema
    addSubscriptionDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

    // any type resolvers returned will be added to the resolvers
    addTypeResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // any query resolvers returned will be added to the resolvers
    addQueryResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // any muatation resolvers returned will be added to the resolvers
    addMutationResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // any subscription resolvers returned will be added to the resolvers
    addSubscriptionResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>
    
    // called once per type definition and will add any returned type definitions to the schema
    addTypeDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
    // called once per type definition and will add any returned query definitions to the schema
    addQueryDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    // called once per type definition and will add any returned mutation definitions to the schema
    addMutationDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    // called once per type definition and will add any returned subscription definitions to the schema
    addSubscriptionDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

    // called once per type definition and will add any returned type resolver to the resolvers
    addTypeResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // called once per type definition and will add any returned query resolver to the resolvers
    addQueryResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // called once per type definition and will add any returned mutation resolver to the resolvers
    addMutationResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    // called once per type definition and will add any returned subscription resolver to the resolvers
    addSubscriptionResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>
    
    // Extension type, query, mutation and subscription definitions and resolvers work the same as above but for extensions
    addTypeDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
    addQueryDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    addMutationDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
    addSubscriptionDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

    addTypeResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    addQueryResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    addMutationResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
    addSubscriptionResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>

}
```

A good example of a plugin is the [GQL Inherit Plugin](https://www.npmjs.com/package/gql-inherit-plugin) the funtion of the plugin is to make interfaces behave more like parent classes where any type which implements an interface automatically inherits all of its properties without having to redeclare them.

### Example
```typescript
import { GQLRegistry } from 'gql-registry'
import { gql } from 'graphql-tag'
import { GQLInheritsPlugin } from 'gql-inherit-plugin'

const inherits = new GQLInheritsPlugin()
registry.registerPlugin(inherits)

const typeDefinitions = gql`
    interface Publication {
        id: ID!
        title: String!
        description: String
        pageCount: Int!
        publicationYear: Int!
    }
    type Book implements Publication @Inherit {
        author: Author!
    }
    type Magazine implements Publication @Inherit {
        editor: Editor!
    }
`

// Must register a type resolver for the Publication interface
const typeResolvers = {
    Publication: {
        __resolveType(obj: unknown): string {
            // Should return 'Book' for books and 'Magazine' for magazines
            if (obj?.__typename) {
                return obj.__typename
            }
            return obj?.constructor?.name
        },
    }
}

const gqlRegistry = GQLRegistry.shared();
gqlRegistry.registerType({
    typeDefentions,
    typeResolvers,
})
```

In the final schema both the Book and Magazine types will have all the properties of the Publication interface
