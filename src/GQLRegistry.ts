import { RESTDataSource } from 'apollo-datasource-rest'
import { DefinitionNode, DirectiveDefinitionNode, DocumentNode, FieldDefinitionNode, GraphQLSchema, ObjectTypeDefinitionNode, TypeDefinitionNode, TypeExtensionNode, print, Kind } from 'graphql'
import { RenameInputObjectFields, RenameInterfaceFields, RenameObjectFields, RenameRootFields, RenameRootTypes, RenameTypes, wrapSchema } from '@graphql-tools/wrap'
import { Transform } from '@graphql-tools/delegate'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { stitchSchemas } from '@graphql-tools/stitch'
import { AsyncExecutor } from '@graphql-tools/utils'
import { pascalCase, camelCase } from 'change-case'
import { GQLRegistryPlugin } from './GQLRegistryPlugin'
import { GraphQLError } from 'graphql'

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
}

// eslint-disable-next-line
type PreStartFunction = (graphQLRegistry: GQLRegistry) => Promise<void> | void

interface RegisterDirectiveArgs {
  directiveDefinition?: DocumentNode
  directiveResolvers?: { [k: string]: (schema: GraphQLSchema) => GraphQLSchema }
}

interface RegisterTypeArgs {
  typeDefinitions?: DocumentNode
  queryDefinitions?: DocumentNode
  mutationDefinitions?: DocumentNode
  subscriptionDefinitions?: DocumentNode
  typeResolvers?: { [k: string]: any }
  queryResolvers?: { [k: string]: any }
  mutationResolvers?: { [k: string]: any }
  subscriptionResolvers?: { [k: string]: any }
}

interface RegisterTypeExtensionArgs {
  extensionTypeDefinitions?: DocumentNode
  extensionQueryDefinitions?: DocumentNode
  extensionMutationDefinitions?: DocumentNode
  extensionSubscriptionDefinitions?: DocumentNode
  extensionTypeResolvers?: { [k: string]: any }
  extensionQueryResolvers?: { [k: string]: any }
  extensionMutationResolvers?: { [k: string]: any }
  extensionSubscriptionResolvers?: { [k: string]: any }
}

interface RegisterRemoteSchemaArgs {
  name: string
  asyncSchema?: () => Promise<GraphQLSchema>
  schema?: GraphQLSchema
  executor: AsyncExecutor
  executable?: GraphQLSchema
  transforms?: Transform[]
}

const typeDefinitionTypes = [
  'ScalarTypeDefinition',
  'ObjectTypeDefinition',
  'InterfaceTypeDefinition',
  'UnionTypeDefinition',
  'EnumTypeDefinition',
  'InputObjectTypeDefinition',
]

function isTypeDefinitionNode(definition: DefinitionNode): boolean {
  return typeDefinitionTypes.includes(definition.kind)
}

const typeExtensionTypes = [
  'ScalarTypeExtension',
  'ObjectTypeExtension',
  'InterfaceTypeExtension',
  'UnionTypeExtension',
  'EnumTypeExtension',
  'InputObjectTypeExtension',
]

function isTypeExtensionNode(definition: DefinitionNode): boolean {
  return typeExtensionTypes.includes(definition.kind)
}

let instance: any = null

export class GQLRegistry {

  static shared(): GQLRegistry {
    if (!instance) {
      instance = new GQLRegistry()
    }
    return instance
  }

  remoteSchemas: { [k: string]: RegisterRemoteSchemaArgs } = {}

  directiveDefinitions: DirectiveDefinitionNode[] = []
  directiveResolvers: { [s: string]: (schema: GraphQLSchema) => GraphQLSchema } = {}

  typeDefinitions: TypeDefinitionNode[] = []
  queryDefinitions: FieldDefinitionNode[] = []
  mutationDefinitions: FieldDefinitionNode[] = []
  subscriptionDefinitions: FieldDefinitionNode[] = []

  typeResolvers: { [k: string]: any } = {}
  queryResolvers: { [s: string]: any } = {}
  mutationResolvers: { [s: string]: any } = {}
  subscriptionResolvers: { [s: string]: any } = {}

  extensionTypeDefinitions: TypeExtensionNode[] = []
  extensionQueryDefinitions: FieldDefinitionNode[] = []
  extensionMutationDefinitions: FieldDefinitionNode[] = []
  extensionSubscriptionDefinitions: FieldDefinitionNode[] = []

  extensionTypeResolvers: { [k: string]: any } = {}
  extensionQueryResolvers: { [k: string]: any } = {}
  extensionMutationResolvers: { [k: string]: any } = {}
  extensionSubscriptionResolvers: { [k: string]: any } = {}

  internalValues: { [s: string]: any } = {}
  executableSchema: GraphQLSchema | null = null
  dataSources: { [k: string]: RESTDataSource } = {}
  preStartFunctions: PreStartFunction[] = []
  hasExecutedPreStart = false
  hasProcessedPlugins = false

  plugins: GQLRegistryPlugin[] = []

