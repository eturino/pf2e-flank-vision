import { colors } from "./colors.ts";
import type { Bounds, Point } from "./geometry.ts";

let layer: PIXI.Graphics | null = null;

export function overlay(): PIXI.Graphics {
  if (!layer || layer.destroyed) {
    layer = new PIXI.Graphics();
    layer.eventMode = "none";
    canvas.tokens.addChild(layer);
  }
  return layer;
}

export function clearOverlay(): void {
  // clear() and destroy() both throw on an already-destroyed Graphics, and this runs first
  // in every render - an unguarded throw here would stop the module drawing for good
  if (layer && !layer.destroyed) layer.clear();
}

export function destroyOverlay(): void {
  if (layer && !layer.destroyed) layer.destroy();
  layer = null;
}

function thickness(): number {
  return CONFIG.Canvas.objectBorderThickness;
}

export function outline(bounds: Bounds, color: number, alpha = 0.8): void {
  const { left, top, right, bottom } = bounds;
  overlay()
    .lineStyle(thickness() * 1.5, 0x000000, alpha * 0.5)
    .drawRect(left, top, right - left, bottom - top)
    .lineStyle(thickness(), color, alpha)
    .drawRect(left, top, right - left, bottom - top);
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
