import { GQLRegistry } from './GQLRegistry'
import { DirectiveDefinitionNode, DocumentNode, FieldDefinitionNode, GraphQLFieldResolver, GraphQLSchema, TypeDefinitionNode } from 'graphql'
import { ResolverFn } from 'graphql-subscriptions'

export abstract class GQLRegistryPlugin {

  abstract name: string

  registry!: GQLRegistry

  getRegistry(): GQLRegistry {
    return this.registry
  }

  clear?(): void

  setInitialSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
  schemaUpdated?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void
  setFinalSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void

  validateSchema?(schema: DocumentNode, extensions: DocumentNode): Promise<void> | void

  addPrePropertiesToTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode | Promise<TypeDefinitionNode> | null | Promise<null>
  addPostPropertiesToTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode | Promise<TypeDefinitionNode> | null | Promise<null>

  addDirectiveDefinitions?(schema: DocumentNode, extensions: DocumentNode): DirectiveDefinitionNode[] | Promise<DirectiveDefinitionNode[]> | null | Promise<null>
  addDirectiveResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: (schema: GraphQLSchema) => GraphQLSchema } | Promise<{ [k: string]: (schema: GraphQLSchema) => GraphQLSchema }> | null | Promise<null>

  addTypeDefinitions?(schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
  addQueryDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addMutationDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addSubscriptionDefinitions?(schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

  addTypeResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addQueryResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addMutationResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addSubscriptionResolvers?(schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>

  addTypeDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
  addQueryDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addMutationDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addSubscriptionDefinitionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

  addTypeResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addQueryResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addMutationResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addSubscriptionResolversForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>

  addTypeDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): TypeDefinitionNode[] | Promise<TypeDefinitionNode[]> | null | Promise<null>
  addQueryDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addMutationDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>
  addSubscriptionDefinitionExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): FieldDefinitionNode[] | Promise<FieldDefinitionNode[]> | null | Promise<null>

  addTypeResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addQueryResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addMutationResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: GraphQLFieldResolver<any, GQLContext, any> } | Promise<{ [k: string]: GraphQLFieldResolver<any, GQLContext, any> }> | null | Promise<null>
  addSubscriptionResolverExtensionsForTypeDefinition?(definition: TypeDefinitionNode, schema: DocumentNode, extensions: DocumentNode): { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | { [k: string]: { subscribe: ResolverFn, resolve: GraphQLFieldResolver<any, GQLContext, any> } } | null | Promise<null>

}