  clear(): void {
    this.remoteSchemas = {}

    this.directiveDefinitions = []
    this.directiveResolvers = {}

    this.typeDefinitions = []
    this.queryDefinitions = []
    this.mutationDefinitions = []
    this.subscriptionDefinitions = []

    this.typeResolvers = {}
    this.queryResolvers = {}
    this.mutationResolvers = {}
    this.subscriptionResolvers = {}

    this.extensionTypeDefinitions = []
    this.extensionQueryDefinitions = []
    this.extensionMutationDefinitions = []
    this.extensionSubscriptionDefinitions = []

    this.extensionQueryResolvers = {}
    this.extensionMutationResolvers = {}
    this.extensionTypeResolvers = {}
    this.extensionSubscriptionResolvers = {}

    this.internalValues = {}
    this.executableSchema = null
    this.dataSources = {}
    this.hasProcessedPlugins = false
    this.plugins?.forEach((plu) => plu.clear?.())
  }

  /**
   * Registration
   */

  checkForDuplicateDirectives(directiveDefinitions: DirectiveDefinitionNode[]) {
    for (let t = 0; t < directiveDefinitions.length; t++) {
      const newDirectiveDefinition = directiveDefinitions[t]
      if (newDirectiveDefinition.kind === Kind.DIRECTIVE_DEFINITION) {
        const exists = this.directiveDefinitions.findIndex((def) => def.name.value === newDirectiveDefinition.name.value)
        if (exists !== -1) {
          console.warn(`WARNING: Directive with name ${newDirectiveDefinition.name.value} already registered`)
        }
      }
    }
  }

  checkForDuplicateTypes(typeDefinitions: TypeDefinitionNode[]): void {
    for (let t = 0; t < typeDefinitions.length; t++) {
      const newTypeDefinition: TypeDefinitionNode = typeDefinitions[t]
      if (isTypeDefinitionNode(newTypeDefinition)) {
        const exists = this.typeDefinitions.findIndex((def) => def.name.value === newTypeDefinition.name.value)
        if (exists !== -1) {
          console.warn(`WARNING: Type with name ${newTypeDefinition.name.value} already registered`)
        }
      }
    }
  }

