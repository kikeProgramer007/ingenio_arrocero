// src/shared/AbstractMapper.ts
export abstract class AbstractMapper<S, D> {
    /**  
     * Convierte un objeto de tipo S a tipo D  
     */
    abstract map(source: S): D;
  
    /**  
     * (Opcional) Mapear un array completo  
     */
    mapArray(sources: S[]): D[] {
      return sources.map(s => this.map(s));
    }
  }
  