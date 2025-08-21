import React, { createElement } from "react";
import { Draggable } from "@hello-pangea/dnd";

export function Card({ card, index, cardContent, readOnly = false }) {
    const body =
        card.mxObj && cardContent?.get ? cardContent.get(card.mxObj) : cardContent ?? card.title ?? String(card.id);

    return (
        <Draggable draggableId={String(card.id)} index={index} isDragDisabled={readOnly}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={"kbn-card" + (snapshot.isDragging ? " kbn-card--dragging" : "")}
                >
                    {body}
                </div>
            )}
        </Draggable>
    );
}
