export = PStree;

declare function PStree(
  pid: number,
  callback: (err: string, children: PStree.Proc[]) => void
): void;

declare namespace PStree {
  export interface Proc {
    PID: number;
    PPID?: number;
    COMMAND?: string;
    STAT?: string;
  }
}
