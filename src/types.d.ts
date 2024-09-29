import Global = NodeJS.Global;

export { }
export interface GlobalThis extends Global {
  __basedir: string
}

declare global {

  export interface GQLContext { }

  namespace NodeJS {
    interface Global {
      __basedir: string
    }
  }

}
