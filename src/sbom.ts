export interface Sbom {
  readonly metadata: {
    readonly tools: {
      readonly components: unknown[];
    };
  };
  readonly [key: string]: unknown;
}
