// Ambient declarations for dependencies that do not ship their own types.
// mqemitter 7.x ships its own declarations, so it must NOT be redeclared here — a local
// declaration would shadow the real ones and hide their errors.

declare module 'aedes-persistence-level' {
  import type { AbstractPersistence } from 'aedes-persistence'

  /**
   * Wraps a `level` database as an aedes persistence layer. Pass a `Level` instance:
   * `aedesPersistenceLevel(new Level('./mydb'))`.
   */
  const aedesPersistenceLevel: (db: unknown) => AbstractPersistence
  export default aedesPersistenceLevel
}
