export = fkill;

declare function fkill(processes: number|string|(number|string)[], options?:fkill.Options): Promise<void>;

declare namespace fkill{
  export interface Options {
    force?: boolean;
    tree?: boolean;
    ignoreCase?: boolean;
  }
}
