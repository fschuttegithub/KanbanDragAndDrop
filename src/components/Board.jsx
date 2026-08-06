import { DragDropContext } from "@hello-pangea/dnd";
import { Lane } from "./Lane";
import { useCallback } from "react";

export function Board({
    lanes,
    cardsByLane,
    onCardMove,
    onLoadMore,
    loadMoreLabel = "Load more",
    loadMoreMode = "LaneButtons",
    hasMore = false,
    isLoadingMore = false,
    loadedCount = 0,
    minCardsPerLane = 0,
    laneWidth,
    laneBodyHeight,
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
                        onLoadMore={onLoadMore}
                        loadMoreLabel={loadMoreLabel}
                        loadMoreMode={loadMoreMode}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingMore}
                        loadedCount={loadedCount}
                        minCardsPerLane={minCardsPerLane}
                        laneBodyHeight={laneBodyHeight}
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
