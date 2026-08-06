import { useCallback, useEffect, useRef } from "react";
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
    loadedCount = 0,
    minCardsPerLane = 0,
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
    // totalCount is null when laneCardCountAttr isn't configured — fall back to what's loaded.
    const totalCount = typeof lane.totalCount === "number" ? lane.totalCount : null;
    // A lane is only "genuinely empty" once we know its real total is 0. If the total is
    // unknown, or is known but higher than what's loaded, treat it as "not yet loaded"
    // rather than empty — this lane still has cards pending, it's just that the board-wide
    // paging window hasn't reached them yet.
    const isPendingLoad = cards.length === 0 && (totalCount === null || totalCount > 0);
    const isGenuinelyEmpty = cards.length === 0 && totalCount === 0;
    // Only auto-trigger a load when we have confirmed (via the count attribute) that this
    // lane actually has more cards to give — an unknown total isn't grounds to keep fetching,
    // and neither is a lane that's already fully loaded (even if below minCardsPerLane).
    // A lane with too few loaded cards has no scrollbar of its own to trigger further loads,
    // so it keeps auto-requesting until it reaches minCardsPerLane (or runs out of cards).
    const needsAutoLoad = totalCount !== null && cards.length < totalCount && cards.length < minCardsPerLane;

    const countLabel =
        totalCount !== null && totalCount !== cards.length ? `${cards.length}/${totalCount}` : `${cards.length}`;
    const header = laneContent?.get?.(lane.mxObj) ?? laneContent ?? `${lane.title ?? "Lane"} (${countLabel})`;
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

    // -------- auto-load for lanes that can't be scrolled --------
    // A lane with too few cards (below minCardsPerLane) may not overflow its container,
    // so handleScroll above can never fire for it. When the count attribute confirms more
    // cards are pending, request a load directly. Guarded on loadedCount (bumps once per
    // completed fetch) rather than isLoadingMore alone, since status may not flip
    // synchronously with the request.
    // Once a lane reaches its floor, latch it — paging here is a single board-wide window,
    // so re-requesting isn't a cheap per-lane top-up, it reloads the whole board. Without
    // this latch, a card dragged out of an already-settled lane (dropping it back under
    // the floor) would keep re-triggering full-board reloads on every ordinary drag-and-drop.
    const settledRef = useRef(false);
    const lastAutoRequestedCountRef = useRef(-1);
    useEffect(() => {
        const floor = totalCount !== null ? Math.min(minCardsPerLane, totalCount) : minCardsPerLane;
        if (cards.length >= floor) settledRef.current = true;
        if (settledRef.current) return;
        if (!autoLoad || !needsAutoLoad || !hasMore || isLoadingMore) return;
        if (typeof onLoadMore !== "function") return;
        if (lastAutoRequestedCountRef.current === loadedCount) return;
        lastAutoRequestedCountRef.current = loadedCount;
        onLoadMore(String(lane.id));
    }, [
        autoLoad,
        needsAutoLoad,
        hasMore,
        isLoadingMore,
        loadedCount,
        onLoadMore,
        lane.id,
        cards.length,
        minCardsPerLane,
        totalCount
    ]);

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
        isGenuinelyEmpty && enableLaneEmptySheet ? (
            <div className="kbn-lane-empty">{laneEmptySheet?.get?.(lane.mxObj) ?? laneEmptySheet}</div>
        ) : null;

    const pendingLoadIndicator = isPendingLoad && hasMore ? <div className="kbn-lane-pending">Loading…</div> : null;

    const cardsStyle = horizontal ? undefined : { maxHeight: laneBodyHeight };

    return (
        <div className={laneClassName} style={{ "--lane-width": laneWidthStyle }}>
            <div className="kbn-lane-title">{header}</div>
            <div className={laneBodyClassName}>
                {emptySheetContent}
                {pendingLoadIndicator}
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
