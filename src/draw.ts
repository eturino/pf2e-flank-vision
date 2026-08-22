import type { Bounds, Point } from "./geometry.ts";

export const COLORS = {
  /** You flank this enemy (or would, from here). */
  flanking: 0x33bc4e,
  /** Something is flanked, but not thanks to you. */
  otherFlanked: 0xf1d836,
  /** You are the one being flanked. */
  flanked: 0xe72124,
  /** Squares you could move to. */
  placement: 0x43dfdf,
} as const;

let layer: any = null;

export function overlay(): any {
  if (!layer || layer.destroyed) {
    layer = new PIXI.Graphics();
    layer.eventMode = "none";
    canvas.tokens.addChild(layer);
  }
  return layer;
}

export function clearOverlay(): void {
  layer?.clear();
}

export function destroyOverlay(): void {
  layer?.destroy();
  layer = null;
}

function thickness(): number {
  return CONFIG.Canvas.objectBorderThickness;
}

export function outline(bounds: Bounds, color: number, alpha = 0.8): void {
  overlay()
    .lineStyle(thickness() * 1.5, 0x000000, alpha * 0.5)
    .drawRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top)
    .lineStyle(thickness(), color, alpha)
    .drawRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
}

export function line(a: Point, b: Point, color: number, alpha = 0.6): void {
  overlay()
    .lineStyle(thickness() * 1.5, 0x000000, alpha * 0.5)
    .moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .lineStyle(thickness(), color, alpha)
    .moveTo(a.x, a.y)
    .lineTo(b.x, b.y);
}

export function dot(point: Point, color: number, radius: number, alpha = 0.7): void {
  overlay()
    .lineStyle(1, 0x000000, alpha)
    .beginFill(color, alpha)
    .drawCircle(point.x, point.y, radius)
    .endFill();
}
