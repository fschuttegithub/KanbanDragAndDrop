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
    readOnly = false
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

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className={"kbn-board" + (readOnly ? " kbn-board--readonly" : "")}>
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
                    />
                ))}
            </div>
        </DragDropContext>
    );
}
