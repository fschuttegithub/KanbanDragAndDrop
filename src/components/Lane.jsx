import { useCallback, useEffect, useMemo, useRef } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { Card } from "./Card";
import { Droppable } from "@hello-pangea/dnd";
import { VariableSizeList } from "react-window";

const DEFAULT_ROW_SIZE = 80;

// Module-scope row so the list doesn't remount rows on every parent render.
function VirtualRow({ data, index, style }) {
    const card = data.cards[index];
    // Extra slot rendered while a card hovers over an empty/short list.
    if (!card) return null;
    return (
        <Card
            card={card}
            index={index}
            cardContent={data.cardContent}
            readOnly={data.readOnly}
            style={style}
            onMeasure={data.setRowSize}
            measureAxis={data.horizontal ? "width" : "height"}
        />
    );
}

export function Lane({
    lane,
    cards,
    onLoadMore,
    loadMoreLabel = "Load more",
    loadMoreMode = "LaneButtons",
    hasMore = false,
    isLoadingMore = false,
    laneBodyHeight = "600px",
    laneContent,
    cardContent,
    enableLaneBottomSheet,
    laneBottomSheet,
    enableLaneEmptySheet,
    laneEmptySheet,
    readOnly = false,
    renderType = "Vertical"
}) {
    const header = laneContent?.get?.(lane.mxObj) ?? laneContent ?? `${lane.title ?? "Lane"} (${cards.length})`;
    const showLaneButton = loadMoreMode === "LaneButtons" && typeof onLoadMore === "function" && hasMore;
    const autoLoad = loadMoreMode === "AutoScroll";

    const laneWidthStyle =
        typeof lane.widthCss === "string"
            ? lane.widthCss
            : typeof lane.widthCss === "number"
            ? `${lane.widthCss}px`
            : "500px";

    const orientation = renderType === "Horizontal" ? "horizontal" : "vertical";
    const horizontal = orientation === "horizontal";
    const laneClassName = `kbn-lane kbn-lane--${orientation}`;
    const laneBodyClassName = `kbn-lane-body kbn-lane-body--${orientation}`;

    // -------- measured row sizes for the variable-size virtual list --------
    const listRef = useRef(null);
    const sizeMapRef = useRef(new Map());

    const setRowSize = useCallback(
        (cardId, size) => {
            if (!(size > 0)) return;
            if (sizeMapRef.current.get(cardId) === size) return;
            sizeMapRef.current.set(cardId, size);
            const idx = cards.findIndex(c => c.id === cardId);
            listRef.current?.resetAfterIndex(idx >= 0 ? idx : 0);
        },
        [cards]
    );

    const getItemSize = useCallback(
        index => {
            const card = cards[index];
            if (!card) return DEFAULT_ROW_SIZE; // placeholder slot
            return sizeMapRef.current.get(card.id) ?? DEFAULT_ROW_SIZE;
        },
        [cards]
    );

    // Card order/content changed: recompute positions from the top.
    useEffect(() => {
        listRef.current?.resetAfterIndex(0);
    }, [cards]);

    const itemData = useMemo(
        () => ({ cards, cardContent, readOnly, setRowSize, horizontal }),
        [cards, cardContent, readOnly, setRowSize, horizontal]
    );

    // Auto-load-on-scroll: when the last card scrolls into view, fetch the next
    // batch. Guarded by the current length so it fires at most once per batch.
    const requestedAtLenRef = useRef(-1);
    const handleItemsRendered = useCallback(
        ({ visibleStopIndex }) => {
            if (!autoLoad || !hasMore || isLoadingMore || typeof onLoadMore !== "function") return;
            if (visibleStopIndex < cards.length - 1) return; // not at the end yet
            if (requestedAtLenRef.current === cards.length) return; // already asked at this length
            requestedAtLenRef.current = cards.length;
            onLoadMore(String(lane.id));
        },
        [autoLoad, hasMore, isLoadingMore, onLoadMore, cards.length, lane.id]
    );

    const loadMoreButton = showLaneButton ? (
        <button
            type="button"
            className="btn btn-primary kbn-lane-loadmore"
            disabled={isLoadingMore}
            onClick={() => onLoadMore(String(lane.id))}
        >
            {loadMoreLabel}
        </button>
    ) : null;

    const autoLoadIndicator = autoLoad && isLoadingMore ? <div className="kbn-lane-autoload">…</div> : null;

    const bottomSheetContent = enableLaneBottomSheet ? (
        <div className={"kbn-lane-bottom" + (cards.length > 0 ? " kbn-lane-bottom--with-cards" : "")}>
            {laneBottomSheet?.get?.(lane.mxObj) ?? laneBottomSheet}
        </div>
    ) : null;

    const emptySheetContent =
        cards.length === 0 && enableLaneEmptySheet ? (
            <div className="kbn-lane-empty">{laneEmptySheet?.get?.(lane.mxObj) ?? laneEmptySheet}</div>
        ) : null;

    const renderClone = (provided, snapshot, rubric) => {
        const card = cards[rubric.source.index];
        const body =
            card?.mxObj && cardContent?.get
                ? cardContent.get(card.mxObj)
                : cardContent ?? card?.title ?? String(card?.id ?? "");
        return (
            <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                style={provided.draggableProps.style}
                className="kbn-card kbn-card--dragging"
            >
                {body}
            </div>
        );
    };

    return (
        <div className={laneClassName} style={{ "--lane-width": laneWidthStyle }}>
            <div className="kbn-lane-title">{header}</div>
            <div className={laneBodyClassName}>
                {emptySheetContent}
                <Droppable
                    droppableId={String(lane.id)}
                    type="CARD"
                    direction={orientation}
                    mode="virtual"
                    isDropDisabled={readOnly}
                    renderClone={renderClone}
                >
                    {(provided, snapshot) => {
                        const itemCount = snapshot.isUsingPlaceholder ? cards.length + 1 : cards.length;
                        return (
                            <div className="kbn-lane-cards-viewport" style={{ height: laneBodyHeight }}>
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <VariableSizeList
                                            ref={listRef}
                                            className="kbn-lane-cards"
                                            height={height || 600}
                                            width={width || "100%"}
                                            layout={horizontal ? "horizontal" : "vertical"}
                                            itemCount={itemCount}
                                            itemSize={getItemSize}
                                            estimatedItemSize={DEFAULT_ROW_SIZE}
                                            outerRef={provided.innerRef}
                                            itemData={itemData}
                                            onItemsRendered={handleItemsRendered}
                                        >
                                            {VirtualRow}
                                        </VariableSizeList>
                                    )}
                                </AutoSizer>
                            </div>
                        );
                    }}
                </Droppable>
                {loadMoreButton}
                {autoLoadIndicator}
                {bottomSheetContent}
            </div>
        </div>
    );
}
