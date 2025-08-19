import React, { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "./components/Board";
import Big from "big.js";
import "./ui/KanbanDragAndDrop.css";

export function KanbanDragAndDrop(props) {
    const lanesReady = props.lanes?.status === "available";
    const cardsReady = props.cards?.status === "available";
    if (!lanesReady || !cardsReady) {
        return (
            <div className="kbn-board" role="status" aria-live="polite">
                Loading…
            </div>
        );
    }

    // Required-props guard (useful during setup)
    const missingProps = [];
    if (!props.cardSortKeyAttr) missingProps.push("cardSortKeyAttr");
    if (!props.cardLaneRef) missingProps.push("cardLaneRef");
    if (!props.laneGuidAttr) missingProps.push("laneGuidAttr");
    if (!props.moveTargetLaneGuid) missingProps.push("moveTargetLaneGuid");
    if (!props.moveNewSortKey) missingProps.push("moveNewSortKey");
    if (!props.onPersist) missingProps.push("onPersist");
    if (missingProps.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`KanbanDragAndDrop: Missing required properties: ${missingProps.join(", ")}`);
        return <div className="kbn-board">Configuration incomplete</div>;
    }

    // -------- helpers --------
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

    const resolveWidgetProp = v => {
        // Mendix expression/widget props can be plain values or wrapped objects
        if (v && typeof v === "object") {
            if ("value" in v) return v.value;
            if (typeof v.get === "function") {
                try {
                    return v.get();
                } catch (e) {
                    return undefined;
                }
            }
        }
        return v;
    };

    const getLaneIdFromCard = c => {
        const laneRef = props.cardLaneRef.get(c);
        if (laneRef && (typeof laneRef.id === "string" || typeof laneRef.id === "number")) return String(laneRef.id);
        const v = laneRef?.value;
        if (v && typeof v === "object" && "id" in v) return String(v.id);
        if (typeof v === "string" || typeof v === "number") return String(v);
        return null;
    };

    // -------- lanes (sorted) --------
    const lanes = useMemo(() => {
        const items = props.lanes?.items ?? [];
        const arr = items.map((l, index) => {
            const raw = props.laneSortKeyAttr?.get?.(l)?.value;
            const sortKey = toNumber(raw);
            return { id: String(l.id), index, sortKey, mxObj: l };
        });
        arr.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || String(a.id).localeCompare(String(b.id)));
        return arr.map(({ id, index, sortKey, mxObj }) => ({ id, index, sortKey, mxObj }));
    }, [props.lanes?.items, props.laneSortKeyAttr]);

    const laneIdSet = useMemo(() => new Set(lanes.map(l => l.id)), [lanes]);

    // -------- derive server view (normalize 0..n-1) --------
    const derivedCardsByLane = useMemo(() => {
        // Start with empty arrays for each lane so empty lanes render correctly
        const out = {};
        for (const l of lanes) out[l.id] = [];

        const items = props.cards?.items ?? [];
        for (const c of items) {
            const laneId = getLaneIdFromCard(c);
            if (!laneId) continue;
            const raw = props.cardSortKeyAttr.get(c)?.value;
            const sortRaw = toNumber(raw);
            (out[laneId] ||= []).push({ id: String(c.id), sortRaw, mxObj: c });
        }

        for (const laneId of Object.keys(out)) {
            const arr = out[laneId];
            arr.sort((a, b) => (a.sortRaw ?? 0) - (b.sortRaw ?? 0) || String(a.id).localeCompare(String(b.id)));
            out[laneId] = arr.map((x, idx) => ({ id: x.id, sortKey: idx, mxObj: x.mxObj }));
        }
        return out;
    }, [props.cards?.items, props.cardSortKeyAttr, props.cardLaneRef, lanes]);

    // -------- optimistic view & pending overlay --------
    const [viewCardsByLane, setViewCardsByLane] = useState(derivedCardsByLane);
    // Map<cardId, { toLane: string, sortKey: number }>
    const pendingMovesRef = useRef(new Map());

    const applyPendingOverlay = (base, pendingMap) => {
        const out = {};
        for (const [k, v] of Object.entries(base)) out[k] = v.slice();

        const allItems = props.cards?.items ?? [];
        const byId = new Map(allItems.map(c => [String(c.id), c]));

        const removeCardFromAll = cardId => {
            for (const arr of Object.values(out)) {
                const idx = arr.findIndex(x => x.id === cardId);
                if (idx >= 0) arr.splice(idx, 1);
            }
        };

        for (const [cardId, { toLane, sortKey }] of pendingMap.entries()) {
            removeCardFromAll(cardId);
            if (!laneIdSet.has(toLane)) continue;

            const dst = out[toLane] || (out[toLane] = []);
            const insertIdx = Math.min(Math.max(sortKey, 0), dst.length);
            const mxObj = byId.get(cardId); // may be undefined; Card.jsx handles defensively
            dst.splice(insertIdx, 0, { id: cardId, sortKey: insertIdx, mxObj });

            for (let i = 0; i < dst.length; i++) dst[i].sortKey = i;
        }
        return out;
    };

    // Reconcile pending vs server view
    useEffect(() => {
        if (pendingMovesRef.current.size > 0) {
            for (const [cardId, { toLane, sortKey }] of Array.from(pendingMovesRef.current.entries())) {
                const laneArr = derivedCardsByLane[toLane] || [];
                const serverIdx = laneArr.findIndex(x => x.id === cardId);
                if (serverIdx === sortKey) pendingMovesRef.current.delete(cardId);
            }
        }
        if (pendingMovesRef.current.size === 0) setViewCardsByLane(derivedCardsByLane);
        else setViewCardsByLane(applyPendingOverlay(derivedCardsByLane, pendingMovesRef.current));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [derivedCardsByLane, props.cards?.items]);

    // -------- derive read-only from microflow security (Option A) --------
    const isReadOnly = useMemo(() => {
        const probe = props.cards?.items?.[0];
        const a = probe ? props.onPersist?.get?.(probe) : null;
        // If there are no cards, default to read-only; when cards appear, this will recompute.
        return !a?.canExecute;
    }, [props.cards?.items, props.onPersist]);

    // -------- local move helper --------
    const applyLocalMove = (state, fromLane, toLane, fromIdx, toIdx, cardId) => {
        const next = {};
        for (const [k, v] of Object.entries(state)) next[k] = v.slice();
        const src = next[fromLane] ?? [];
        const dst = fromLane === toLane ? src : next[toLane] ?? (next[toLane] = []);

        let moving;
        if (fromLane === toLane) moving = dst.splice(fromIdx, 1)[0];
        else moving = src.splice(fromIdx, 1)[0];
        if (!moving) return state;

        const clamped = Math.min(Math.max(toIdx, 0), dst.length);
        const updated = { ...moving, id: cardId };
        dst.splice(clamped, 0, updated);

        for (let i = 0; i < src.length; i++) src[i].sortKey = i;
        for (let i = 0; i < dst.length; i++) dst[i].sortKey = i;

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

            const newIndex = toIdx;

            // Optimistic UI
            setViewCardsByLane(prev => applyLocalMove(prev, fromLane, toLane, fromIdx, newIndex, String(draggableId)));
            pendingMovesRef.current.set(String(draggableId), { toLane, sortKey: newIndex });

            // Persist
            const cardItem = (props.cards?.items ?? []).find(i => String(i.id) === String(draggableId));
            if (!cardItem) return;

            const laneObj = (props.lanes?.items ?? []).find(l => String(l.id) === toLane);
            const laneGuidValue = props.laneGuidAttr?.get?.(laneObj)?.value;

            props.moveTargetLaneGuid?.setValue?.(laneGuidValue);
            props.moveNewSortKey?.setValue?.(new Big(newIndex)); // Decimal must be Big
            const persistAction = props.onPersist?.get?.(cardItem);
            if (persistAction?.canExecute) {
                persistAction.execute();
            }

            // Pull server updates; overlay prevents snap-back.
            props.cards?.reload?.();
        },
        [
            isReadOnly,
            laneIdSet,
            props.cards?.items,
            props.lanes?.items,
            props.laneGuidAttr,
            props.moveTargetLaneGuid,
            props.moveNewSortKey,
            props.onPersist
        ]
    );

    return (
        <Board
            lanes={lanes}
            cardsByLane={viewCardsByLane}
            onCardMove={onCardMove}
            readOnly={isReadOnly}
            laneWidth={
                (function () {
                    const raw = resolveWidgetProp(props.laneWidth);
                    if (typeof raw === "string") return raw;
                    if (typeof raw === "number") return `${raw}px`;
                    return "500px";
                })()
            }
            compactCards={props.compactCards ?? false}
            laneContent={props.laneContent}
            cardContent={props.cardContent}
            enableLaneBottomSheet={props.enableLaneBottomSheet}
            laneBottomSheet={props.laneBottomSheet}
            enableLaneEmptySheet={props.enableLaneEmptySheet}
            laneEmptySheet={props.laneEmptySheet}
        />
    );
}