  checkForDuplicateQueries(queryDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < queryDefinitions.length; t++) {
      const newQueryDefinition = queryDefinitions[t]
      if (newQueryDefinition.kind === Kind.FIELD_DEFINITION) {
        const exists = this.queryDefinitions.findIndex((def) => def.name.value === newQueryDefinition.name.value)
        if (exists !== -1) {
          console.warn(`WARNING: Query with name ${newQueryDefinition.name.value} already registered`)
        }
      }
    }
  }

  checkForDuplicateMutations(mutationDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < mutationDefinitions.length; t++) {
      const newMutationDefiniton = mutationDefinitions[t]
      if (newMutationDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.mutationDefinitions.findIndex((def) => def.name.value === newMutationDefiniton.name.value)
        if (exists !== -1) {
          console.warn(`WARNING: Mutation with name ${newMutationDefiniton.name.value} already registered`)
        }
      }
    }
  }

  checkForDuplicateSubscriptions(subscriptionDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < subscriptionDefinitions.length; t++) {
      const newSubscriptionDefiniton = subscriptionDefinitions[t]
      if (newSubscriptionDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.subscriptionDefinitions.findIndex((def) => def.name.value === newSubscriptionDefiniton.name.value)
        if (exists !== -1) {
          console.warn(`WARNING: Subscription with name ${newSubscriptionDefiniton.name.value} already registered`)
        }
      }
    }
  }

  mergeIncomingDirectives(directiveDefinitions: DirectiveDefinitionNode[]): void {
    for (let t = 0; t < directiveDefinitions.length; t++) {
      const newDirectiveDefinition = directiveDefinitions[t]
      if (newDirectiveDefinition.kind === Kind.DIRECTIVE_DEFINITION) {
        const exists = this.directiveDefinitions.findIndex((def) => def.name.value === newDirectiveDefinition.name.value)
        if (exists !== -1) {
          this.directiveDefinitions.splice(exists, 1)
        }
        this.directiveDefinitions.push(newDirectiveDefinition)
      }
    }
  }

  mergeIncomingTypes(typeDefinitions: TypeDefinitionNode[]): void {
    for (let t = 0; t < typeDefinitions.length; t++) {
      const newTypeDefinition: TypeDefinitionNode = typeDefinitions[t]
      if (isTypeDefinitionNode(newTypeDefinition)) {
        const exists = this.typeDefinitions.findIndex((def) => def.name.value === newTypeDefinition.name.value)
        if (exists !== -1) {
          this.typeDefinitions.splice(exists, 1)
        }
        this.typeDefinitions.push(newTypeDefinition)
      }
    }
  }

  mergeIncomingExtensionTypes(typeDefinitions: (TypeExtensionNode | TypeDefinitionNode)[]): void {
    for (let t = 0; t < typeDefinitions.length; t++) {
      const newTypeDefinition = typeDefinitions[t]
      if (isTypeExtensionNode(newTypeDefinition)) {
        const exists = this.extensionTypeDefinitions.findIndex((def) => def.name.value === newTypeDefinition.name.value)
        if (exists !== -1) {
          this.extensionTypeDefinitions.splice(exists, 1)
        }
        this.extensionTypeDefinitions.push(newTypeDefinition as TypeExtensionNode)
      } else if (isTypeDefinitionNode(newTypeDefinition)) {
        const exists = this.typeDefinitions.findIndex((def) => def.name.value === newTypeDefinition.name.value)
        if (exists !== -1) {
          this.typeDefinitions.splice(exists, 1)
        }
        this.typeDefinitions.push(newTypeDefinition as TypeDefinitionNode)
      }
    }
  }

  mergeIncomingQueries(queryDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < queryDefinitions.length; t++) {
      const newQueryDefinition = queryDefinitions[t]
      if (newQueryDefinition.kind === Kind.FIELD_DEFINITION) {
        const exists = this.queryDefinitions.findIndex((def) => def.name.value === newQueryDefinition.name.value)
        if (exists !== -1) {
          this.queryDefinitions.splice(exists, 1)
        }
        this.queryDefinitions.push(newQueryDefinition)
      }
    }
  }

  mergeIncomingExtensionQueries(extensionQueryDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < extensionQueryDefinitions.length; t++) {
      const newExtensionQueryDefinition = extensionQueryDefinitions[t]
      if (newExtensionQueryDefinition.kind === Kind.FIELD_DEFINITION) {
        const exists = this.extensionQueryDefinitions.findIndex((def) => def.name.value === newExtensionQueryDefinition.name.value)
        if (exists !== -1) {
          this.extensionQueryDefinitions.splice(exists, 1)
        }
        this.extensionQueryDefinitions.push(newExtensionQueryDefinition)
      }
    }
  }

  mergeIncomingMutations(mutationDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < mutationDefinitions.length; t++) {
      const newMutationDefiniton = mutationDefinitions[t]
      if (newMutationDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.mutationDefinitions.findIndex((def) => def.name.value === newMutationDefiniton.name.value)
        if (exists !== -1) {
          this.mutationDefinitions.splice(exists, 1)
        }
        this.mutationDefinitions.push(newMutationDefiniton)
      }
    }
  }

  mergeIncomingExtensionMutations(extensionMutationDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < extensionMutationDefinitions.length; t++) {
      const newExtensionMutationDefiniton = extensionMutationDefinitions[t]
      if (newExtensionMutationDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.extensionMutationDefinitions.findIndex((def) => def.name.value === newExtensionMutationDefiniton.name.value)
        if (exists !== -1) {
          this.extensionMutationDefinitions.splice(exists, 1)
        }
        this.extensionMutationDefinitions.push(newExtensionMutationDefiniton)
      }
    }
  }

  mergeIncomingSubscriptions(subscriptionDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < subscriptionDefinitions.length; t++) {
      const newSubscriptionDefiniton = subscriptionDefinitions[t]
      if (newSubscriptionDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.subscriptionDefinitions.findIndex((def) => def.name.value === newSubscriptionDefiniton.name.value)
        if (exists !== -1) {
          this.subscriptionDefinitions.splice(exists, 1)
        }
        this.subscriptionDefinitions.push(newSubscriptionDefiniton)
      }
    }
  }

  mergeIncomingExtensionSubscriptions(extensionSubscriptionDefinitions: FieldDefinitionNode[]): void {
    for (let t = 0; t < extensionSubscriptionDefinitions.length; t++) {
      const newExtensionSubscriptionDefiniton = extensionSubscriptionDefinitions[t]
      if (newExtensionSubscriptionDefiniton.kind === Kind.FIELD_DEFINITION) {
        const exists = this.extensionSubscriptionDefinitions.findIndex((def) => def.name.value === newExtensionSubscriptionDefiniton.name.value)
        if (exists !== -1) {
          this.extensionSubscriptionDefinitions.splice(exists, 1)
        }
        this.extensionSubscriptionDefinitions.push(newExtensionSubscriptionDefiniton)
      }
    }
  }

  registerDataSource(args: { name: string, dataSource: RESTDataSource }): void {
    const { name, dataSource } = args
    this.dataSources[name] = dataSource
  }

  registerRemoteSchema(args: RegisterRemoteSchemaArgs): void {
    const { name, asyncSchema, schema, executor, transforms } = args
    if (!this.remoteSchemas[name]) {
      this.remoteSchemas[name] = { name, asyncSchema, schema, executor, transforms }
    }
  }

  registerDirectives({ directiveDefinition, directiveResolvers = {} }: RegisterDirectiveArgs): void {
    if (directiveDefinition?.definitions) {
      this.checkForDuplicateDirectives(directiveDefinition.definitions as DirectiveDefinitionNode[])
      this.mergeIncomingDirectives(directiveDefinition.definitions as DirectiveDefinitionNode[])
    }
    if (Object.keys(directiveResolvers).length) {
      Object.keys(directiveResolvers).forEach((directiveName: string) => {
        this.directiveResolvers[directiveName] = directiveResolvers[directiveName]
      })
    }
  }

  registerType(args: RegisterTypeArgs): void {
    const {
      typeDefinitions,
      queryDefinitions,
      mutationDefinitions,
      subscriptionDefinitions,
      typeResolvers,
      queryResolvers,
      mutationResolvers,
      subscriptionResolvers,
    } = args

    if (typeDefinitions?.definitions) {
      this.checkForDuplicateTypes(typeDefinitions?.definitions as TypeDefinitionNode[])
      this.mergeIncomingTypes(typeDefinitions?.definitions as TypeDefinitionNode[])
    }

    const queryDocumentDefinitions = (queryDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Query'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.checkForDuplicateQueries(queryDocumentDefinitions as Mutable<FieldDefinitionNode[]>)
    this.mergeIncomingQueries(queryDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    const mutationDocumentDefinitions = (mutationDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Mutation'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.checkForDuplicateMutations(mutationDocumentDefinitions as Mutable<FieldDefinitionNode[]>)
    this.mergeIncomingMutations(mutationDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    const subscriptionDocumentDefinitions = (subscriptionDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Subscription'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.checkForDuplicateSubscriptions(subscriptionDocumentDefinitions as Mutable<FieldDefinitionNode[]>)
    this.mergeIncomingSubscriptions(subscriptionDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    if (typeResolvers) {
      Object.keys(typeResolvers).forEach((name: string) => {
        this.typeResolvers[name] = typeResolvers[name]
      })
    }
    if (queryResolvers) {
      Object.keys(queryResolvers).forEach((name: string) => {
        this.queryResolvers[name] = queryResolvers[name]
      })
    }
    if (mutationResolvers) {
      Object.keys(mutationResolvers).forEach((name: string) => {
        this.mutationResolvers[name] = mutationResolvers[name]
      })
    }
    if (subscriptionResolvers) {
      Object.keys(subscriptionResolvers).forEach((name: string) => {
        this.subscriptionResolvers[name] = subscriptionResolvers[name]
      })
    }

  }

  registerTypeExtension(args: RegisterTypeExtensionArgs): void {
    const {
      extensionTypeDefinitions,
      extensionQueryDefinitions,
      extensionMutationDefinitions,
      extensionSubscriptionDefinitions,
      extensionTypeResolvers,
      extensionQueryResolvers,
      extensionMutationResolvers,
      extensionSubscriptionResolvers,
    } = args

    if (extensionTypeDefinitions?.definitions) {
      this.mergeIncomingExtensionTypes(extensionTypeDefinitions?.definitions as TypeExtensionNode[])
    }

    const queryDocumentDefinitions = (extensionQueryDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Query'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.mergeIncomingExtensionQueries(queryDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    const mutationDocumentDefinitions = (extensionMutationDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Mutation'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.mergeIncomingExtensionMutations(mutationDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    const subscriptionDocumentDefinitions = (extensionSubscriptionDefinitions?.definitions?.find((def) => {
      return def.kind === Kind.OBJECT_TYPE_DEFINITION && def.name.value === 'Subscription'
    }) as ObjectTypeDefinitionNode)?.fields ?? []
    this.mergeIncomingExtensionSubscriptions(subscriptionDocumentDefinitions as Mutable<FieldDefinitionNode[]>)

    if (extensionQueryResolvers) {
      Object.keys(extensionQueryResolvers).forEach((extensionName: string) => {
        this.extensionQueryResolvers[extensionName] = extensionQueryResolvers[extensionName]
      })
    }
    if (extensionMutationResolvers) {
      Object.keys(extensionMutationResolvers).forEach((extensionName: string) => {
        this.extensionMutationResolvers[extensionName] = extensionMutationResolvers[extensionName]
      })
    }
    if (extensionTypeResolvers) {
      Object.keys(extensionTypeResolvers).forEach((extensionName: string) => {
        this.extensionTypeResolvers[extensionName] = extensionTypeResolvers[extensionName]
      })
    }
    if (extensionSubscriptionResolvers) {
      Object.keys(extensionSubscriptionResolvers).forEach((extensionName: string) => {
        this.extensionSubscriptionResolvers[extensionName] = extensionSubscriptionResolvers[extensionName]
      })
    }

  }

  registerInternalValues({ internalValues }: { internalValues: { [s: string]: any } }): void {
    this.internalValues = { ...this.internalValues, ...internalValues }
  }

  registerPreStartFunction(preStartfunction: PreStartFunction): void {
    this.preStartFunctions.push(preStartfunction)
  }

  registerPlugin(plugin: GQLRegistryPlugin): void {
    const isAdded = this.plugins.find((registeredPlugin: GQLRegistryPlugin) => registeredPlugin.name === plugin.name)
    if (!isAdded) {
      plugin.registry = this
      this.plugins.push(plugin)
    }
  }

  /**
   * Definitions
   */

  getDefinitionsDocument(): DocumentNode {

    const definitions: Mutable<DefinitionNode[]> = [
      ...this.typeDefinitions,
      ...this.directiveDefinitions,
    ]

    if (this.queryDefinitions.length) {
      const queryObject: ObjectTypeDefinitionNode = {
        kind: Kind.OBJECT_TYPE_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: 'Query',
        },
        fields: [
          ...this.queryDefinitions,
        ],
      }
      definitions.push(queryObject)
    }

    if (this.mutationDefinitions.length) {
      const mutationObject: ObjectTypeDefinitionNode = {
        kind: Kind.OBJECT_TYPE_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: 'Mutation',
        },
        fields: [
          ...this.mutationDefinitions,
        ],
      }
      definitions.push(mutationObject)
    }

    if (this.subscriptionDefinitions.length) {
      const subscripitonObject: ObjectTypeDefinitionNode = {
        kind: Kind.OBJECT_TYPE_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: 'Subscription',
        },
        fields: [
          ...this.subscriptionDefinitions,
        ],
      }
      definitions.push(subscripitonObject)
    }

    const documentNode: Mutable<DocumentNode> = {
      kind: Kind.DOCUMENT,
      definitions,
    }

    return documentNode
  }

  getExtensionDefinitionsDocument(): DocumentNode {
    const definitions: Mutable<DefinitionNode[]> = [
      ...this.extensionTypeDefinitions,
      ...this.directiveDefinitions,
    ]

    if (this.extensionQueryDefinitions.length) {
      const queryObject: TypeExtensionNode = {
        kind: Kind.OBJECT_TYPE_EXTENSION,
        name: {
          kind: Kind.NAME,
          value: 'Query',
        },
        fields: [
          ...this.extensionQueryDefinitions,
        ],
      }
      definitions.push(queryObject)
    }

    if (this.extensionMutationDefinitions.length) {
      const mutationObject: TypeExtensionNode = {
        kind: Kind.OBJECT_TYPE_EXTENSION,
        name: {
          kind: Kind.NAME,
          value: 'Mutation',
        },
        fields: [
          ...this.extensionMutationDefinitions,
        ],
      }
      definitions.push(mutationObject)
    }

    if (this.extensionSubscriptionDefinitions.length) {
      const subscripitonObject: TypeExtensionNode = {
        kind: Kind.OBJECT_TYPE_EXTENSION,
        name: {
          kind: Kind.NAME,
          value: 'Subscription',
        },
        fields: [
          ...this.extensionSubscriptionDefinitions,
        ],
      }
      definitions.push(subscripitonObject)
    }

    const documentNode: Mutable<DocumentNode> = {
      kind: Kind.DOCUMENT,
      definitions,
    }

    return documentNode
  }

  /**
   * Get Resolvers
   */

  getDirectiveResolvers(): { [s: string]: any } {
    return { ...this.directiveResolvers }
  }

  getResolvers(): { [s: string]: any } {

    let definitions = {
      ...this.internalValues,
      ...this.typeResolvers,
    }

    if (Object.keys(this.queryResolvers).length) {
      definitions = {
        ...definitions,
        Query: { ...this.queryResolvers },
      }
    }
    if (Object.keys(this.mutationResolvers).length) {
      definitions = {
        ...definitions,
        Mutation: { ...this.mutationResolvers },
      }
    }
    if (Object.keys(this.subscriptionResolvers).length) {
      definitions = {
        ...definitions,
        Subscription: { ...this.subscriptionResolvers },
      }
    }

    return definitions
  }

  getExtensionResolvers(): { [s: string]: any } {

    let definitions = {
      ...this.extensionTypeResolvers,
    }

    if (Object.keys(this.extensionQueryResolvers).length) {
      definitions = {
        ...definitions,
        Query: { ...this.extensionQueryResolvers },
      }
    }
    if (Object.keys(this.extensionMutationResolvers).length) {
      definitions = {
        ...definitions,
        Mutation: { ...this.extensionMutationResolvers },
      }
    }
    if (Object.keys(this.extensionSubscriptionResolvers).length) {
      definitions = {
        ...definitions,
        Subscription: { ...this.extensionSubscriptionResolvers },
      }
    }

    return definitions
  }

  getExecutor(name: string): AsyncExecutor | null {
    return this.remoteSchemas?.[name]?.executor ?? null
  }

  getRemoteSchema(name: string): RegisterRemoteSchemaArgs | null {
    return this.remoteSchemas?.[name] || null
  }

  renameFields(fieldName: string): string {
    return camelCase(fieldName)
  }

  renameTypes(fieldName: string): string {
    return pascalCase(fieldName)
  }

  transformSchema(schema: GraphQLSchema, executor: AsyncExecutor, transforms: Transform<any, Record<string, any>>[] = []): GraphQLSchema {
    const wrappedSchema = wrapSchema({
      schema,
      executor,
      transforms: [
        new RenameTypes((name) => this.renameTypes(name)),
        new RenameRootTypes((name) => this.renameTypes(name)),
        new RenameRootFields((operationName, fieldName) => camelCase(fieldName)),
        new RenameObjectFields((typeName, fieldName) => this.renameFields(fieldName)),
        new RenameInterfaceFields((typeName, fieldName) => this.renameFields(fieldName)),
        new RenameInputObjectFields((typeName, fieldName) => this.renameFields(fieldName)),
        ...transforms,
      ],
    })
    return wrappedSchema
  }

  private async preStart(): Promise<void> {
    if (this.hasExecutedPreStart) {
      return
    }
    for (let p = 0; p < this.preStartFunctions.length; p++) {
      await this.preStartFunctions[p](this)
    }
    this.hasExecutedPreStart = true
  }

  async processPlugins(): Promise<void> {
    if (this.hasProcessedPlugins) {
      return
    }
    let schema = this.getDefinitionsDocument()
    let extensions = this.getExtensionDefinitionsDocument()
    for (let p = 0; p < this.plugins.length; p++) {
      const plugin = this.plugins[p]
      await plugin.setInitialSchema?.(schema, extensions)
    }
    for (let p = 0; p < this.plugins.length; p++) {

      const plugin = this.plugins[p]
      const schema = this.getDefinitionsDocument()
      const extensions = this.getExtensionDefinitionsDocument()
      await this.preProcessPluginUpdateTypes(schema, extensions, plugin)
    }
    for (let p = 0; p < this.plugins.length; p++) {

      const plugin = this.plugins[p]
      const schema = this.getDefinitionsDocument()
      const extensions = this.getExtensionDefinitionsDocument()

      await this.processPluginTypeDefinitions(schema, extensions, plugin)
      await this.processPluginTypeExtensionDefinitions(schema, extensions, plugin)
      await this.processPluginTypeResolvers(schema, extensions, plugin)
      await this.processPluginTypeExtensionResolvers(schema, extensions, plugin)

      await this.processPluginQueryDefinitions(schema, extensions, plugin)
      await this.processPluginQueryExtensionDefinitions(schema, extensions, plugin)
      await this.processPluginQueryResolvers(schema, extensions, plugin)
      await this.processPluginQueryExtensionResolvers(schema, extensions, plugin)

      await this.processPluginMutationDefinitions(schema, extensions, plugin)
      await this.processPluginMutationExtensionDefinitions(schema, extensions, plugin)
      await this.processPluginMutationResolvers(schema, extensions, plugin)
      await this.processPluginMutationExtensionResolvers(schema, extensions, plugin)

      await this.processPluginSubscriptionDefinitions(schema, extensions, plugin)
      await this.processPluginSubscriptionExtensionDefinitions(schema, extensions, plugin)
      await this.processPluginSubscriptionResolvers(schema, extensions, plugin)
      await this.processPluginSubscriptionExtensionResolvers(schema, extensions, plugin)

    }
    for (let p = 0; p < this.plugins.length; p++) {

      const plugin = this.plugins[p]
      const schema = this.getDefinitionsDocument()
      const extensions = this.getExtensionDefinitionsDocument()
      await this.processPluginDirectiveDefinitions(schema, extensions, plugin)
      await this.processPluginDirectiveResolvers(schema, extensions, plugin)

      await this.postProcessPluginUpdateTypes(schema, extensions, plugin)
    }
    schema = this.getDefinitionsDocument()
    extensions = this.getExtensionDefinitionsDocument()
    for (let p = 0; p < this.plugins.length; p++) {
      const plugin = this.plugins[p]
      await plugin.validateSchema?.(schema, extensions)
      await plugin.setFinalSchema?.(schema, extensions)
    }
    this.hasProcessedPlugins = true
  }

  private async updatePluginSchemas(): Promise<void> {
    for (let p = 0; p < this.plugins.length; p++) {

      const plugin = this.plugins[p]
      const schema = this.getDefinitionsDocument()
      const extensions = this.getExtensionDefinitionsDocument()
      plugin.schemaUpdated?.(schema, extensions)

    }
  }

  private async processPluginDirectiveDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const globalPluginDirectiveDefinitions = await plugin.addDirectiveDefinitions?.(schema, extensions)
    if (globalPluginDirectiveDefinitions) {
      this.mergeIncomingDirectives(globalPluginDirectiveDefinitions)
      await this.updatePluginSchemas()
    }

  }

  private async processPluginDirectiveResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const globalPluginDirectiveResolvers = await plugin.addDirectiveResolvers?.(schema, extensions)
    if (globalPluginDirectiveResolvers) {
      this.directiveResolvers = {
        ...this.directiveResolvers,
        ...globalPluginDirectiveResolvers,
      }
    }

  }

  private async preProcessPluginUpdateTypes(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const newTypeDefinitions: Mutable<TypeDefinitionNode[]> = []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const updatedTypeDefiniton = await plugin.addPrePropertiesToTypeDefinition?.(typeDefinition, schema, extensions)
      if (updatedTypeDefiniton) {
        newTypeDefinitions.push(updatedTypeDefiniton)
      }
    }
    if (newTypeDefinitions.length) {
      this.mergeIncomingTypes(newTypeDefinitions)
      await this.updatePluginSchemas()
    }

  }

  private async postProcessPluginUpdateTypes(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const newTypeDefinitions: Mutable<TypeDefinitionNode[]> = []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const updatedTypeDefiniton = await plugin.addPostPropertiesToTypeDefinition?.(typeDefinition, schema, extensions)
      if (updatedTypeDefiniton) {
        newTypeDefinitions.push(updatedTypeDefiniton)
      }
    }
    if (newTypeDefinitions.length) {
      this.mergeIncomingTypes(newTypeDefinitions)
      await this.updatePluginSchemas()
    }

  }

  private async processPluginTypeDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginTypeDefinitions = await plugin.addTypeDefinitions?.(schema, extensions)
    let didUpdate = false
    if (globalPluginTypeDefinitions) {
      this.mergeIncomingTypes(globalPluginTypeDefinitions)
      didUpdate = true
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginTypeDefinitions = await plugin.addTypeDefinitionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginTypeDefinitions) {
        this.mergeIncomingTypes(objectPluginTypeDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginTypeExtensionDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    let didUpdate = false
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginTypeDefinitions = await plugin.addTypeDefinitionExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginTypeDefinitions) {
        this.mergeIncomingExtensionTypes(objectPluginTypeDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginTypeResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginTypeResolvers = await plugin.addTypeResolvers?.(schema, extensions)
    if (globalPluginTypeResolvers) {
      this.typeResolvers = {
        ...this.typeResolvers,
        ...globalPluginTypeResolvers,
      }
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginTypeResolvers = await plugin.addTypeResolversForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginTypeResolvers) {
        this.typeResolvers = {
          ...this.typeResolvers,
          ...objectPluginTypeResolvers,
        }
      }
    }

  }

  private async processPluginTypeExtensionResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginTypeResolvers = await plugin.addTypeResolverExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginTypeResolvers) {
        this.extensionTypeResolvers = {
          ...this.extensionTypeResolvers,
          ...objectPluginTypeResolvers,
        }
      }
    }
  }

  private async processPluginQueryDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginQueryDefinitions = await plugin.addQueryDefinitions?.(schema, extensions)
    let didUpdate = false
    if (globalPluginQueryDefinitions) {
      this.mergeIncomingQueries(globalPluginQueryDefinitions)
      didUpdate = true
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginQueryDefinitions = await plugin.addQueryDefinitionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginQueryDefinitions) {
        this.mergeIncomingQueries(objectPluginQueryDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginQueryExtensionDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    let didUpdate = false
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginQueryDefinitions = await plugin.addQueryDefinitionExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginQueryDefinitions) {
        this.mergeIncomingExtensionQueries(objectPluginQueryDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginQueryResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginQueryResolvers = await plugin.addQueryResolvers?.(schema, extensions)
    if (globalPluginQueryResolvers) {
      this.queryResolvers = {
        ...this.queryResolvers,
        ...globalPluginQueryResolvers,
      }
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginQueryResolvers = await plugin.addQueryResolversForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginQueryResolvers) {
        this.queryResolvers = {
          ...this.queryResolvers,
          ...objectPluginQueryResolvers,
        }
      }
    }

  }

  private async processPluginQueryExtensionResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginQueryResolvers = await plugin.addQueryResolverExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginQueryResolvers) {
        this.extensionQueryResolvers = {
          ...this.extensionQueryResolvers,
          ...objectPluginQueryResolvers,
        }
      }
    }

  }

  private async processPluginMutationDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginMutationDefinitions = await plugin.addMutationDefinitions?.(schema, extensions)
    let didUpdate = false
    if (globalPluginMutationDefinitions) {
      this.mergeIncomingMutations(globalPluginMutationDefinitions)
      didUpdate = true
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginMutationDefinitions = await plugin.addMutationDefinitionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginMutationDefinitions) {
        this.mergeIncomingMutations(objectPluginMutationDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginMutationExtensionDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    let didUpdate = false
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginMutationDefinitions = await plugin.addMutationDefinitionExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginMutationDefinitions) {
        this.mergeIncomingExtensionMutations(objectPluginMutationDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginMutationResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginMutationResolvers = await plugin.addMutationResolvers?.(schema, extensions)
    if (globalPluginMutationResolvers) {
      this.mutationResolvers = {
        ...this.mutationResolvers,
        ...globalPluginMutationResolvers,
      }
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginMutationResolvers = await plugin.addMutationResolversForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginMutationResolvers) {
        this.mutationResolvers = {
          ...this.mutationResolvers,
          ...objectPluginMutationResolvers,
        }
      }
    }

  }

  private async processPluginMutationExtensionResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginMutationResolvers = await plugin.addMutationResolverExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginMutationResolvers) {
        this.extensionMutationResolvers = {
          ...this.extensionMutationResolvers,
          ...objectPluginMutationResolvers,
        }
      }
    }

  }

  private async processPluginSubscriptionDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginSubscriptionDefinitions = await plugin.addSubscriptionDefinitions?.(schema, extensions)
    let didUpdate = false
    if (globalPluginSubscriptionDefinitions) {
      this.mergeIncomingSubscriptions(globalPluginSubscriptionDefinitions)
      didUpdate = true
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginSubscriptionDefinitions = await plugin.addSubscriptionDefinitionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginSubscriptionDefinitions) {
        this.mergeIncomingSubscriptions(objectPluginSubscriptionDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginSubscriptionExtensionDefinitions(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: Mutable<TypeDefinitionNode[]> = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    let didUpdate = false
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginSubscriptionDefinitions = await plugin.addSubscriptionDefinitionExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginSubscriptionDefinitions) {
        this.mergeIncomingExtensionSubscriptions(objectPluginSubscriptionDefinitions)
        didUpdate = true
      }
    }
    if (didUpdate) {
      await this.updatePluginSchemas()
    }

  }

  private async processPluginSubscriptionResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    const globalPluginSubscriptionResolvers = await plugin.addSubscriptionResolvers?.(schema, extensions)
    if (globalPluginSubscriptionResolvers) {
      this.subscriptionResolvers = {
        ...this.subscriptionResolvers,
        ...globalPluginSubscriptionResolvers,
      }
    }
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginSubscriptionResolvers = await plugin.addSubscriptionResolversForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginSubscriptionResolvers) {
        this.subscriptionResolvers = {
          ...this.subscriptionResolvers,
          ...objectPluginSubscriptionResolvers,
        }
      }
    }

  }

  private async processPluginSubscriptionExtensionResolvers(schema: DocumentNode, extensions: DocumentNode, plugin: GQLRegistryPlugin): Promise<void> {

    const typeDefinitions: TypeDefinitionNode[] = schema.definitions as Mutable<TypeDefinitionNode[]> ?? []
    for (let d = 0; d < typeDefinitions.length; d++) {
      const typeDefinition = typeDefinitions[d]
      const objectPluginSubscriptionResolvers = await plugin.addSubscriptionResolverExtensionsForTypeDefinition?.(typeDefinition, schema, extensions)
      if (objectPluginSubscriptionResolvers) {
        this.extensionSubscriptionResolvers = {
          ...this.extensionSubscriptionResolvers,
          ...objectPluginSubscriptionResolvers,
        }
      }
    }

  }

  getPlugin(name: string): GQLRegistryPlugin {
    const plugin = this.plugins.find((plu) => plu.name === name)
    if (!plugin) {
      throw new GraphQLError(`Cannot find registry plugin with name ${name}`)
    }
    return plugin
  }

  async getFederatableSchema(): Promise<GraphQLSchema> {
    await this.preStart()
    await this.processPlugins()
    let localSchema = makeExecutableSchema({
      typeDefs: this.getDefinitionsDocument(),
      resolvers: this.getResolvers(),
    })
    for (let d = 0; d < Object.keys(this.directiveResolvers).length; d++) {
      localSchema = this.directiveResolvers[Object.keys(this.directiveResolvers)[d]](localSchema)
    }
    return localSchema
  }

  async getSchema(): Promise<GraphQLSchema> {
    await this.preStart()
    await this.processPlugins()
    const localSchema = makeExecutableSchema({
      typeDefs: this.getDefinitionsDocument(),
    })
    const remoteSchemas: (GraphQLSchema)[] = []
    for (let r = 0; r < Object.keys(this.remoteSchemas).length; r++) {
      const name = Object.keys(this.remoteSchemas)[r]
      const executor = this.remoteSchemas[name].executor
      const transforms = this.remoteSchemas[name].transforms
      if (this.remoteSchemas[name].asyncSchema) {
        const schema = await this.remoteSchemas[name].asyncSchema?.()
        if (schema) {
          const wrappedSchema = this.transformSchema(schema, executor, transforms)
          remoteSchemas.push(wrappedSchema)
          this.remoteSchemas[name].executable = wrappedSchema
        }
      } else if (this.remoteSchemas[name].schema) {
        const schema = await this.remoteSchemas[name].schema
        if (schema) {
          const wrappedSchema = this.transformSchema(schema, executor, transforms)
          remoteSchemas.push(wrappedSchema)
          this.remoteSchemas[name].executable = wrappedSchema
        }
      }
    }
    const gatewaySchema = stitchSchemas({
      subschemas: [localSchema, ...remoteSchemas],
      mergeTypes: true,
      typeDefs: this.getExtensionDefinitionsDocument(),
    })
    return gatewaySchema
  }

  async getExecutableSchema(): Promise<GraphQLSchema> {
    await this.preStart()
    await this.processPlugins()
    if (!this.executableSchema) {
      const localSchema = makeExecutableSchema({
        typeDefs: this.getDefinitionsDocument(),
        resolvers: this.getResolvers(),
      })
      const remoteSchemas: (GraphQLSchema)[] = []
      for (let r = 0; r < Object.keys(this.remoteSchemas).length; r++) {
        const name = Object.keys(this.remoteSchemas)[r]
        const executor = this.remoteSchemas[name].executor
        const transforms = this.remoteSchemas[name].transforms
        if (this.remoteSchemas[name].asyncSchema) {
          const schema = await this.remoteSchemas[name].asyncSchema?.()
          if (schema) {
            const wrappedSchema = this.transformSchema(schema, executor, transforms)
            remoteSchemas.push(wrappedSchema)
            this.remoteSchemas[name].executable = wrappedSchema
          }
        } else if (this.remoteSchemas[name].schema) {
          const schema = await this.remoteSchemas[name].schema
          if (schema) {
            const wrappedSchema = this.transformSchema(schema, executor, transforms)
            remoteSchemas.push(wrappedSchema)
            this.remoteSchemas[name].executable = wrappedSchema
          }
        }
      }
      let gatewaySchema = stitchSchemas({
        subschemas: [localSchema, ...remoteSchemas],
        mergeTypes: true,
        typeDefs: this.getExtensionDefinitionsDocument(),
        resolvers: this.getExtensionResolvers(),
      })
      for (let d = 0; d < Object.keys(this.directiveResolvers).length; d++) {
        gatewaySchema = this.directiveResolvers[Object.keys(this.directiveResolvers)[d]](gatewaySchema)
      }
      this.executableSchema = gatewaySchema
    }
    return this.executableSchema!
  }

}
