// Implements a pseudo random number generator to match the original Tagtime Ping schedule
// This isn't a perfect algorithm, see https://github.com/tagtime/TagTime/issues/62
export class RandomGenerator {
  private IA: number = 16807;
  private IM: number = 2147483647;
  private seed: number = 0;
  public setSeed(seed : number){
    this.seed = seed;
  }
  public ran0() {
    this.seed = this.IA * this.seed % this.IM;
    return this.seed/this.IM
  }
}
