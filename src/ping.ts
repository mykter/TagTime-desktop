/**
 * Pings have:
 *  .time  javascript time - milliseconds since unix epoch
 *  .tags
 *  .comment the contents in [] at the end of an entry
 */
export class Ping {
  constructor(
    public time: number,
    public tags: Set<string>,
    public comment: string
  ) {
    this.time = time;
    this.tags = tags;
    this.comment = comment;
  }
}
