import { createElement } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Card } from "./Card";

export function Lane({
    lane,
    cards,
    laneMeta,
    onLoadMore,
    loadMoreLabel = "Load more",
    laneContent,
    cardContent,
    enableLaneBottomSheet,
    laneBottomSheet,
    enableLaneEmptySheet,
    laneEmptySheet,
    readOnly = false
}) {
    const header = laneContent?.get?.(lane.mxObj) ?? laneContent ?? `${lane.title ?? "Lane"} (${cards.length})`;
    const hiddenCount = laneMeta?.hidden ?? 0;
    const canLoadMore = typeof onLoadMore === "function" && hiddenCount > 0;

    const laneWidthStyle =
        typeof lane.widthCss === "string"
            ? lane.widthCss
            : typeof lane.widthCss === "number"
            ? `${lane.widthCss}px`
            : "500px";

    return (
        <div className="kbn-lane" style={{ "--lane-width": laneWidthStyle }}>
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
                                      cardContent={cardContent}
                                      readOnly={readOnly}
                                  />
                              ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
            {typeof onLoadMore === "function" && canLoadMore ? (
                <button
                    type="button"
                    className="btn btn-primary kbn-lane-loadmore"
                    onClick={() => onLoadMore(String(lane.id))}
                >
                    {loadMoreLabel}
                </button>
            ) : null}

            {enableLaneBottomSheet ? (
                <div className={"kbn-lane-bottom" + (cards.length > 0 ? " kbn-lane-bottom--with-cards" : "")}>
                    {laneBottomSheet?.get?.(lane.mxObj) ?? laneBottomSheet}
                </div>
            ) : null}
        </div>
    );
}
