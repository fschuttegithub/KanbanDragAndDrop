import "./ui/KanbanDragAndDrop.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Big from "big.js";
import { Board } from "./components/Board";

// -------- helpers (pure; module scope so they're stable references) --------
const toNumber = v => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
    }
    if (v && typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
    if (v && typeof v === "object" && typeof v.toString === "function") {
        const n = parseFloat(v.toString());
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
};

const toBig = v => {
    if (v instanceof Big) return v;
    try {
        return new Big(v);
    } catch {
        return new Big(toNumber(v));
    }
};

const resolveWidgetProp = v => {
    // Mendix expression/widget props can be plain values or wrapped objects
    if (v && typeof v === "object") {
        if ("value" in v) return v.value;
        if (typeof v.get === "function") {
            try {
                return v.get();
            } catch {
                return undefined;
            }
        }
    }
    return v;
};

const toPositiveInt = (v, fallback) => {
    const n = toNumber(v);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
};

// Unlike toPositiveInt, 0 is a valid (explicit "disabled") value here.
const toNonNegativeInt = (v, fallback) => {
    const n = toNumber(v);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
};

export function KanbanDragAndDrop(props) {
    const lanesReady = props.lanes?.status === "available";
    const cardsReady = props.cards?.status === "available";

    // -------- layout / paging config --------
    const renderTypeRaw = resolveWidgetProp(props.renderType);
    const renderType = renderTypeRaw === "Horizontal" ? "Horizontal" : "Vertical";

    const resolvedLaneWidth = useMemo(() => {
        const raw = resolveWidgetProp(props.laneWidth);
        if (typeof raw === "string" && raw.trim().length > 0) return raw;
        if (typeof raw === "number") return `${raw}px`;
        return renderType === "Horizontal" ? "100%" : "300px";
    }, [props.laneWidth, renderType]);

    const laneBodyHeight = useMemo(() => {
        const raw = resolveWidgetProp(props.laneBodyHeight);
        if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
        if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return `${raw}px`;
        return "600px";
    }, [props.laneBodyHeight]);
    const initialCardLimit = useMemo(
        () => toPositiveInt(resolveWidgetProp(props.initialCardLimit), 100),
        [props.initialCardLimit]
    );
    const loadMoreBatchSize = useMemo(
        () => toPositiveInt(resolveWidgetProp(props.loadMoreBatchSize), 50),
        [props.loadMoreBatchSize]
    );
    const minCardsPerLane = useMemo(
        () => toNonNegativeInt(resolveWidgetProp(props.minCardsPerLane), 5),
        [props.minCardsPerLane]
    );

    const loadMoreLabel = useMemo(() => {
        const raw = resolveWidgetProp(props.loadMoreLabel);
        if (typeof raw === "string") {
            const trimmed = raw.trim();
            return trimmed.length > 0 ? trimmed : "Load more";
        }
        return "Load more";
    }, [props.loadMoreLabel]);

    const loadMoreMode = resolveWidgetProp(props.loadMoreMode) === "AutoScroll" ? "AutoScroll" : "LaneButtons";

    // -------- server-side paging: sort key + limit --------
    const [cardLimit, setCardLimit] = useState(initialCardLimit);
    const appliedSortRef = useRef(null);
    const totalCountRequestedRef = useRef(false);

    // Apply sort + limit to the datasource so retrieval is bounded server-side.
    // The platform defers the retrieval until after the widget expresses its
    // paging intent, so setting these in an effect keeps the first fetch bounded.
    // - Sort by the card sort key so a board-wide page interleaves lanes (the
    //   first page fills the top of every lane).
    // - setLimit expresses the paging window; setLimit(undefined) means "all".
    useEffect(() => {
        const ds = props.cards;
        if (!ds) return;
        const attrId = props.cardSortKeyAttr?.id;
        if (attrId && typeof ds.setSortOrder === "function" && appliedSortRef.current !== attrId) {
            ds.setSortOrder([[attrId, "asc"]]);
            appliedSortRef.current = attrId;
        }
        const desired = Number.isFinite(cardLimit) && cardLimit > 0 ? cardLimit : undefined;
        if (typeof ds.setLimit === "function" && ds.limit !== desired) {
            ds.setLimit(desired);
        }
        if (!totalCountRequestedRef.current && typeof ds.requestTotalCount === "function") {
            ds.requestTotalCount(true);
            totalCountRequestedRef.current = true;
        }
    }, [props.cards, props.cardSortKeyAttr, cardLimit]);

    const handleLoadMore = useCallback(() => {
        // Paging is board-wide (single flat datasource): grow the fetched window.
        setCardLimit(prev => {
            const base = Number.isFinite(prev) && prev > 0 ? prev : props.cards?.items?.length ?? 0;
            return base + loadMoreBatchSize;
        });
    }, [loadMoreBatchSize, props.cards?.items?.length]);

    // -------- lanes (sorted) --------
    const getLaneIdFromCard = c => {
        const laneRef = props.cardLaneRef?.get(c);
        if (laneRef && (typeof laneRef.id === "string" || typeof laneRef.id === "number")) return String(laneRef.id);
        const v = laneRef?.value;
        if (v && typeof v === "object" && "id" in v) return String(v.id);
        if (typeof v === "string" || typeof v === "number") return String(v);
        return null;
    };

    const lanes = useMemo(() => {
        const items = props.lanes?.items ?? [];
        const arr = items.map((l, index) => {
            const raw = props.laneSortKeyAttr?.get?.(l)?.value;
            const sortKey = toNumber(raw);
            // null = property not configured, so callers can fall back to cards.length.
            const totalCount = props.laneCardCountAttr ? toNumber(props.laneCardCountAttr.get(l)?.value) : null;
            return { id: String(l.id), index, sortKey, totalCount, mxObj: l };
        });
        arr.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || String(a.id).localeCompare(String(b.id)));
        return arr;
    }, [props.lanes?.items, props.laneSortKeyAttr, props.laneCardCountAttr]);

    const laneIdSet = useMemo(() => new Set(lanes.map(l => l.id)), [lanes]);

    // -------- optimistic lane counts --------
    // laneCardCountAttr may be backed by a heavier microflow that recomputes on its own
    // schedule, so it can lag behind an in-flight card move. Adjust the displayed total
    // locally the moment a move happens, rather than waiting on (or depending on) that
    // refresh landing before the count looks right.
    // { [laneId]: { delta: number, baselineRaw: number } } — kept in state (not a ref) since
    // it's read during render to build displayLanes.
    const [laneCountDeltas, setLaneCountDeltas] = useState({});

    const applyLaneCountDelta = (laneId, delta, rawTotalCount) => {
        if (typeof rawTotalCount !== "number") return; // laneCardCountAttr not configured for this lane
        setLaneCountDeltas(prev => {
            const existing = prev[laneId];
            // If the server value has moved on since we last touched this lane, it's already
            // caught up — start a fresh baseline instead of stacking onto a stale delta.
            const stillFresh = existing?.baselineRaw === rawTotalCount;
            const baselineRaw = stillFresh ? existing.baselineRaw : rawTotalCount;
            const priorDelta = stillFresh ? existing.delta : 0;
            return { ...prev, [laneId]: { delta: priorDelta + delta, baselineRaw } };
        });
    };

    // No effect needed to prune stale deltas: displayLanes below simply ignores any delta
    // whose baseline no longer matches the current server value, treating it as caught up.
    const displayLanes = useMemo(() => {
        if (Object.keys(laneCountDeltas).length === 0) return lanes;
        return lanes.map(l => {
            const pending = laneCountDeltas[l.id];
            if (!pending || typeof l.totalCount !== "number" || l.totalCount !== pending.baselineRaw) return l;
            return { ...l, totalCount: Math.max(0, l.totalCount + pending.delta) };
        });
    }, [lanes, laneCountDeltas]);

    // -------- derive server view (preserve real Decimal sort keys) --------
    const serverCardsByLane = useMemo(() => {
        const items = props.cards?.items;
        if (!items) return null; // loading / unavailable — keep the current view

        const out = {};
        for (const l of lanes) out[l.id] = [];

        for (const c of items) {
            const laneId = getLaneIdFromCard(c);
            if (!laneId) continue;
            const raw = props.cardSortKeyAttr?.get(c)?.value;
            (out[laneId] ||= []).push({ id: String(c.id), sortKey: toBig(raw), mxObj: c });
        }

        for (const laneId of Object.keys(out)) {
            out[laneId].sort((a, b) => a.sortKey.cmp(b.sortKey) || String(a.id).localeCompare(String(b.id)));
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.cards?.items, props.cardSortKeyAttr, props.cardLaneRef, lanes]);

    // -------- optimistic view & pending overlay --------
    const [optimisticCardsByLane, setOptimisticCardsByLane] = useState(() => serverCardsByLane || {});
    // Map<cardId, { toLane: string, index: number, sortKey: Big }>
    const pendingMovesRef = useRef(new Map());

    const applyPendingOverlay = (base, pendingMap) => {
        const out = {};
        for (const [k, v] of Object.entries(base)) out[k] = v.slice();

        const removeCardFromAll = cardId => {
            for (const arr of Object.values(out)) {
                const idx = arr.findIndex(x => x.id === cardId);
                if (idx >= 0) return arr.splice(idx, 1)[0];
            }
            return undefined;
        };

        for (const [cardId, { toLane, index, sortKey }] of pendingMap.entries()) {
            const existing = removeCardFromAll(cardId);
            if (!laneIdSet.has(toLane)) continue;
            const dst = out[toLane] || (out[toLane] = []);
            const insertIdx = Math.min(Math.max(index, 0), dst.length);
            dst.splice(insertIdx, 0, { id: cardId, sortKey, mxObj: existing?.mxObj });
        }
        return out;
    };

    // Reconcile pending moves against the freshly fetched server view.
    useEffect(() => {
        if (!serverCardsByLane) return; // still loading — keep the current view
        if (pendingMovesRef.current.size > 0) {
            for (const [cardId, { toLane, index }] of Array.from(pendingMovesRef.current.entries())) {
                const laneArr = serverCardsByLane[toLane] || [];
                const serverIdx = laneArr.findIndex(x => x.id === cardId);
                if (serverIdx === index) pendingMovesRef.current.delete(cardId);
            }
        }
        if (pendingMovesRef.current.size === 0) setOptimisticCardsByLane(serverCardsByLane);
        else setOptimisticCardsByLane(applyPendingOverlay(serverCardsByLane, pendingMovesRef.current));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverCardsByLane]);

    // Displayed grouping: the optimistic view once populated, otherwise the raw
    // server view (avoids a one-frame empty flash before the reconcile effect runs).
    const displayedCardsByLane = useMemo(() => {
        const optimistic = optimisticCardsByLane || {};
        return Object.keys(optimistic).length > 0 ? optimistic : serverCardsByLane || {};
    }, [optimisticCardsByLane, serverCardsByLane]);

    // -------- per-lane view --------
    // Paging is board-wide, so "more to load" is a single board-level signal.
    const boardHasMore = !!props.cards?.hasMoreItems;
    const isLoadingMore = props.cards?.status === "loading";
    // Changes exactly once per completed fetch — lets a lane-level auto-load-more
    // guard against re-firing until a new batch has actually landed.
    const loadedCardCount = props.cards?.items?.length ?? 0;
    const visibleCardsByLane = useMemo(() => {
        const visible = {};
        for (const lane of lanes) {
            visible[lane.id] = displayedCardsByLane[lane.id] || [];
        }
        return visible;
    }, [lanes, displayedCardsByLane]);

    // -------- read-only from microflow security --------
    const isReadOnly = useMemo(() => {
        const probe = props.cards?.items?.[0];
        const a = probe ? props.onDrop?.get?.(probe) : null;
        return !a?.canExecute;
    }, [props.cards?.items, props.onDrop]);

    // -------- gap-based sort key for a drop position --------
    const computeNewSortKey = (destArr, draggedId, toIdx) => {
        const arr = destArr.filter(c => c.id !== draggedId);
        const before = arr[toIdx - 1];
        const after = arr[toIdx];
        const bKey = before ? toBig(before.sortKey) : null;
        const aKey = after ? toBig(after.sortKey) : null;
        if (bKey && aKey) return bKey.plus(aKey).div(2);
        if (aKey) return aKey.minus(1);
        if (bKey) return bKey.plus(1);
        return new Big(0);
    };

    const applyLocalMove = (state, fromLane, toLane, fromIdx, toIdx, cardId, newKey) => {
        const next = {};
        for (const [k, v] of Object.entries(state)) next[k] = v.slice();
        const src = next[fromLane] ?? [];
        const dst = fromLane === toLane ? src : next[toLane] ?? (next[toLane] = []);

        const moving = src.splice(fromIdx, 1)[0];
        if (!moving) return state;

        const updated = { ...moving, id: cardId, sortKey: newKey };
        const clamped = Math.min(Math.max(toIdx, 0), dst.length);
        dst.splice(clamped, 0, updated);

        next[fromLane] = src;
        next[toLane] = dst;
        return next;
    };

    // -------- drag & drop persistence --------
    const onCardMove = useCallback(
        result => {
            if (isReadOnly) return; // hard stop for users without execute permission

            const { draggableId, source, destination } = result ?? {};
            if (!destination || !draggableId) return;

            const fromLane = String(source.droppableId);
            const toLane = String(destination.droppableId);
            const fromIdx = source.index;
            const toIdx = destination.index;

            if (!laneIdSet.has(fromLane) || !laneIdSet.has(toLane)) return;
            if (fromLane === toLane && fromIdx === toIdx) return;

            const cardId = String(draggableId);
            const destArr = displayedCardsByLane[toLane] || [];
            const newKey = computeNewSortKey(destArr, cardId, toIdx);

            // Optimistic UI
            setOptimisticCardsByLane(
                applyLocalMove(displayedCardsByLane, fromLane, toLane, fromIdx, toIdx, cardId, newKey)
            );
            pendingMovesRef.current.set(cardId, { toLane, index: toIdx, sortKey: newKey });

            if (fromLane !== toLane) {
                applyLaneCountDelta(fromLane, -1, lanes.find(l => l.id === fromLane)?.totalCount);
                applyLaneCountDelta(toLane, 1, lanes.find(l => l.id === toLane)?.totalCount);
            }

            // Persist
            const cardItem = (props.cards?.items ?? []).find(i => String(i.id) === cardId);
            if (!cardItem) return;

            const laneObj = (props.lanes?.items ?? []).find(l => String(l.id) === toLane);
            const laneGuidValue = laneObj ? props.laneGuidAttr?.get(laneObj).value : undefined;

            props.moveTargetLaneGuid?.setValue(laneGuidValue);
            props.moveNewSortKey?.setValue(newKey); // Decimal must be Big
            const onDropAction = props.onDrop?.get(cardItem);
            if (onDropAction?.canExecute) {
                onDropAction.execute();
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            isReadOnly,
            laneIdSet,
            lanes,
            displayedCardsByLane,
            props.cards?.items,
            props.lanes?.items,
            props.laneGuidAttr,
            props.moveTargetLaneGuid,
            props.moveNewSortKey,
            props.onDrop
        ]
    );

    // -------- render gates (after all hooks) --------
    // Show the initial loader only until we have some card grouping to show; once
    // we do, keep the board mounted through later "loading" states (e.g. load more).
    const hasBoardData = cardsReady || !!serverCardsByLane || Object.keys(optimisticCardsByLane || {}).length > 0;
    if (!lanesReady || !hasBoardData) {
        return (
            <div className="kbn-board" role="status" aria-live="polite">
                Loading…
            </div>
        );
    }

    const missingProps = [];
    if (!props.cardSortKeyAttr) missingProps.push("cardSortKeyAttr");
    if (!props.cardLaneRef) missingProps.push("cardLaneRef");
    if (!props.laneGuidAttr) missingProps.push("laneGuidAttr");
    if (!props.moveTargetLaneGuid) missingProps.push("moveTargetLaneGuid");
    if (!props.moveNewSortKey) missingProps.push("moveNewSortKey");
    if (!props.onDrop) missingProps.push("onDrop");
    if (missingProps.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`KanbanDragAndDrop: Missing required properties: ${missingProps.join(", ")}`);
        return <div className="kbn-board">Configuration incomplete</div>;
    }

    return (
        <Board
            lanes={displayLanes}
            cardsByLane={visibleCardsByLane}
            onCardMove={onCardMove}
            onLoadMore={handleLoadMore}
            loadMoreLabel={loadMoreLabel}
            loadMoreMode={loadMoreMode}
            hasMore={boardHasMore}
            isLoadingMore={isLoadingMore}
            loadedCount={loadedCardCount}
            minCardsPerLane={minCardsPerLane}
            readOnly={isReadOnly}
            laneWidth={resolvedLaneWidth}
            laneBodyHeight={laneBodyHeight}
            laneContent={props.laneContent}
            cardContent={props.cardContent}
            enableLaneBottomSheet={props.enableLaneBottomSheet}
            laneBottomSheet={props.laneBottomSheet}
            enableLaneEmptySheet={props.enableLaneEmptySheet}
            laneEmptySheet={props.laneEmptySheet}
            renderType={renderType}
        />
    );
}
