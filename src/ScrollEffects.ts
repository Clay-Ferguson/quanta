/**
 * ScrollEffects.ts
 * 
 * This class is used to handle a specific pattern of code which lets us have components that 
 * remember their scroll position even after being unmounted and remounted.
 * 
 * Steps to use this are:
 * 1. Create a ref for the component (must have unique DOM id) you want to remember the scroll position of.
 * 2. Call the `layoutEffect` method in a `useLayoutEffect` hook, passing the ref and a boolean indicating whether to scroll to the bottom.
 * 
 * For example put this sequence of calls in the component function:
 *
 *     const elmRef = useRef<HTMLDivElement>(null);
 *     useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
 *     useEffect(() => scrollEffects.effect(elmRef), []);
 * 
 * And also be sure there's a ref like this on the compnonent that scrolls, which may or may not be the top level HTML rendered by
 * the element, but it's ok because the "ID" is unique  and is what is used to remember the scroll position.
 * 
 *     <div id="docContent" ref={elmRef} className="overflow-y-auto ...">...</div>
 * 
 * Remember, because of the "React Rules of Hooks" you must call these in the component function, not in a nested function or callback, and
 * they must always be called (no conditionals) and called in the same order.
 */
class ScrollEffects {
    scrollPositions = new Map<string, number>();

    // Layout effect ensures scrolling happens before browser paint, which prevents any visible flicker
    layoutEffect = (elmRef: any, defaultToBottom: boolean) => {
        if (elmRef.current) {
            const savedPos = this.scrollPositions.get(elmRef.current?.id);
            console.log(`Restoring scroll position for ${elmRef.current?.id}: ${savedPos}`);
            if (savedPos !== undefined) {
                // Restore previous scroll position if available
                elmRef.current.scrollTop = savedPos;
            } else {
                if (defaultToBottom) {
                    // Default to scrolling to bottom
                    elmRef.current.scrollTop = elmRef.current.scrollHeight;
                }
            }
        }
    }
    
    // Handle scroll events to save position
    effect = (elmRef: any) => {
        const elm = elmRef.current;
        if (!elm) return;
    
        const handleScroll = () => {
            const elm = elmRef.current;
            if (!elm) return;
            
            // Only save scroll position if user has manually scrolled (not at the bottom)
            const isAtBottom = elm.scrollHeight - elm.scrollTop <= elm.clientHeight + 50;
            
            if (!isAtBottom) {
                // console.log(`Saving scroll position for ${elmRef.current?.id}: ${elm.scrollTop}`);
                this.scrollPositions.set(elmRef.current?.id, elm.scrollTop);
            } else {
                // console.log(`Saving scroll position for ${elmRef.current?.id}: BOTTOM`);
                this.scrollPositions.delete(elmRef.current?.id);
            }
        };
        elm.addEventListener('scroll', handleScroll);
        return () => {
            elm.removeEventListener('scroll', handleScroll);
        };
    }    
}

export const scrollEffects = new ScrollEffects();

