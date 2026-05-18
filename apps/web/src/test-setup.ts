import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});

(globalThis as unknown as Record<string, unknown>).window = dom.window;
(globalThis as unknown as Record<string, unknown>).document = dom.window.document;
(globalThis as unknown as Record<string, unknown>).navigator = dom.window.navigator;

dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return null;
} as unknown as typeof HTMLCanvasElement.prototype.getContext;