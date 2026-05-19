import { createInitialState } from "./state.js";
import { buildLayout, render } from "./renderer.js";

function main(): void {
  const state = createInitialState();
  const elements = buildLayout(state, () => render(state, elements));
  render(state, elements);
}

main();