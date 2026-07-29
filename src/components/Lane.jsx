import { useCallback, useRef } from "react";
import { Card } from "./Card";
import { Droppable } from "@hello-pangea/dnd";

// Distance (px) from the end at which auto-scroll fetches the next batch.
const AUTO_LOAD_THRESHOLD = 48;

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

    // -------- auto-load-on-scroll --------
    const scrollRef = useRef(null);
    // Guards against firing more than once per loaded batch.
    const requestedAtLenRef = useRef(-1);

    const requestLoad = useCallback(() => {
        if (requestedAtLenRef.current === cards.length) return;
        requestedAtLenRef.current = cards.length;
        onLoadMore(String(lane.id));
    }, [cards.length, onLoadMore, lane.id]);

    const handleScroll = useCallback(() => {
        if (!autoLoad || !hasMore || isLoadingMore || typeof onLoadMore !== "function") return;
        const el = scrollRef.current;
        if (!el) return;
        const nearEnd = horizontal
            ? el.scrollLeft + el.clientWidth >= el.scrollWidth - AUTO_LOAD_THRESHOLD
            : el.scrollTop + el.clientHeight >= el.scrollHeight - AUTO_LOAD_THRESHOLD;
        if (nearEnd) requestLoad();
    }, [autoLoad, hasMore, isLoadingMore, onLoadMore, horizontal, requestLoad]);

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

    const cardsStyle = horizontal ? undefined : { maxHeight: laneBodyHeight };

    return (
        <div className={laneClassName} style={{ "--lane-width": laneWidthStyle }}>
            <div className="kbn-lane-title">{header}</div>
            <div className={laneBodyClassName}>
                {emptySheetContent}
                <Droppable droppableId={String(lane.id)} type="CARD" direction={orientation} isDropDisabled={readOnly}>
                    {provided => (
                        <div
                            ref={node => {
                                scrollRef.current = node;
                                provided.innerRef(node);
                            }}
                            {...provided.droppableProps}
                            className="kbn-lane-cards"
                            style={cardsStyle}
                            onScroll={autoLoad ? handleScroll : undefined}
                        >
                            {cards.map((card, index) => (
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
                {loadMoreButton}
                {autoLoadIndicator}
                {bottomSheetContent}
            </div>
        </div>
    );
}
