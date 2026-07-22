import { useCallback, useEffect, useRef } from "react";
import { Draggable } from "@hello-pangea/dnd";

export function Card({ card, index, cardContent, readOnly = false, style, onMeasure, measureAxis = "height" }) {
    const body =
        card.mxObj && cardContent?.get ? cardContent.get(card.mxObj) : cardContent ?? card.title ?? String(card.id);

    const nodeRef = useRef(null);

    // Report the card's natural size so the virtual list can size its row slot.
    useEffect(() => {
        const node = nodeRef.current;
        if (!node || typeof onMeasure !== "function") return undefined;
        const report = () => {
            const rect = node.getBoundingClientRect();
            onMeasure(String(card.id), Math.ceil(measureAxis === "width" ? rect.width : rect.height));
        };
        report();
        if (typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver(report);
        observer.observe(node);
        return () => observer.disconnect();
    }, [card.id, onMeasure, measureAxis, body]);

    const setRef = useCallback(node => {
        nodeRef.current = node;
    }, []);

    // Strip react-window's fixed main-axis size so the card sizes to its content;
    // keep the rest of the positioning styles (absolute placement, cross axis).
    const { height, width, ...restStyle } = style || {};
    const positioning = measureAxis === "width" ? { height } : { width };

    return (
        <Draggable draggableId={String(card.id)} index={index} key={String(card.id)} isDragDisabled={readOnly}>
            {(provided, snapshot) => (
                // Outer "slot" is what react-window positions and what we measure —
                // its padding is the inter-card gap and is included in the measured size.
                <div
                    ref={node => {
                        setRef(node);
                        provided.innerRef(node);
                    }}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{ ...restStyle, ...positioning, ...provided.draggableProps.style }}
                    className={"kbn-card-slot kbn-card-slot--" + measureAxis}
                >
                    <div className={"kbn-card" + (snapshot.isDragging ? " kbn-card--dragging" : "")}>{body}</div>
                </div>
            )}
        </Draggable>
    );
}
