import React, { createElement } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Card } from "./Card";

export function Lane({
    lane,
    cards,
    compactCards,
    laneContent,
    cardContent,
    enableLaneBottomSheet,
    laneBottomSheet,
    enableLaneEmptySheet,
    laneEmptySheet,
    readOnly = false
}) {
    const header = laneContent?.get?.(lane.mxObj) ?? laneContent ?? `${lane.title ?? "Lane"} (${cards.length})`;

    const laneWidthStyle =
        typeof lane.widthCss === "string"
            ? lane.widthCss
            : typeof lane.widthCss === "number"
            ? `${lane.widthCss}px`
            : "500px";

    return (
        <div className="kbn-lane" style={{ ["--lane-width"]: laneWidthStyle }}>
            <div className="kbn-lane-title">{header}</div>

            <Droppable droppableId={String(lane.id)} type="CARD" isDropDisabled={readOnly}>
                {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="kbn-lane-cards">
                        {cards.length === 0 && enableLaneEmptySheet
                            ? laneEmptySheet?.get?.(lane.mxObj) ?? laneEmptySheet
                            : cards.map((card, index) => (
                                  <Card
                                      key={card.id}
                                      card={card}
                                      index={index}
                                      compact={compactCards}
                                      cardContent={cardContent}
                                      readOnly={readOnly}
                                  />
                              ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            {enableLaneBottomSheet ? (
                <div className={"kbn-lane-bottom" + (cards.length > 0 ? " kbn-lane-bottom--with-cards" : "")}>
                    {laneBottomSheet?.get?.(lane.mxObj) ?? laneBottomSheet}
                </div>
            ) : null}
        </div>
    );
}
