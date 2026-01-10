import paper from "paper";
import type { RenderParams } from "./params.js";

export type RenderInput = {
  params: RenderParams;
  mbtaData: any;
};

// Browser-friendly rendering: caller provides a canvas OR we create one.
// For CLI (Node), we’ll use paper-jsdom in the CLI package and still call this.
export function renderSvg({ params, mbtaData }: RenderInput): string {
  // Create an offscreen canvas in browser; in Node, paper-jsdom sets this up.
  const canvas =
    typeof document !== "undefined"
      ? (document.createElement("canvas") as HTMLCanvasElement)
      : (null as any);

  paper.setup(canvas);

  // Use an explicit view size so exportSVG has the right dimensions
  paper.view.viewSize = new paper.Size(params.width, params.height);

  // --- DRAWING START ---
  // Replace this placeholder with your actual drawing logic
  const rect = new paper.Path.Rectangle({
    point: [20, 20],
    size: [params.width - 40, params.height - 40],
    strokeColor: new paper.Color("black"),
    strokeWidth: params.strokeWidth
  });

  // Example: use mbtaData somehow (placeholder)
  // console.log("mbtaData", mbtaData);

  rect.rotate(0);
  // --- DRAWING END ---

  // Export SVG as a string
  const svgNode = paper.project.exportSVG({ asString: true });
  paper.project.clear();
  return String(svgNode);
}
