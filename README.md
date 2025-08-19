## KanbanDragAndDrop
# Kanban Board Widget (Mendix 10)

## What this widget does
A drag-and-drop Kanban board for Mendix, built with `@hello-pangea/dnd`.  
- Move cards within and between lanes using mouse, touch, or keyboard.  
- (Optional) reorder lanes horizontally.  
- Supports WIP limits, fractional sort keys for smooth reordering, and two persistence modes (Mendix flows or Client API).  
- Optimistic UI for a snappy experience, with accessibility and auto-scroll built in.

## How the React library works (big picture)
`@hello-pangea/dnd` is a React drag-and-drop framework designed for lists and multi-list boards:
1. **`<DragDropContext>`** wraps your board and listens for drag events.  
2. **`<Droppable>`** defines a drop zone (e.g., a lane for cards).  
3. **`<Draggable>`** defines items that can be moved (e.g., cards or lanes).  
4. The library tracks source and destination, manages placeholders, and gives you an `onDragEnd` result so you can update state or persist changes.  
5. Built-in features include keyboard control, screen-reader support, auto-scroll, and the ability to render drag previews in a portal to avoid overflow clipping.

In this widget, lanes and cards are rendered as Droppables/Draggables, and Mendix data is updated based on the drag result.


## Features
[feature highlights]

## Usage
[step by step instructions]

## Demo project
[link to sandbox]

## Issues, suggestions and feature requests
[link to GitHub issues]

## Development and contribution

1. Install NPM package dependencies by using: `npm install`. If you use NPM v7.x.x, which can be checked by executing `npm -v`, execute: `npm install --legacy-peer-deps`.
1. Run `npm start` to watch for code changes. On every change:
    - the widget will be bundled;
    - the bundle will be included in a `dist` folder in the root directory of the project;
    - the bundle will be included in the `deployment` and `widgets` folder of the Mendix test project.


