export interface FlankColors {
  /** You flank this enemy (or would, from here). */
  flanking: number;
  /** Something is flanked, but not thanks to you. */
  otherFlanked: number;
  /** You are the one being flanked. */
  flanked: number;
  /** Squares you could move to. */
  placement: number;
}

export const DEFAULT_COLORS: FlankColors = {
  flanking: 0x33bc4e,
  otherFlanked: 0xf1d836,
  flanked: 0xe72124,
  placement: 0x43dfdf,
};

/**
 * Colors live on CONFIG so a world can restyle the overlay from a macro or another module:
 * `CONFIG.pf2eFlankVision.colors.flanking = 0xff00ff`.
 */
export function registerColors(): void {
  CONFIG.pf2eFlankVision = { colors: { ...DEFAULT_COLORS } };
}

export function colors(): FlankColors {
  return CONFIG.pf2eFlankVision.colors;
}
