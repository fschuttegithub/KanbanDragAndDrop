import { createElement, useCallback } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { Lane } from "./Lane";

export function Board({
    lanes,
    cardsByLane,
    laneMetadata = {},
    onCardMove,
    onLoadMoreLane,
    loadMoreLabel = "Load more",
    laneWidth,
    laneContent,
    cardContent,
    enableLaneBottomSheet,
    laneBottomSheet,
    enableLaneEmptySheet,
    laneEmptySheet,
    readOnly = false,
    renderType = "Vertical"
}) {
    const handleDragEnd = useCallback(
        result => {
            if (readOnly) return;
            const { destination } = result;
            if (!destination) return;
            onCardMove(result);
        },
        [onCardMove, readOnly]
    );

    const orientationClass = renderType === "Horizontal" ? "kbn-board--horizontal" : "kbn-board--vertical";
    const boardClasses = ["kbn-board", orientationClass];
    if (readOnly) {
        boardClasses.push("kbn-board--readonly");
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className={boardClasses.join(" ")}>
                {lanes.map(lane => (
                    <Lane
                        key={lane.id}
                        lane={{ ...lane, widthCss: laneWidth }}
                        cards={cardsByLane[lane.id] || []}
                        laneMeta={laneMetadata[lane.id]}
                        onLoadMore={onLoadMoreLane}
                        loadMoreLabel={loadMoreLabel}
                        laneContent={laneContent}
                        cardContent={cardContent}
                        enableLaneBottomSheet={enableLaneBottomSheet}
                        laneBottomSheet={laneBottomSheet}
                        enableLaneEmptySheet={enableLaneEmptySheet}
                        laneEmptySheet={laneEmptySheet}
                        readOnly={readOnly}
                        renderType={renderType}
                    />
                ))}
            </div>
        </DragDropContext>
    );
}
