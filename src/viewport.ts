// Intersection notifications can lag behind a resize or restored viewport.
// Recheck a hidden canvas occasionally so it cannot remain blank on screen.
export function observeViewport(element: HTMLElement) {
  let inView = true, lastCheck = 0;
  const observer = new IntersectionObserver(entries => { inView = entries[entries.length - 1].isIntersecting; });
  observer.observe(element);
  return {
    canRender() {
      if (document.hidden) return false;
      if (!inView && performance.now() - lastCheck > 250) {
        lastCheck = performance.now();
        const rect = element.getBoundingClientRect();
        inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
      }
      return inView;
    },
    disconnect() { observer.disconnect(); },
  };
}
