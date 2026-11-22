import { getAbsoluteSVGCoordinates, setHasExact } from "../../utils.mjs";
import { GlobalKeyEventsManager } from "../modelling/events/GlobalKeyEventsManager.mjs";

export class DrawingViewportManager {
    
    /** @type {SVGElement} */
    #svgElement;

    #view = {
        states: {
            offset: { x: 0, y: 0 },
            zoom: 1,
        }, 
        motion: {
            zoomFactor: 1.05,
            moveFactor: { x: 16, y: 16 }
        }
    };

    /** @type {(states: { offset: { x, y }, zoom }) => void} */
    onUpdateListener;

    constructor(svgElement, states) {
        this.#svgElement = svgElement;
        if(states) {
            this.#view.states = states;
            requestAnimationFrame(() => this.#updateViewport());
        }

        this.#initialize();
    }

    #initialize() {
        GlobalKeyEventsManager.listen(this.#svgElement, (keys, scrollDirection, relativeCursorPosition) => {
            if(keys.size === 0) {
                this.move(0, scrollDirection);
            } else if(setHasExact(keys, "Control")) {
                // const { x: cx, y: cy } = cursorPosition;
                // const { x: ox, y: oy } = this.#svgElement.getBoundingClientRect();
                
                relativeCursorPosition = relativeCursorPosition || { x: 0, y: 0 };

                if(scrollDirection < 0) this.zoomIn(relativeCursorPosition);
                else if(scrollDirection > 0) this.zoomOut(relativeCursorPosition);

            } else if(setHasExact(keys, "Shift")) {
                this.move(scrollDirection, 0);
            } else if(setHasExact(keys, "Control", "=")) {
                this.zoomIn();
            } else if(setHasExact(keys, "Control", "-")) {
                this.zoomOut();
            } else if(setHasExact(keys, "Control", "0")) {
                this.fitToView();
            }
        });
    }

    move(directionX, directionY) {
        const { states, motion } = this.#view;
        states.offset.x += Math.sign(directionX) * motion.moveFactor.x;
        states.offset.y += Math.sign(directionY) * motion.moveFactor.y;

        this.#updateViewport();
    }

    /**
     * 
     * @param {number} zoomFactor 
     * @param {{ x: number, y: number }} relativeCursorPosition 
     */
    #zoom(zoomFactor, relativeCursorPosition) {
        this.#view.states.zoom *= zoomFactor;

        // const relativeReoffsetX = (zoomFactor-1)*relativeCursorPosition.x;
        // const relativeReoffsetY = (zoomFactor-1)*relativeCursorPosition.y;
        // const drawingCursorPosition = this.getAbsolutePosition(relativeCursorPosition.x, relativeCursorPosition.y);

        // this.#view.states.offset.x += (zoomFactor-1)*drawingCursorPosition.x;
        // this.#view.states.offset.y += (zoomFactor-1)*drawingCursorPosition.y;
        
        this.#updateViewport();
    }

    zoomIn(relativeCursorPosition) {
        this.#zoom(this.#view.motion.zoomFactor, relativeCursorPosition);
    }

    zoomOut(relativeCursorPosition) {
        this.#zoom(1/this.#view.motion.zoomFactor, relativeCursorPosition);
    }

        /**
     * Zooms and pans so that all drawn content (vertices, arcs, RBS boxes)
     * is centered and fully visible.
     *
     * @param {{ padding?: number, minZoom?: number, maxZoom?: number }} options
     * @returns {boolean} true if the viewport was updated
     */
    fitToView({ padding = 60, minZoom = 0.05, maxZoom = 1.5 } = {}) {
        const { width, height } = this.#svgElement.getBoundingClientRect();
        if(width === 0 || height === 0) return false; // not visible yet

        const layers = this.#svgElement.querySelectorAll(
            ":scope > .group-rbs, :scope > .group-arcs, :scope > .group-vertices");

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for(const layer of layers) {
            let box;
            try { box = layer.getBBox(); } catch { continue; }
            if(box.width === 0 && box.height === 0) continue;

            minX = Math.min(minX, box.x);
            minY = Math.min(minY, box.y);
            maxX = Math.max(maxX, box.x + box.width);
            maxY = Math.max(maxY, box.y + box.height);
        }

        const { states } = this.#view;

        if(!isFinite(minX)) {
            // Nothing drawn: reset to the default view
            states.zoom = 1;
            states.offset = { x: 0, y: 0 };
            this.#updateViewport();
            return true;
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const zoom = Math.min(
            width / (contentW + padding * 2),
            height / (contentH + padding * 2)
        );
        states.zoom = Math.min(maxZoom, Math.max(minZoom, zoom));

        // Center the content in the viewport
        states.offset = {
            x: minX - (width / states.zoom - contentW) / 2,
            y: minY - (height / states.zoom - contentH) / 2
        };

        this.#updateViewport();
        return true;
    }

    #updateViewport() {
        const { width, height } = this.#svgElement.getBoundingClientRect();
        if(width === 0 || height === 0) return;

        const { offset, zoom } = this.#view.states;

        const viewBox = `${offset.x} ${offset.y} ${width/zoom} ${height/zoom}`;
        this.#svgElement.setAttribute("viewBox", viewBox);

        if(this.onUpdateListener) this.onUpdateListener({
            offset: {...offset}, zoom
        });
    }

    refresh() {
        this.#updateViewport();
    }

    setStates(states) {
        if(!states) return;
        requestAnimationFrame(() => {
            this.#view.states = states;
            this.#updateViewport();
        });
    }

    getAbsolutePosition(x, y) {
        const { offset, zoom } = this.#view.states;

        return { 
            x: x*zoom + offset.x, 
            y: y*zoom + offset.y
        };
    }
}